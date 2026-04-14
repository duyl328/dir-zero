# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

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

- `src-tauri/src/lib.rs` — all Rust logic: `scan_folder` command, recursive directory traversal, progress event emission, type definitions mirroring the frontend types
- `src-tauri/src/main.rs` — entry point
- Tauri plugins: `tauri-plugin-dialog`, `tauri-plugin-opener` — must be registered in **both** `lib.rs` (`.plugin(...)`) **and** `src-tauri/capabilities/default.json` (permissions array)
- Rust deps: `serde`, `serde_json`, `walkdir`, `rayon`

### Data flow

1. User configures scan roots and exclude rules → stored in Zustand
2. `ScanConfigModal` calls `invoke("scan_folder", { roots, excludeRules })`
3. Rust emits `"scan-progress"` events every 200 items; frontend listens via `listen("scan-progress", ...)` and calls `setScanProgress`
4. On completion, `scan_folder` returns `ScanResult`; frontend calls `setScanResult` which sets status to `"done"`
5. `OverviewPage` reads from the store; `collectFiles(result.tree)` flattens the tree into a `FileEntry[]` for stats computations

### Key types (`src/types/index.ts`)

- `ScanSession` — lifecycle: `idle | configuring | scanning | done`
- `FolderEntry` — recursive tree node; `children: FolderChild[]`
- `FolderChild` — discriminated union: `{ kind: "folder" } & FolderEntry` or `{ kind: "file" } & FileEntry`. The `kind` tag comes from Rust's `#[serde(tag = "kind")]` on the `FolderChild` enum.
- `FileEntry` — leaf node with `fileType: FileTypeCategory`, `ext`, `modifiedAt`, `createdAt` (unix ms)
- `FileTypeCategory` — 15 categories: `image | video | audio | document | archive | installer | code | database | design | model | font | disk_image | system | cache | unknown`
- `ExcludeRule` — glob/path patterns; builtin rules have IDs prefixed `b-`

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

### Scanning modes

`ScanProgress.mode`:
- `"compat"` — current implementation (`std::fs::read_dir` recursive)
- `"mft"` — planned fast NTFS MFT scan (not yet implemented)
