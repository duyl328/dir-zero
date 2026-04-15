import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import ContextMenu from "../ui/ContextMenu";
import { useToast } from "../../hooks/useToast";
import type { StructureAnalysisResult, StructureItem } from "../../analysis/structureAnalysis";

interface Props {
  data: StructureAnalysisResult;
  onRefresh: () => void;
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
            title={allSelected ? "取消全选" : "全选此类"}
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
              {severity === "safe" ? "安全" : "注意"}
            </span>
          </div>
          <p className="text-xs text-on-surface-variant leading-snug">{detail}</p>
          <p className="text-[10px] font-bold text-on-surface-variant/60 mt-1">
            {items.length.toLocaleString()} 个
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
                {allSelected ? "取消全选" : "全选"}
              </button>
              <span className="text-[10px] text-on-surface-variant/40">
                已选 {items.filter((i) => selected.has(i.path)).length} / {items.length}
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
                  className={[
                    "flex items-center gap-3 px-4 py-2 border-b border-outline-variant/5 last:border-0 transition-colors group",
                    canDelete && isItemSelected ? "bg-primary/5" : "hover:bg-surface-container-high",
                  ].join(" ")}
                >
                  {canDelete && (
                    <div
                      className="shrink-0 flex items-center justify-center w-5 h-5 cursor-pointer"
                      onClick={() => onToggleItem(item.path)}
                    >
                      <span className={[
                        "material-symbols-outlined text-[18px] transition-colors",
                        isItemSelected ? "text-primary" : "text-on-surface-variant/25 hover:text-on-surface-variant",
                      ].join(" ")}>
                        {isItemSelected ? "check_circle" : "radio_button_unchecked"}
                      </span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-on-surface truncate">{item.name}</p>
                    <p className="text-[10px] font-mono text-on-surface-variant/50 truncate">{item.path}</p>
                  </div>
                  <span className="text-[10px] text-on-surface-variant/40 shrink-0">{item.detail}</span>
                  <button
                    onClick={() => revealItemInDir(item.path).catch(() => {})}
                    title="在文件管理器中打开"
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

export default function StructureTab({ data, onRefresh }: Props) {
  const { show: showToast, ToastContainer } = useToast();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [ctx, setCtx] = useState<CtxState | null>(null);

  const totalIssues = data.emptyFolders.length + data.zeroByteFiles.length +
    data.pathIssues.length + data.singleChildChains.length + data.denseSmall.length;

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
    if (selected.size === 0) return;
    setDeleting(true);
    try {
      await invoke("move_to_trash", { paths: Array.from(selected) });
      setSelected(new Set());
      onRefresh();
    } finally {
      setDeleting(false);
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
        <p className="text-sm font-bold text-on-surface">未发现结构问题</p>
        <p className="text-xs text-on-surface-variant/60">目录结构整洁</p>
      </div>
    );
  }

  const cardProps = { selected, onToggleItem: toggleItem, onToggleAll: toggleAll, onCtx: openCtx };

  return (
    <div className="px-8 py-6 pb-28 space-y-2">
      <p className="text-xs text-on-surface-variant/60 mb-3">
        空文件夹和零字节文件可移到回收站；其他问题仅供参考。
      </p>

      <IssueCard icon="folder_off" label="空文件夹" severity="safe"
        detail="完全空的目录，无任何文件或子文件夹"
        items={data.emptyFolders} canDelete {...cardProps} />

      <IssueCard icon="draft" label="零字节文件" severity="safe"
        detail="大小为 0 字节的文件，通常是失败下载或崩溃残留"
        items={data.zeroByteFiles} canDelete {...cardProps} />

      <IssueCard icon="straighten" label="路径问题" severity="caution"
        detail="超长路径（>200 字符）或深层嵌套（>8 层），可能影响兼容性"
        items={data.pathIssues} {...cardProps} />

      <IssueCard icon="linear_scale" label="单子目录链" severity="caution"
        detail="连续只含一个子文件夹的目录链，形成冗余嵌套"
        items={data.singleChildChains} {...cardProps} />

      <IssueCard icon="grain" label="小文件过密" severity="caution"
        detail="文件数量极多但总体积小，可能是构建产物或缓存"
        items={data.denseSmall} {...cardProps} />

      {/* Floating action bar */}
      {selected.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 glass-panel px-8 py-4 rounded-2xl shadow-2xl border border-white/30 flex items-center gap-8 z-50">
          <div>
            <p className="text-[10px] uppercase font-bold tracking-widest text-on-surface-variant">已选中</p>
            <p className="font-headline text-lg font-extrabold text-on-surface">
              {selected.size.toLocaleString()} 个项目
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSelected(new Set())}
              className="px-5 py-2.5 rounded-lg text-sm font-semibold text-on-surface-variant hover:bg-surface-container-high transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleDelete} disabled={deleting}
              className="cta-gradient px-7 py-2.5 rounded-lg text-sm font-bold text-on-primary shadow-lg shadow-primary/20 flex items-center gap-2 active:scale-95 duration-150 disabled:opacity-60"
            >
              <span className="material-symbols-outlined text-[18px]">delete_sweep</span>
              {deleting ? "处理中…" : "移到回收站"}
            </button>
          </div>
        </div>
      )}

      {/* Context menu */}
      {ctx && (
        <ContextMenu
          x={ctx.x} y={ctx.y}
          onClose={() => setCtx(null)}
          items={[
            {
              label: "复制文件名",
              icon: "file_copy",
              onClick: () => { navigator.clipboard.writeText(ctx.item.name); showToast("已复制文件名"); },
            },
            {
              label: "复制完整路径",
              icon: "content_copy",
              onClick: () => { navigator.clipboard.writeText(ctx.item.path); showToast("已复制完整路径"); },
            },
            {
              label: "在文件管理器中打开",
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
