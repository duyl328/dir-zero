# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**Folder Insight（文件夹透视）** — a Tauri 2 desktop app for Windows that scans folder structures, identifies storage issues, and helps users clean up disk space.

The app lives in `folder-insight/`. The repo root also contains product/design docs in Chinese (`DESIGN-*.md`, `PRD-*.md`).

## Commands

All commands run from `folder-insight/`:

```bash
npm run dev          # Start Vite dev server (frontend only)
npm run tauri dev    # Start full Tauri app (frontend + Rust backend)
npm run build        # tsc + vite build
npm run tauri build  # Build production Tauri binary
npx tsc --noEmit     # Type-check only (no output = clean)
```

Rust backend (from `folder-insight/src-tauri/`):

```bash
cargo build    # Build Rust backend
cargo test     # Run Rust tests
cargo clippy   # Lint
```

## Architecture

### Frontend (React + Zustand)

- `src/App.tsx` — router setup with React Router 7
- `src/pages/` — four top-level pages: `OverviewPage`, `FindProblemsPage`, `FileTypesPage`, `SettingsPage`
- `src/components/` — organized by page: `layout/`, `overview/`, `problems/`, `scan/`, `ui/`
- `src/store/appStore.ts` — single Zustand store; holds `ScanSession` (scan state/results) and `ExcludeRule[]` (builtin + user-defined exclude patterns)
- `src/types/index.ts` — all shared TypeScript types

### Backend (Rust + Tauri)

- `src-tauri/src/lib.rs` — all Rust logic: five Tauri commands, recursive directory traversal, progress event emission, type definitions mirroring the frontend types
  - `scan_folder(roots, excludeRules)` — scans dirs, stores all `FileEntry` in `AppState`, returns `SlimScanResult`; emits `"scan-progress"` events every 200 items
  - `get_files_chunk(offset, limit)` — paginated access to the flat `FileEntry` list stored in `AppState` after scan
  - `get_folder_files(path)` — returns all `FileEntry` whose parent dir equals `path`; used by `TreemapCanvas` for lazy file-leaf loading
  - `find_duplicates()` — 4-phase: size grouping → quick hash (64 KB) → full BLAKE3 hash → clustering; emits `"dup-progress"` events; operates on `AppState.files`
  - `move_to_trash(paths)` — batch delete to recycle bin
- `src-tauri/src/main.rs` — entry point
- Tauri plugins: `tauri-plugin-dialog`, `tauri-plugin-opener` — must be registered in **both** `lib.rs` (`.plugin(...)`) **and** `src-tauri/capabilities/default.json` (permissions array)
- Rust deps: `serde`, `serde_json`, `walkdir`, `rayon`, `blake3`, `trash`

### Data flow

1. User configures scan roots and exclude rules → stored in Zustand
2. `ScanConfigModal` calls `invoke("scan_folder", { roots, excludeRules })`
3. Rust emits `"scan-progress"` events every 200 items; frontend listens via `listen("scan-progress", ...)` and calls `setScanProgress`
4. On completion, `scan_folder` returns `SlimScanResult` (folder tree + precomputed stats); frontend calls `setScanResult` which sets status to `"done"`
5. After scan, the store lazy-loads the flat `FileEntry[]` in background chunks via `get_files_chunk(offset, limit)`, stored in `allFiles`
6. `OverviewPage` reads `SlimScanResult.stats` for type bars and insight panels; `TreemapCanvas` calls `get_folder_files(path)` to load file leaves on demand

### Key types (`src/types/index.ts`)

- `ScanSession` — lifecycle: `idle | configuring | scanning | done`
- `SlimFolderEntry` — IPC-safe folder tree node (folders only, no file leaves); sent over IPC (~5 MB for a full C: scan)
- `SlimScanResult` — top-level scan result; contains `tree: SlimFolderEntry` and `stats: PrecomputedStats`
- `PrecomputedStats` — precomputed on the Rust side: `typeStats`, `topFiles`, `oldFilesCount/Size`, `unknownExtStats`
- `FileEntry` — leaf node with `fileType: FileTypeCategory`, `ext`, `sizeOnDisk`, `modifiedAt`, `createdAt` (unix ms), `isHidden`
- `FileChunk` — paginated flat file list returned by `get_files_chunk`; lazy-loaded after scan completes
- `FolderEntry` / `FolderChild` — still used in frontend analysis code; `FolderChild` is a discriminated union `{ kind: "folder" } & FolderEntry | { kind: "file" } & FileEntry`
- `FileTypeCategory` — 15 categories: `image | video | audio | document | archive | installer | code | database | design | model | font | disk_image | system | cache | unknown`
- `ExcludeRule` — glob/path/regex patterns; builtin rules have IDs prefixed `b-`

