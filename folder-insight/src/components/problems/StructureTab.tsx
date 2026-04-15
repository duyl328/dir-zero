import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { StructureAnalysisResult, StructureItem } from "../../analysis/structureAnalysis";

interface Props {
  data: StructureAnalysisResult;
  onRefresh: () => void;
}

interface IssueCardProps {
  icon: string;
  label: string;
  count: number;
  detail: string;
  severity: "safe" | "caution";
  items: StructureItem[];
  canDelete?: boolean;
  onDelete?: (paths: string[]) => void;
}

function IssueCard({ icon, label, count, detail, severity, items, canDelete, onDelete }: IssueCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  if (count === 0) return null;

  function toggleAll() {
    setSelected(selected.size === items.length ? new Set() : new Set(items.map((i) => i.path)));
  }

  async function handleDelete() {
    if (selected.size === 0) return;
    setDeleting(true);
    try {
      await invoke("move_to_trash", { paths: Array.from(selected) });
      onDelete?.(Array.from(selected));
      setSelected(new Set());
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/10 overflow-hidden">
      <div className="flex items-center gap-4 p-4">
        <div className={[
          "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
          severity === "safe" ? "bg-secondary-container/60 text-secondary" : "bg-amber-100 text-amber-600",
        ].join(" ")}>
          <span className="material-symbols-outlined text-[18px]">{icon}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <p className="font-headline font-bold text-sm text-on-surface">{label}</p>
            <span className={[
              "text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-tight",
              severity === "safe" ? "bg-tertiary/10 text-tertiary" : "bg-amber-100 text-amber-700",
            ].join(" ")}>
              {severity === "safe" ? "安全" : "注意"}
            </span>
          </div>
          <p className="text-xs text-on-surface-variant">{detail}</p>
        </div>
        <span className="font-headline text-2xl font-extrabold text-on-surface shrink-0">{count.toLocaleString()}</span>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="p-1 text-on-surface-variant hover:text-on-surface transition-colors shrink-0"
        >
          <span className="material-symbols-outlined text-[18px]">
            {expanded ? "expand_less" : "expand_more"}
          </span>
        </button>
      </div>

      {expanded && (
        <div className="border-t border-outline-variant/10">
          {canDelete && (
            <div className="flex items-center gap-3 px-4 py-2 bg-surface-container-low/50 border-b border-outline-variant/10">
              <button onClick={toggleAll} className="text-[10px] font-bold text-primary hover:underline">
                {selected.size === items.length ? "取消全选" : "全选"}
              </button>
              {selected.size > 0 && (
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex items-center gap-1 px-3 py-1 rounded-lg bg-error/10 text-error text-[10px] font-bold hover:bg-error/20 transition-colors disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[13px]">delete_sweep</span>
                  移到回收站 ({selected.size})
                </button>
              )}
            </div>
          )}
          <div className="max-h-64 overflow-y-auto">
            {items.map((item) => (
              <div
                key={item.path}
                className={[
                  "flex items-center gap-3 px-4 py-2 border-b border-outline-variant/5 last:border-0",
                  canDelete && selected.has(item.path) ? "bg-primary/5" : "hover:bg-surface-container-high",
                ].join(" ")}
              >
                {canDelete && (
                  <input
                    type="checkbox"
                    checked={selected.has(item.path)}
                    onChange={() => setSelected((prev) => {
                      const next = new Set(prev);
                      next.has(item.path) ? next.delete(item.path) : next.add(item.path);
                      return next;
                    })}
                    className="w-3.5 h-3.5 rounded border-outline-variant text-primary focus:ring-primary/20 shrink-0"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-on-surface truncate">{item.name}</p>
                  <p className="text-[10px] font-mono text-on-surface-variant/50 truncate">{item.path}</p>
                </div>
                <span className="text-[10px] text-on-surface-variant/40 shrink-0">{item.detail}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function StructureTab({ data, onRefresh }: Props) {
  const totalIssues = data.emptyFolders.length + data.zeroByteFiles.length +
    data.pathIssues.length + data.singleChildChains.length + data.denseSmall.length;

  if (totalIssues === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
        <span className="material-symbols-outlined text-4xl text-tertiary/60">check_circle</span>
        <p className="text-sm font-bold text-on-surface">未发现结构问题</p>
        <p className="text-xs text-on-surface-variant/60">目录结构整洁</p>
      </div>
    );
  }

  return (
    <div className="px-8 py-6 space-y-3">
      <p className="text-xs text-on-surface-variant/60 mb-4">
        空文件夹和零字节文件可直接移到回收站；其他问题仅供参考。
      </p>
      <IssueCard
        icon="folder_off" label="空文件夹" severity="safe"
        count={data.emptyFolders.length}
        detail="完全空的目录，无任何文件或子文件夹"
        items={data.emptyFolders}
        canDelete onDelete={onRefresh}
      />
      <IssueCard
        icon="draft" label="零字节文件" severity="safe"
        count={data.zeroByteFiles.length}
        detail="大小为 0 字节的文件，通常是失败下载或崩溃残留"
        items={data.zeroByteFiles}
        canDelete onDelete={onRefresh}
      />
      <IssueCard
        icon="straighten" label="路径问题" severity="caution"
        count={data.pathIssues.length}
        detail="超长路径（>200 字符）或深层嵌套（>8 层），可能影响兼容性"
        items={data.pathIssues}
      />
      <IssueCard
        icon="linear_scale" label="单子目录链" severity="caution"
        count={data.singleChildChains.length}
        detail="连续只含一个子文件夹的目录链，形成冗余嵌套"
        items={data.singleChildChains}
      />
      <IssueCard
        icon="grain" label="小文件过密" severity="caution"
        count={data.denseSmall.length}
        detail="文件数量极多但总体积小，可能是构建产物或缓存"
        items={data.denseSmall}
      />
    </div>
  );
}
