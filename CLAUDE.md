# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**Folder Insight（文件夹透视）** — a Tauri 2 desktop app for Windows that scans folder structures, identifies storage issues, and helps users clean up disk space.

The app lives in `folder-insight/`. The repo root also contains product/design docs in Chinese (`DESIGN-*.md`, `PRD-*.md`).

## Commands

All commands run from `folder-insight/`:

```bash
npm run dev        # Start Vite dev server (frontend only)
npm run tauri dev  # Start full Tauri app (frontend + Rust backend)
npm run build      # tsc + vite build
npm run tauri build  # Build production Tauri binary
```

Rust backend (from `folder-insight/src-tauri/`):

```bash
cargo build        # Build Rust backend
cargo test         # Run Rust tests
cargo clippy       # Lint
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
- Tauri plugins in use: `tauri-plugin-dialog`, `tauri-plugin-opener`
- Rust deps: `walkdir`, `rayon`, `serde`, `serde_json`

### Data flow

1. User configures scan roots and exclude rules → stored in Zustand
2. `ScanConfigModal` calls `invoke("scan_folder", { roots, excludeRules })` 
3. Rust emits `"scan-progress"` events during traversal; frontend listens via `listen("scan-progress", ...)` and calls `setScanProgress`
4. On completion, `scan_folder` returns `ScanResult`; frontend calls `setScanResult` which sets status to `"done"`
5. Pages read from the store to render treemap, directory tree, detail panel

### Key types (`src/types/index.ts`)

- `ScanSession` — scan lifecycle: `idle | configuring | scanning | done`, holds `ScanProgress` and `ScanResult`
- `FolderEntry` — recursive tree node; `children: FolderChild[]`
- `FolderChild` — discriminated union: `{ kind: "folder" } & FolderEntry` or `{ kind: "file" } & FileEntry`. The `kind` tag is set by Rust's `#[serde(tag = "kind")]` on the `FolderChild` enum.
- `FileEntry` — leaf node with `fileType`, `modifiedAt`, `createdAt` (unix ms)
- `ExcludeRule` — glob/regex/path patterns; builtin rules are prefixed `b-` in their IDs

### Treemap (`src/components/overview/TreemapCanvas.tsx`)

Implements squarified treemap layout on a `<canvas>`. Supports drill-down (double-click enters a folder, breadcrumb navigates back). Right-click opens a context menu with "在文件管理器中打开" (`revealItemInDir`) and "进入此文件夹".

### Scanning modes

The `ScanProgress.mode` field distinguishes two scan strategies:
- `"mft"` — fast NTFS MFT-based scan (Windows-only, requires elevation) — not yet implemented
- `"compat"` — standard `std::fs::read_dir` recursive traversal (current implementation)