### File classification (`src-tauri/src/lib.rs — classify_ext`)

Maps file extension → `FileTypeCategory`. Covers ~150 extensions across 15 categories. The `unknown` fallback catches anything unrecognised. Both the Rust classifier and frontend `FILE_TYPE_COLORS` / `TYPE_META` maps must be kept in sync when adding new categories.

### OverviewPage layout

Three-pane layout with a **draggable divider** between the left tree and centre treemap:
- **Left** — `DirectoryTree` (resizable, 140–400 px, default 224 px)
- **Centre** — `TreemapCanvas` + `TypeBar`
- **Right** — `DetailPanel` (selected node) + `InsightPanel` (Top-N large files, old-files summary)

`treemapStack: FolderEntry[]` is lifted to `OverviewPage` so both the tree and the treemap stay in sync. `findPathToFolder(root, path)` reconstructs the stack when the user clicks a node in the directory tree.

### Treemap (`src/components/overview/TreemapCanvas.tsx`)

Squarified treemap on a `<canvas>`. Key details:

- **Inline expansion** — single click on a folder block expands it in-place (SpaceSniffer-style); `expandedPaths: Set<string>` tracks state; `computeAllRects` recurses into expanded folders with a `depth` counter
- **Drill-down** — double click pushes a new `FolderEntry` onto `stack`; "返回上级" button pops it
- **Auto-expand** — on navigation, `getAutoExpanded()` pre-expands folders whose initial rect is ≥ 110×70 px
- **Text** — uses `truncateText()` (binary search + ellipsis) instead of canvas `maxWidth` compression
- **Hit testing** — `getDeepestAt()` finds the deepest (highest `depth`) and smallest rect under the cursor
- `allRectsRef` pattern avoids stale closures in canvas event handlers

### TypeBar (`OverviewPage.tsx — TypeBar`)

Shows a proportional colour bar + legend from real scan data. If `unknown` occupies ≥ 15% of total size, a second row expands showing the top-8 extensions within Unknown as pill badges (e.g. `.glb 42%`).

### FindProblemsPage

Three-tab layout: `DuplicatesTab`, `StructureTab`, `ResidueTab`.

**Duplicates flow** mirrors the main scan flow:
1. `FindProblemsPage` calls `invoke("find_duplicates")` — no args; Rust operates on `AppState.files` already populated by `scan_folder`
2. Rust emits `"dup-progress"` events; frontend listens and updates `duplicatesStatus` in the store
3. On completion, raw `RawDuplicateCluster[]` results are enriched via a `fileMap` (path → `FileEntry`) built from `allFiles`, then stored as `duplicatesResult: DuplicateCluster[]`

**Structure & Residue analysis** run entirely in the frontend:
- `src/analysis/structureAnalysis.ts` — heuristic checks on the folder tree
- `src/analysis/residueAnalysis.ts` — matches against `BUILTIN_RESIDUE_RULES` (glob patterns for known leftover paths)

The store holds `duplicatesResult` and `duplicatesStatus` alongside the main `ScanSession`.

### Scanning modes

`ScanProgress.mode`:
- `"compat"` — current implementation (`std::fs::read_dir` recursive)
- `"mft"` — planned fast NTFS MFT scan (not yet implemented)

### Styling

Tailwind CSS with a custom Material Design 3 palette defined in `tailwind.config.js` — use the semantic tokens (`primary`, `secondary`, `tertiary`, `error`, `surface-*`) rather than raw Tailwind colours. Dark mode uses the `class` strategy with custom RGB channel vars (`--md-*`) for opacity support. TypeScript is configured with `strict: true`, `noUnusedLocals`, and `noUnusedParameters` — the type-check command (`npx tsc --noEmit`) must stay clean.

### Internationalization

- `src/i18n/zh.ts` and `src/i18n/en.ts` — all UI strings
- Active locale stored in Zustand (`appStore.locale`), persisted to `localStorage`; defaults to `"zh"`
- Use the `useT()` hook (`src/hooks/useT.ts`) to access the current locale's strings — do not read `localStorage` directly
- When adding new UI text, add keys to both locale files
