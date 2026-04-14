import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useAppStore } from "../../store/appStore";
import type { ScanResult, ScanProgress } from "../../types";

export default function ScanConfigModal() {
  const { session, setScanRoots, setScanStatus, setScanProgress, setScanResult, excludeRules, toggleExcludeRule, resetSession } = useAppStore();
  const [roots, setRoots] = useState<string[]>(session.roots);

  async function handleAddFolder() {
    try {
      const selected = await open({ directory: true, multiple: true, title: "选择要扫描的文件夹" });
      if (selected) {
        const paths = Array.isArray(selected) ? selected : [selected];
        setRoots((prev) => [...new Set([...prev, ...paths])]);
      }
    } catch {
      // dialog cancelled
    }
  }

  function handleRemoveRoot(path: string) {
    setRoots((prev) => prev.filter((r) => r !== path));
  }

  async function handleStartScan() {
    if (roots.length === 0) return;
    setScanRoots(roots);
    setScanStatus("scanning");

    // Listen for progress events from Rust
    const unlisten = await listen<ScanProgress>("scan-progress", (event) => {
      setScanProgress(event.payload);
    });

    try {
      const result = await invoke<ScanResult>("scan_folder", {
        roots,
        excludeRules: excludeRules.filter((r) => r.enabled),
      });
      setScanResult(result);
    } catch (err) {
      console.error("Scan failed:", err);
      setScanStatus("idle");
    } finally {
      unlisten();
    }
  }

  function handleCancel() {
    resetSession();
  }

  const builtinGroups = [
    { label: "开发环境", ids: ["b-node_modules", "b-git", "b-pycache", "b-rust-target"] },
    { label: "虚拟机文件", ids: ["b-vmdk", "b-vhd"] },
    { label: "系统目录", ids: ["b-recycle", "b-sysvolinfo"] },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
      <div className="bg-surface-container-lowest rounded-2xl shadow-2xl border border-outline-variant/10 w-full max-w-2xl mx-4 overflow-hidden">
        {/* Header */}
        <div className="px-8 pt-8 pb-6 border-b border-outline-variant/10">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-headline text-xl font-extrabold text-on-surface">New Scan</h2>
              <p className="text-sm text-on-surface-variant mt-1">Select folders and configure scan options</p>
            </div>
            <button
              onClick={handleCancel}
              className="p-2 text-on-surface-variant hover:bg-surface-container-high rounded-lg transition-colors"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
        </div>

        <div className="px-8 py-6 space-y-6 max-h-[60vh] overflow-y-auto">
          {/* Scan targets */}
          <section>
            <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-3">
              Scan Targets
            </h3>
            <div className="space-y-2">
              {roots.map((r) => (
                <div
                  key={r}
                  className="flex items-center justify-between px-4 py-2.5 bg-surface-container-low rounded-lg group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="material-symbols-outlined text-primary text-[18px] shrink-0">folder</span>
                    <span className="text-sm font-medium text-on-surface truncate">{r}</span>
                  </div>
                  <button
                    onClick={() => handleRemoveRoot(r)}
                    className="text-on-surface-variant hover:text-error opacity-0 group-hover:opacity-100 transition-all ml-2 shrink-0"
                  >
                    <span className="material-symbols-outlined text-[18px]">remove_circle_outline</span>
                  </button>
                </div>
              ))}

              <button
                onClick={handleAddFolder}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-outline-variant/40 rounded-lg text-sm font-semibold text-on-surface-variant hover:border-primary/40 hover:text-primary hover:bg-primary/5 transition-all"
              >
                <span className="material-symbols-outlined text-[18px]">add</span>
                Add Folder
              </button>
            </div>
          </section>

          {/* Exclude rules */}
          <section>
            <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-3">
              Exclude Rules
            </h3>
            <div className="space-y-4">
              {builtinGroups.map((group) => (
                <div key={group.label}>
                  <p className="text-[11px] font-bold text-on-surface-variant/60 uppercase tracking-wider mb-2">
                    {group.label}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {group.ids.map((id) => {
                      const rule = excludeRules.find((r) => r.id === id);
                      if (!rule) return null;
                      return (
                        <button
                          key={id}
                          onClick={() => toggleExcludeRule(id)}
                          className={[
                            "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all",
                            rule.enabled
                              ? "bg-primary/10 text-primary border border-primary/20"
                              : "bg-surface-container-high text-on-surface-variant border border-transparent hover:border-outline-variant/30",
                          ].join(" ")}
                        >
                          {rule.enabled && (
                            <span className="material-symbols-outlined text-[14px]">check</span>
                          )}
                          {rule.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="px-8 py-5 border-t border-outline-variant/10 flex items-center justify-between bg-surface-container-low/50">
          <div className="flex items-center gap-2 text-xs text-on-surface-variant">
            <span className="material-symbols-outlined text-[16px] text-tertiary">bolt</span>
            <span>NTFS volumes will use MFT fast scan</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleCancel}
              className="px-5 py-2 rounded-lg text-sm font-semibold text-on-surface-variant hover:bg-surface-container-high transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleStartScan}
              disabled={roots.length === 0}
              className="px-6 py-2 rounded-lg cta-gradient text-on-primary text-sm font-bold shadow-md disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition-all"
            >
              Start Scan
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
