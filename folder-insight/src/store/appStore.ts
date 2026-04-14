import { create } from "zustand";
import type { ScanSession, ScanStatus, ScanProgress, ScanResult, ExcludeRule } from "../types";

interface AppState {
  session: ScanSession;
  excludeRules: ExcludeRule[];

  // Actions
  setScanRoots: (roots: string[]) => void;
  setScanStatus: (status: ScanStatus) => void;
  setScanProgress: (progress: ScanProgress) => void;
  setScanResult: (result: ScanResult) => void;
  resetSession: () => void;
  toggleExcludeRule: (id: string) => void;
  addExcludeRule: (rule: ExcludeRule) => void;
  removeExcludeRule: (id: string) => void;
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

export const useAppStore = create<AppState>((set) => ({
  session: defaultSession,
  excludeRules: builtinRules,

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

  setScanResult: (result) =>
    set((s) => ({ session: { ...s.session, result, status: "done" } })),

  resetSession: () =>
    set({ session: { ...defaultSession, id: crypto.randomUUID() } }),

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
}));
