import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import ContextMenu from "../ui/ContextMenu";
import { useToast } from "../../hooks/useToast";
import { useT } from "../../hooks/useT";
import type { DuplicateCluster, FileEntry } from "../../types";

type KeepStrategy = "newest" | "oldest" | "manual";

interface Props {
  clusters: DuplicateCluster[] | null;
  status: "idle" | "scanning" | "cancelling" | "done";
  dupProgress: { phase: string; processed: number; total: number } | null;
  onScan: () => void;
  onCancel: () => void;
  onDeleted: (deletedPaths: Set<string>) => void;
}

function formatBytes(b: number) {
  if (b < 1e6) return `${(b / 1e3).toFixed(0)} KB`;
  if (b < 1e9) return `${(b / 1e6).toFixed(1)} MB`;
  return `${(b / 1e9).toFixed(2)} GB`;
}

interface CtxState { x: number; y: number; file: FileEntry }

export default function DuplicatesTab({ clusters, status, dupProgress, onScan, onCancel, onDeleted }: Props) {
  const { show: showToast, ToastContainer } = useToast();
  const t = useT();
  const [strategy, setStrategy] = useState<KeepStrategy>("newest");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // manual keep overrides: clusterId → path to keep
  const [manualKeep, setManualKeep] = useState<Record<string, string>>({});
  const [deleting, setDeleting] = useState(false);
  const [deleteProgress, setDeleteProgress] = useState<{ done: number; total: number } | null>(null);
  const [ctx, setCtx] = useState<CtxState | null>(null);

  if (status === "idle") {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-center px-8">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
          <span className="material-symbols-outlined text-primary text-3xl">file_copy</span>
        </div>
        <div>
          <p className="text-sm font-bold text-on-surface mb-1">{t.duplicates.emptyTitle}</p>
          <p className="text-xs text-on-surface-variant max-w-xs">
            {t.duplicates.emptyDesc}
          </p>
        </div>
        <button
          onClick={onScan}
          className="cta-gradient px-8 py-3 rounded-xl text-sm font-bold text-on-primary shadow-md flex items-center gap-2 active:scale-95 transition-all"
        >
          <span className="material-symbols-outlined text-[18px]">search</span>
          {t.duplicates.startScan}
        </button>
      </div>
    );
  }

  if (status === "scanning" || status === "cancelling") {
    const pct = dupProgress && dupProgress.total > 0
      ? Math.round((dupProgress.processed / dupProgress.total) * 100)
      : 0;
    const phaseLabel = status === "cancelling"
      ? t.duplicates.cancelling
      : dupProgress?.phase === "sizing"
      ? t.duplicates.phaseSizing
      : dupProgress?.phase === "quick_hash"
      ? t.duplicates.phaseQuickHash
      : dupProgress?.phase === "full_hash"
      ? t.duplicates.phaseFullHash
      : t.duplicates.hashing;
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-center px-8">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
          <span className="material-symbols-outlined text-primary text-3xl animate-spin" style={{ animationDuration: "2s" }}>
            autorenew
          </span>
        </div>
        <div>
          <p className="text-sm font-bold text-on-surface mb-1">{phaseLabel}</p>
          {dupProgress && dupProgress.total > 0 && status === "scanning" && (
            <p className="text-xs text-on-surface-variant">
              {dupProgress.processed.toLocaleString()} / {dupProgress.total.toLocaleString()} {t.duplicates.files}
            </p>
          )}
        </div>
        <div className="w-64 h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
          <div className="h-full bg-primary rounded-full transition-all duration-300" style={{ width: `${pct}%` }} />
        </div>
        {status === "scanning" && (
          <button
            onClick={onCancel}
            className="mt-2 px-5 py-2 rounded-lg text-xs font-semibold text-on-surface-variant hover:bg-surface-container-high transition-colors"
          >
            {t.duplicates.cancel}
          </button>
        )}
      </div>
    );
  }

  if (!clusters || clusters.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
        <span className="material-symbols-outlined text-4xl text-tertiary/60">check_circle</span>
        <p className="text-sm font-bold text-on-surface">{t.duplicates.noDuplicates}</p>
        <p className="text-xs text-on-surface-variant/60">{t.duplicates.noDuplicatesDesc}</p>
      </div>
    );
  }

  function getKeepPath(cluster: DuplicateCluster): string {
    if (strategy === "manual") return manualKeep[cluster.id] ?? cluster.suggestedKeep;
    if (strategy === "newest") return [...cluster.files].sort((a, b) => b.modifiedAt - a.modifiedAt)[0]?.path ?? cluster.suggestedKeep;
    return [...cluster.files].sort((a, b) => a.modifiedAt - b.modifiedAt)[0]?.path ?? cluster.suggestedKeep;
  }

  function toggleCluster(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const totalSelected = clusters.filter((c) => selected.has(c.id)).reduce((s, c) => s + c.reclaimable, 0);

  async function handleClean() {
    const toDelete = clusters!
      .filter((c) => selected.has(c.id))
      .flatMap((c) => {
        const keep = getKeepPath(c);
        return c.files.filter((f) => f.path !== keep).map((f) => f.path);
      });
    if (toDelete.length === 0) return;

    setDeleting(true);
    setDeleteProgress({ done: 0, total: toDelete.length });

    const BATCH = 20;
    const failed: string[] = [];
    let done = 0;

    try {
      for (let i = 0; i < toDelete.length; i += BATCH) {
        const batch = toDelete.slice(i, i + BATCH);
        const batchFailed = await invoke<string[]>("move_to_trash", { paths: batch });
        failed.push(...batchFailed);
        done += batch.length;
        setDeleteProgress({ done, total: toDelete.length });
      }

      const deletedSet = new Set(toDelete.filter((p) => !failed.includes(p)));
      onDeleted(deletedSet);
      setSelected(new Set());

      if (failed.length === 0) {
        showToast(t.duplicates.toastSuccess(deletedSet.size), "check_circle");
      } else {
        showToast(t.duplicates.toastFail(failed.length), "warning");
      }
    } finally {
      setDeleting(false);
      setDeleteProgress(null);
    }
  }

  function openCtx(e: React.MouseEvent, file: FileEntry) {
    e.preventDefault();
    e.stopPropagation();
    setCtx({ x: e.clientX, y: e.clientY, file });
  }

  return (
    <div className="px-8 py-6 pb-28">
      {/* Strategy + select-all row */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest shrink-0">{t.duplicates.keepStrategy}</p>
        {(["newest", "oldest", "manual"] as KeepStrategy[]).map((s) => (
          <button
            key={s}
            onClick={() => setStrategy(s)}
            className={[
              "px-3 py-1.5 rounded-full text-xs font-bold transition-all",
              strategy === s
                ? "bg-primary text-on-primary"
                : "bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest",
            ].join(" ")}
          >
            {s === "newest" ? t.duplicates.keepNewest : s === "oldest" ? t.duplicates.keepOldest : t.duplicates.keepManual}
          </button>
        ))}
        {clusters.length > 1 && (
          <button
            onClick={() => setSelected(selected.size === clusters.length ? new Set() : new Set(clusters.map((c) => c.id)))}
            className="ml-auto text-[10px] font-bold text-primary hover:underline"
          >
            {selected.size === clusters.length ? t.duplicates.deselectAll : t.duplicates.selectAll}
          </button>
        )}
      </div>

      {strategy === "manual" && (
        <p className="text-[10px] text-on-surface-variant/60 mb-4 bg-surface-container-low rounded-lg px-3 py-2">
          {t.duplicates.manualHint}
        </p>
      )}

      <div className="space-y-2">
        {clusters.map((cluster) => {
          const isExpanded = expanded === cluster.id;
          const isSelected = selected.has(cluster.id);
          const keepPath = getKeepPath(cluster);

          return (
            <div
              key={cluster.id}
              className={[
                "rounded-xl border overflow-hidden transition-all",
                isSelected ? "border-primary/40 bg-primary/5" : "border-outline-variant/10 bg-surface-container-lowest",
              ].join(" ")}
            >
              {/* Card header — click to expand */}
              <div
                className="flex items-center gap-3 p-4 cursor-pointer select-none"
                onClick={() => setExpanded(isExpanded ? null : cluster.id)}
              >
                {/* Circle checkbox */}
                <div
                  className="shrink-0 flex items-center justify-center w-10 h-10 -ml-2 -my-2 rounded-lg cursor-pointer hover:bg-surface-container-high transition-colors"
                  onClick={(e) => { e.stopPropagation(); toggleCluster(cluster.id); }}
                  title={isSelected ? t.duplicates.deselect : t.duplicates.selectGroup}
                >
                  <span className={[
                    "material-symbols-outlined text-[22px] transition-colors",
                    isSelected ? "text-primary" : "text-on-surface-variant/30 hover:text-on-surface-variant",
                  ].join(" ")}>
                    {isSelected ? "check_circle" : "radio_button_unchecked"}
                  </span>
                </div>

                {/* Icon */}
                <div className={[
                  "w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-colors",
                  isSelected ? "bg-primary/15 text-primary" : "bg-surface-container text-on-surface-variant",
                ].join(" ")}>
                  <span className="material-symbols-outlined text-[17px]">file_copy</span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-on-surface truncate leading-tight">
                    {cluster.files[0]?.name ?? "—"}
                  </p>
                  <p className="text-xs text-on-surface-variant mt-0.5">
                    {cluster.files.length} {t.duplicates.copies} · {formatBytes(cluster.fileSize)} {t.duplicates.each} ·{" "}
                    <span className="text-primary font-medium">{formatBytes(cluster.reclaimable)} {t.duplicates.reclaimable}</span>
                  </p>
                </div>

                {/* Expand indicator */}
                <span
                  className="material-symbols-outlined text-[18px] text-on-surface-variant/50 shrink-0 transition-transform"
                  style={{ transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)" }}
                >
                  expand_more
                </span>
              </div>

              {/* Expanded file list */}
              {isExpanded && (
                <div className="border-t border-outline-variant/10">
                  {cluster.files.map((f) => {
                    const willKeep = f.path === keepPath;
                    return (
                      <div
                        key={f.path}
                        onContextMenu={(e) => openCtx(e, f)}
                        onClick={() => {
                          if (strategy === "manual") {
                            setManualKeep((prev) => ({ ...prev, [cluster.id]: f.path }));
                          }
                        }}
                        className={[
                          "flex items-center gap-3 px-5 py-3 border-b border-outline-variant/5 last:border-0 transition-colors group",
                          willKeep ? "bg-tertiary/5" : "hover:bg-surface-container-high",
                          strategy === "manual" ? "cursor-pointer" : "",
                        ].join(" ")}
                      >
                        <span className={[
                          "material-symbols-outlined text-[16px] shrink-0 transition-colors",
                          willKeep ? "text-tertiary" : "text-on-surface-variant/25",
                        ].join(" ")}>
                          {willKeep ? "shield" : "delete_outline"}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-mono text-on-surface truncate">{f.path}</p>
                          <p className="text-[10px] text-on-surface-variant mt-0.5">
                            {formatBytes(f.size)} · {new Date(f.modifiedAt).toLocaleDateString("zh-CN")}
                          </p>
                        </div>
                        {willKeep
                          ? <span className="text-[10px] font-bold text-tertiary bg-tertiary/10 px-2 py-0.5 rounded-full shrink-0">{t.duplicates.keep}</span>
                          : <span className="text-[10px] font-bold text-error/60 shrink-0">{t.duplicates.delete}</span>
                        }
                        <button
                          onClick={(e) => { e.stopPropagation(); revealItemInDir(f.path).catch(() => {}); }}
                          title={t.duplicates.revealInExplorer}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 shrink-0"
                        >
                          <span className="material-symbols-outlined text-[14px] text-on-surface-variant/50 hover:text-primary transition-colors">open_in_new</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Floating action bar */}
      {selected.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 glass-panel px-8 py-4 rounded-2xl shadow-2xl border border-white/30 flex items-center gap-8 z-50">
          {deleting && deleteProgress ? (
            /* Progress state */
            <div className="flex items-center gap-5">
              <div>
                <p className="text-[10px] uppercase font-bold tracking-widest text-on-surface-variant">{t.duplicates.movingToTrash}</p>
                <p className="font-headline text-lg font-extrabold text-on-surface">
                  {deleteProgress.done} / {deleteProgress.total} {t.duplicates.files}
                </p>
              </div>
              <div className="w-40">
                <div className="h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-200"
                    style={{ width: `${Math.round((deleteProgress.done / deleteProgress.total) * 100)}%` }}
                  />
                </div>
                <p className="text-[10px] text-on-surface-variant/50 mt-1 text-right">
                  {Math.round((deleteProgress.done / deleteProgress.total) * 100)}%
                </p>
              </div>
            </div>
          ) : (
            /* Normal state */
            <>
              <div>
                <p className="text-[10px] uppercase font-bold tracking-widest text-on-surface-variant">{t.duplicates.selected}</p>
                <p className="font-headline text-lg font-extrabold text-on-surface">
                  {formatBytes(totalSelected)} · {selected.size} {t.duplicates.groups}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setSelected(new Set())}
                  className="px-5 py-2.5 rounded-lg text-sm font-semibold text-on-surface-variant hover:bg-surface-container-high transition-colors"
                >
                  {t.duplicates.cancel}
                </button>
                <button
                  onClick={handleClean}
                  className="cta-gradient px-7 py-2.5 rounded-lg text-sm font-bold text-on-primary shadow-lg shadow-primary/20 flex items-center gap-2 active:scale-95 duration-150"
                >
                  <span className="material-symbols-outlined text-[18px]">delete_sweep</span>
                  {t.duplicates.moveToTrash}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Context menu */}
      {ctx && (
        <ContextMenu
          x={ctx.x} y={ctx.y}
          onClose={() => setCtx(null)}
          items={[
            {
              label: t.duplicates.copyName,
              icon: "file_copy",
              onClick: () => { navigator.clipboard.writeText(ctx.file.name); showToast(t.duplicates.copiedName); },
            },
            {
              label: t.duplicates.copyPath,
              icon: "content_copy",
              onClick: () => { navigator.clipboard.writeText(ctx.file.path); showToast(t.duplicates.copiedPath); },
            },
            {
              label: t.duplicates.revealInExplorer,
              icon: "folder_open",
              onClick: () => revealItemInDir(ctx.file.path).catch(() => {}),
            },
          ]}
        />
      )}
      {ToastContainer}
    </div>
  );
}
