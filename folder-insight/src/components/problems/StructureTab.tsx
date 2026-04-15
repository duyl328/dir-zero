import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import ContextMenu from "../ui/ContextMenu";
import { useToast } from "../../hooks/useToast";
import { useT } from "../../hooks/useT";
import type { StructureAnalysisResult, StructureItem } from "../../analysis/structureAnalysis";

interface Props {
  data: StructureAnalysisResult;
  onRefresh: () => void;
  onDeleted: (paths: Set<string>) => void;
  onDeleteStart: (total: number) => void;
  onDeleteComplete: (succeeded: number, failed: number) => void;
}

interface IssueCardProps {
  icon: string;
  label: string;
  detail: string;
  severity: "safe" | "caution";
  items: StructureItem[];
  canDelete?: boolean;
  // selection state lifted to parent for floating action bar
  selected: Set<string>;
  onToggleItem: (path: string) => void;
  onToggleAll: (paths: string[]) => void;
  onCtx: (e: React.MouseEvent, item: StructureItem) => void;
}

interface CtxState { x: number; y: number; item: StructureItem }

function IssueCard({ icon, label, detail, severity, items, canDelete, selected, onToggleItem, onToggleAll, onCtx }: IssueCardProps) {
  const t = useT();
  const [expanded, setExpanded] = useState(false);

  if (items.length === 0) return null;

  const allSelected = items.every((i) => selected.has(i.path));
  const anySelected = items.some((i) => selected.has(i.path));

  return (
    <div className={[
      "rounded-xl border overflow-hidden transition-all",
      canDelete && anySelected
        ? "border-primary/40 bg-primary/5"
        : "border-outline-variant/10 bg-surface-container-lowest",
    ].join(" ")}>
      {/* Header — whole row clicks to expand */}
      <div
        className="flex items-center gap-3 p-4 cursor-pointer select-none"
        onClick={() => setExpanded((v) => !v)}
      >
        {/* Selection circle — only for deletable cards */}
        {canDelete ? (
          <div
            className="shrink-0 flex items-center justify-center w-10 h-10 -ml-2 -my-2 rounded-lg cursor-pointer hover:bg-surface-container-high transition-colors"
            onClick={(e) => { e.stopPropagation(); onToggleAll(items.map((i) => i.path)); }}
            title={allSelected ? t.structure.deselectAll : t.structure.selectAll}
          >
            <span className={[
              "material-symbols-outlined text-[22px] transition-colors",
              anySelected ? "text-primary" : "text-on-surface-variant/30 hover:text-on-surface-variant",
            ].join(" ")}>
              {allSelected ? "check_circle" : anySelected ? "indeterminate_check_box" : "radio_button_unchecked"}
            </span>
          </div>
        ) : (
          /* Spacer so info aligns with deletable cards */
          <div className="shrink-0 w-6" />
        )}

        {/* Type icon */}
        <div className={[
          "w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-colors",
          severity === "safe"
            ? (anySelected ? "bg-primary/15 text-primary" : "bg-secondary-container/60 text-secondary")
            : "bg-amber-100 text-amber-600",
        ].join(" ")}>
          <span className="material-symbols-outlined text-[17px]">{icon}</span>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <p className="text-sm font-semibold text-on-surface leading-tight">{label}</p>
            <span className={[
              "text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-tight",
              severity === "safe" ? "bg-tertiary/10 text-tertiary" : "bg-amber-100 text-amber-700",
            ].join(" ")}>
              {severity === "safe" ? t.structure.safe : t.structure.caution}
            </span>
          </div>
          <p className="text-xs text-on-surface-variant leading-snug">{detail}</p>
          <p className="text-[10px] font-bold text-on-surface-variant/60 mt-1">
            {`${items.length.toLocaleString()}${t.structure.items}`}
          </p>
        </div>

        {/* Expand indicator */}
        <span
          className="material-symbols-outlined text-[18px] text-on-surface-variant/50 shrink-0 transition-transform"
          style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}
        >
          expand_more
        </span>
      </div>

      {/* Expanded item list */}
      {expanded && (
        <div className="border-t border-outline-variant/10">
          {canDelete && (
            <div className="flex items-center gap-3 px-4 py-2 bg-surface-container-low/50 border-b border-outline-variant/10">
              <button
                onClick={() => onToggleAll(items.map((i) => i.path))}
                className="text-[10px] font-bold text-primary hover:underline"
              >
                {allSelected ? t.structure.deselectAll : t.structure.selectAll}
              </button>
              <span className="text-[10px] text-on-surface-variant/40">
                {`${t.structure.selected} ${items.filter((i) => selected.has(i.path)).length} / ${items.length}`}
              </span>
            </div>
          )}
          <div className="max-h-64 overflow-y-auto">
            {items.map((item) => {
              const isItemSelected = selected.has(item.path);
              return (
                <div
                  key={item.path}
                  onContextMenu={(e) => onCtx(e, item)}
                  onClick={() => canDelete && onToggleItem(item.path)}
                  className={[
                    "flex items-center gap-3 px-4 py-2 border-b border-outline-variant/5 last:border-0 transition-colors group",
                    canDelete ? "cursor-pointer" : "",
                    canDelete && isItemSelected ? "bg-primary/5" : "hover:bg-surface-container-high",
                  ].join(" ")}
                >
                  {canDelete && (
                    <span className={[
                      "material-symbols-outlined text-[18px] shrink-0 transition-colors",
                      isItemSelected ? "text-primary" : "text-on-surface-variant/25 group-hover:text-on-surface-variant",
                    ].join(" ")}>
                      {isItemSelected ? "check_circle" : "radio_button_unchecked"}
                    </span>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-on-surface truncate">{item.name}</p>
                    <p className="text-[10px] font-mono text-on-surface-variant/50 truncate">{item.path}</p>
                  </div>
                  <span className="text-[10px] text-on-surface-variant/40 shrink-0">{item.detail}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); revealItemInDir(item.path).catch(() => {}); }}
                    title={t.structure.revealInExplorer}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 shrink-0"
                  >
                    <span className="material-symbols-outlined text-[14px] text-on-surface-variant/50 hover:text-primary transition-colors">open_in_new</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function StructureTab({ data, onRefresh, onDeleted, onDeleteStart, onDeleteComplete }: Props) {
  const t = useT();
  const { show: showToast, ToastContainer } = useToast();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [deleteProgress, setDeleteProgress] = useState<{ done: number; total: number } | null>(null);
  const [deletedPaths, setDeletedPaths] = useState<Set<string>>(new Set());
  const [ctx, setCtx] = useState<CtxState | null>(null);

  // Filter out already-deleted items from each category
  const filteredData = {
    emptyFolders: data.emptyFolders.filter((i) => !deletedPaths.has(i.path)),
    zeroByteFiles: data.zeroByteFiles.filter((i) => !deletedPaths.has(i.path)),
    pathIssues: data.pathIssues,
    singleChildChains: data.singleChildChains,
    denseSmall: data.denseSmall,
  };

  const totalIssues = filteredData.emptyFolders.length + filteredData.zeroByteFiles.length +
    filteredData.pathIssues.length + filteredData.singleChildChains.length + filteredData.denseSmall.length;

  function toggleItem(path: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(path) ? next.delete(path) : next.add(path);
      return next;
    });
  }

  function toggleAll(paths: string[]) {
    setSelected((prev) => {
      const next = new Set(prev);
      const allIn = paths.every((p) => next.has(p));
      if (allIn) paths.forEach((p) => next.delete(p));
      else paths.forEach((p) => next.add(p));
      return next;
    });
  }

  async function handleDelete() {
    const toDelete = Array.from(selected);
    if (toDelete.length === 0) return;

    setDeleting(true);
    setDeleteProgress({ done: 0, total: toDelete.length });
    onDeleteStart(toDelete.length);

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

      const succeeded = new Set(toDelete.filter((p) => !failed.includes(p)));
      setDeletedPaths((prev) => new Set([...prev, ...succeeded]));
      setSelected((prev) => {
        const next = new Set(prev);
        succeeded.forEach((p) => next.delete(p));
        return next;
      });
      onDeleted(succeeded);
      onDeleteComplete(succeeded.size, failed.length);
      onRefresh();
    } finally {
      setDeleting(false);
      setDeleteProgress(null);
    }
  }

  function openCtx(e: React.MouseEvent, item: StructureItem) {
    e.preventDefault();
    e.stopPropagation();
    setCtx({ x: e.clientX, y: e.clientY, item });
  }

  if (totalIssues === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
        <span className="material-symbols-outlined text-4xl text-tertiary/60">check_circle</span>
        <p className="text-sm font-bold text-on-surface">{t.structure.emptyTitle}</p>
        <p className="text-xs text-on-surface-variant/60">{t.structure.emptyDesc}</p>
      </div>
    );
  }

  const cardProps = { selected, onToggleItem: toggleItem, onToggleAll: toggleAll, onCtx: openCtx };

  return (
    <div className="px-8 py-6 pb-28 space-y-2">
      <p className="text-xs text-on-surface-variant/60 mb-3">
        {t.structure.hint}
      </p>

      <IssueCard icon="folder_off" label={t.structure.emptyFolders} severity="safe"
        detail={t.structure.emptyFoldersDesc}
        items={filteredData.emptyFolders} canDelete {...cardProps} />

      <IssueCard icon="draft" label={t.structure.zeroBytes} severity="safe"
        detail={t.structure.zeroBytesDesc}
        items={filteredData.zeroByteFiles} canDelete {...cardProps} />

      <IssueCard icon="straighten" label={t.structure.pathIssues} severity="caution"
        detail={t.structure.pathIssuesDesc}
        items={filteredData.pathIssues} {...cardProps} />

      <IssueCard icon="linear_scale" label={t.structure.singleChain} severity="caution"
        detail={t.structure.singleChainDesc}
        items={filteredData.singleChildChains} {...cardProps} />

      <IssueCard icon="grain" label={t.structure.denseSmall} severity="caution"
        detail={t.structure.denseSmallDesc}
        items={filteredData.denseSmall} {...cardProps} />

      {/* Floating action bar */}
      {selected.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 glass-panel px-8 py-4 rounded-2xl shadow-2xl border border-white/30 flex items-center gap-8 z-50">
          {deleting && deleteProgress ? (
            <div className="flex items-center gap-5">
              <div>
                <p className="text-[10px] uppercase font-bold tracking-widest text-on-surface-variant">{t.structure.movingToTrash}</p>
                <p className="font-headline text-lg font-extrabold text-on-surface">
                  {`${deleteProgress.done} / ${deleteProgress.total} ${t.structure.items}`}
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
            <>
              <div>
                <p className="text-[10px] uppercase font-bold tracking-widest text-on-surface-variant">{t.structure.selectedItems}</p>
                <p className="font-headline text-lg font-extrabold text-on-surface">
                  {`${selected.size.toLocaleString()} ${t.structure.items}`}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setSelected(new Set())}
                  className="px-5 py-2.5 rounded-lg text-sm font-semibold text-on-surface-variant hover:bg-surface-container-high transition-colors"
                >
                  {t.structure.cancel}
                </button>
                <button
                  onClick={handleDelete} disabled={deleting}
                  className="cta-gradient px-7 py-2.5 rounded-lg text-sm font-bold text-on-primary shadow-lg shadow-primary/20 flex items-center gap-2 active:scale-95 duration-150 disabled:opacity-60"
                >
                  <span className="material-symbols-outlined text-[18px]">delete_sweep</span>
                  {t.structure.moveToTrash}
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
              label: t.structure.copyName,
              icon: "file_copy",
              onClick: () => { navigator.clipboard.writeText(ctx.item.name); showToast(t.structure.copiedName); },
            },
            {
              label: t.structure.copyPath,
              icon: "content_copy",
              onClick: () => { navigator.clipboard.writeText(ctx.item.path); showToast(t.structure.copiedPath); },
            },
            {
              label: t.structure.revealInExplorer,
              icon: "folder_open",
              onClick: () => revealItemInDir(ctx.item.path).catch(() => {}),
            },
          ]}
        />
      )}
      {ToastContainer}
    </div>
  );
}
