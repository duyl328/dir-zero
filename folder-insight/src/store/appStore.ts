import { invoke } from "@tauri-apps/api/core";
import { create } from "zustand";
import type { ScanSession, ScanStatus, ScanProgress, SlimScanResult, SlimFolderEntry, FileEntry, FileChunk, ExcludeRule, DuplicateCluster } from "../types";
import type { Locale } from "../i18n";

type DupStatus = "idle" | "scanning" | "cancelling" | "done";
export type Theme = "light" | "dark";

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

interface AppState {
  session: ScanSession;
  excludeRules: ExcludeRule[];
  duplicatesResult: DuplicateCluster[] | null;
  duplicatesStatus: DupStatus;
  locale: Locale;
  theme: Theme;

  // Partial tree emitted during scanning (live preview)
  partialTree: SlimFolderEntry | null;
  scanPartialProgress: { completed: number; total: number } | null;

  // Lazy-loaded flat file list (background chunk loading after scan)
  allFiles: FileEntry[] | null;
  filesLoading: boolean;
  filesTotal: number;

  // Actions
  setScanRoots: (roots: string[]) => void;
  setScanStatus: (status: ScanStatus) => void;
  setScanProgress: (progress: ScanProgress) => void;
  setScanResult: (result: SlimScanResult) => void;
  setPartialTree: (tree: SlimFolderEntry, progress?: { completed: number; total: number }) => void;
  resetSession: () => void;
  toggleExcludeRule: (id: string) => void;
  addExcludeRule: (rule: ExcludeRule) => void;
  removeExcludeRule: (id: string) => void;
  setDuplicatesResult: (clusters: DuplicateCluster[]) => void;
  setDuplicatesStatus: (status: DupStatus) => void;
  setLocale: (locale: Locale) => void;
  setTheme: (theme: Theme) => void;
}

const defaultSession: ScanSession = {
  id: "",
  roots: [],
  status: "idle",
  progress: null,
  result: null,
  startedAt: null,
};

const builtinRules: ExcludeRule[] = [
  { id: "b-node_modules", pattern: "node_modules/", type: "glob", enabled: true, builtin: true, label: "node_modules" },
  { id: "b-git", pattern: ".git/", type: "glob", enabled: true, builtin: true, label: ".git 目录" },
  { id: "b-pycache", pattern: "__pycache__/", type: "glob", enabled: true, builtin: true, label: "Python 缓存" },
  { id: "b-rust-target", pattern: "target/", type: "glob", enabled: false, builtin: true, label: "Rust target/" },
  { id: "b-vmdk", pattern: "*.vmdk", type: "glob", enabled: false, builtin: true, label: "虚拟机磁盘 (.vmdk)" },
  { id: "b-vhd", pattern: "*.vhd", type: "glob", enabled: false, builtin: true, label: "虚拟机磁盘 (.vhd)" },
  { id: "b-recycle", pattern: "$RECYCLE.BIN", type: "path", enabled: true, builtin: true, label: "回收站" },
  { id: "b-sysvolinfo", pattern: "System Volume Information", type: "path", enabled: true, builtin: true, label: "系统卷信息" },
];

const CHUNK_SIZE = 50_000;

async function loadFilesInBackground(
  total: number,
  onDone: (files: FileEntry[]) => void,
) {
  const all: FileEntry[] = [];
  all.length = 0;
  let offset = 0;
  while (offset < total) {
    const chunk = await invoke<FileChunk>("get_files_chunk", { offset, limit: CHUNK_SIZE });
    if (chunk.files.length === 0) break;
    for (const f of chunk.files) all.push(f);
    offset += chunk.files.length;
  }
  onDone(all);
}

export const useAppStore = create<AppState>((set, _get) => {
  const savedTheme = (localStorage.getItem("theme") as Theme | null) ?? "light";
  applyTheme(savedTheme);

  return {
  session: defaultSession,
  excludeRules: builtinRules,
  duplicatesResult: null,
  duplicatesStatus: "idle",
  locale: (localStorage.getItem("locale") as Locale | null) ?? "zh",
  theme: savedTheme,
  partialTree: null,
  scanPartialProgress: null,
  allFiles: null,
  filesLoading: false,
  filesTotal: 0,

  setScanRoots: (roots) =>
    set((s) => ({ session: { ...s.session, roots } })),

  setScanStatus: (status) =>
    set((s) => ({
      session: {
        ...s.session,
        status,
        startedAt: status === "scanning" ? Date.now() : s.session.startedAt,
      },
    })),

  setScanProgress: (progress) =>
    set((s) => ({ session: { ...s.session, progress } })),

  setScanResult: (result) => {
    set((s) => ({
      session: { ...s.session, result, status: "done" },
      partialTree: null,
      scanPartialProgress: null,
      allFiles: null,
      filesLoading: true,
      filesTotal: result.fileCount,
    }));
    // Start background chunk loading — only one set() call when all done
    loadFilesInBackground(
      result.fileCount,
      (files) => set({ allFiles: files, filesLoading: false }),
    );
  },

  resetSession: () =>
    set({
      session: { ...defaultSession, id: crypto.randomUUID() },
      duplicatesResult: null,
      duplicatesStatus: "idle",
      partialTree: null,
      scanPartialProgress: null,
      allFiles: null,
      filesLoading: false,
      filesTotal: 0,
    }),

  toggleExcludeRule: (id) =>
    set((s) => ({
      excludeRules: s.excludeRules.map((r) =>
        r.id === id ? { ...r, enabled: !r.enabled } : r
      ),
    })),

  addExcludeRule: (rule) =>
    set((s) => ({ excludeRules: [...s.excludeRules, rule] })),

  removeExcludeRule: (id) =>
    set((s) => ({ excludeRules: s.excludeRules.filter((r) => r.id !== id) })),

  setDuplicatesResult: (clusters) =>
    set({ duplicatesResult: clusters, duplicatesStatus: "done" }),

  setDuplicatesStatus: (status) =>
    set({ duplicatesStatus: status }),

  setPartialTree: (tree, progress) =>
    set({ partialTree: tree, ...(progress ? { scanPartialProgress: progress } : {}) }),

  setLocale: (locale) => {
    localStorage.setItem("locale", locale);
    set({ locale });
  },

  setTheme: (theme) => {
    localStorage.setItem("theme", theme);
    applyTheme(theme);
    set({ theme });
  },
  };
});
