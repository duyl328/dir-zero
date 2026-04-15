import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { DuplicateCluster } from "../../types";

type KeepStrategy = "newest" | "oldest" | "manual";

interface Props {
  clusters: DuplicateCluster[] | null;
  status: "idle" | "scanning" | "done";
  dupProgress: { processed: number; total: number } | null;
  onScan: () => void;
}

function formatBytes(b: number) {
  if (b < 1e6) return `${(b / 1e3).toFixed(0)} KB`;
  if (b < 1e9) return `${(b / 1e6).toFixed(1)} MB`;
  return `${(b / 1e9).toFixed(2)} GB`;
}

export default function DuplicatesTab({ clusters, status, dupProgress, onScan }: Props) {
  const [strategy, setStrategy] = useState<KeepStrategy>("newest");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  if (status === "idle") {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-center px-8">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
          <span className="material-symbols-outlined text-primary text-3xl">file_copy</span>
        </div>
        <div>
          <p className="text-sm font-bold text-on-surface mb-1">检测重复文件</p>
          <p className="text-xs text-on-surface-variant max-w-xs">
            通过计算文件哈希值找出完全相同的文件。文件越多耗时越长，大文件夹可能需要几分钟。
          </p>
        </div>
        <button
          onClick={onScan}
          className="cta-gradient px-8 py-3 rounded-xl text-sm font-bold text-on-primary shadow-md flex items-center gap-2 active:scale-95 transition-all"
        >
          <span className="material-symbols-outlined text-[18px]">search</span>
          开始扫描重复文件
        </button>
      </div>
    );
  }

  if (status === "scanning") {
    const pct = dupProgress && dupProgress.total > 0
      ? Math.round((dupProgress.processed / dupProgress.total) * 100)
      : 0;
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-center px-8">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
          <span className="material-symbols-outlined text-primary text-3xl animate-spin" style={{ animationDuration: "2s" }}>
            autorenew
          </span>
        </div>
        <div>
          <p className="text-sm font-bold text-on-surface mb-1">正在计算哈希值…</p>
          {dupProgress && (
            <p className="text-xs text-on-surface-variant">
              {dupProgress.processed.toLocaleString()} / {dupProgress.total.toLocaleString()} 个文件
            </p>
          )}
        </div>
        <div className="w-64 h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    );
  }

  // done
  if (!clusters || clusters.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
        <span className="material-symbols-outlined text-4xl text-tertiary/60">check_circle</span>
        <p className="text-sm font-bold text-on-surface">未发现重复文件</p>
        <p className="text-xs text-on-surface-variant/60">所有文件内容唯一</p>
      </div>
    );
  }

  const totalSelected = clusters.filter((c) => selected.has(c.id)).reduce((s, c) => s + c.reclaimable, 0);

  function getFilesToDelete(cluster: DuplicateCluster): string[] {
    if (strategy === "newest") {
      const sorted = [...cluster.files].sort((a, b) => b.modifiedAt - a.modifiedAt);
      return sorted.slice(1).map((f) => f.path);
    }
    if (strategy === "oldest") {
      const sorted = [...cluster.files].sort((a, b) => a.modifiedAt - b.modifiedAt);
      return sorted.slice(1).map((f) => f.path);
    }
    // manual: delete all except suggestedKeep
    return cluster.files.filter((f) => f.path !== cluster.suggestedKeep).map((f) => f.path);
  }

  async function handleClean() {
    const paths = clusters!
      .filter((c) => selected.has(c.id))
      .flatMap((c) => getFilesToDelete(c));
    if (paths.length === 0) return;
    setDeleting(true);
    try {
      await invoke("move_to_trash", { paths });
      setSelected(new Set());
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="px-8 py-6">
      {/* Strategy selector */}
      <div className="flex items-center gap-3 mb-6">
        <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest shrink-0">保留策略：</p>
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
            {s === "newest" ? "保留最新" : s === "oldest" ? "保留最旧" : "手动选择"}
          </button>
        ))}
        <button
          onClick={() => setSelected(new Set())}
          className="ml-auto text-xs text-on-surface-variant/50 hover:text-on-surface-variant transition-colors"
        >
          取消全选
        </button>
      </div>

      <div className="space-y-3">
        {clusters.map((cluster) => {
          const isExpanded = expanded === cluster.id;
          const isSelected = selected.has(cluster.id);
          const toDelete = getFilesToDelete(cluster);

          return (
            <div key={cluster.id} className="bg-surface-container-lowest rounded-xl border border-outline-variant/10 overflow-hidden">
              <div className="flex items-center gap-4 p-4">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => setSelected((prev) => {
                    const next = new Set(prev);
                    next.has(cluster.id) ? next.delete(cluster.id) : next.add(cluster.id);
                    return next;
                  })}
                  className="w-4 h-4 rounded border-outline-variant text-primary focus:ring-primary/20 shrink-0"
                />
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-primary text-[18px]">file_copy</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-on-surface truncate">
                    {cluster.files[0]?.name ?? "—"}
                  </p>
                  <p className="text-xs text-on-surface-variant">
                    {cluster.files.length} 个副本 ·{" "}
                    <span className="text-primary font-medium">{formatBytes(cluster.reclaimable)} 可回收</span>
                  </p>
                </div>
                <button
                  onClick={() => setExpanded(isExpanded ? null : cluster.id)}
                  className="p-1 text-on-surface-variant hover:text-on-surface transition-colors shrink-0"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {isExpanded ? "expand_less" : "expand_more"}
                  </span>
                </button>
              </div>

              {isExpanded && (
                <div className="border-t border-outline-variant/10">
                  {cluster.files.map((f) => {
                    const willDelete = toDelete.includes(f.path);
                    return (
                      <div
                        key={f.path}
                        className={[
                          "flex items-center gap-4 px-6 py-3 border-b border-outline-variant/5 last:border-0",
                          !willDelete ? "bg-tertiary-container/20" : "hover:bg-surface-container-high",
                        ].join(" ")}
                      >
                        <span className={`material-symbols-outlined text-[16px] shrink-0 ${!willDelete ? "text-tertiary" : "text-on-surface-variant/30"}`}>
                          {!willDelete ? "shield" : "delete_outline"}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-mono text-on-surface truncate">{f.path}</p>
                          <p className="text-[10px] text-on-surface-variant">
                            {formatBytes(f.size)} · {new Date(f.modifiedAt).toLocaleDateString("zh-CN")}
                          </p>
                        </div>
                        {!willDelete
                          ? <span className="text-[10px] font-bold text-tertiary bg-tertiary/10 px-2 py-0.5 rounded-full shrink-0">保留</span>
                          : <span className="text-[10px] font-bold text-error/70 shrink-0">删除</span>
                        }
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {selected.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 glass-panel px-8 py-4 rounded-2xl shadow-2xl border border-white/30 flex items-center gap-8 z-50">
          <div>
            <p className="text-[10px] uppercase font-bold tracking-widest text-on-surface-variant">已选中</p>
            <p className="font-headline text-lg font-extrabold text-on-surface">
              {formatBytes(totalSelected)} · {selected.size} 组
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
              onClick={handleClean}
              disabled={deleting}
              className="cta-gradient px-7 py-2.5 rounded-lg text-sm font-bold text-on-primary shadow-lg shadow-primary/20 flex items-center gap-2 active:scale-95 duration-150 disabled:opacity-60"
            >
              <span className="material-symbols-outlined text-[18px]">delete_sweep</span>
              {deleting ? "处理中…" : "移到回收站"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
