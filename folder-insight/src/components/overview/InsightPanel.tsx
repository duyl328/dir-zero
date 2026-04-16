import { openPath, revealItemInDir } from "@tauri-apps/plugin-opener";
import type { FileEntry } from "../../types";

interface Props {
  topFiles: FileEntry[];
  oldFilesCount: number;
  oldFilesSize: number;
  totalSize: number;
}

function formatBytes(b: number) {
  if (b < 1e6) return `${(b / 1e3).toFixed(0)} KB`;
  if (b < 1e9) return `${(b / 1e6).toFixed(1)} MB`;
  return `${(b / 1e9).toFixed(2)} GB`;
}

const TOP_N = 8;

export default function InsightPanel({ topFiles, oldFilesCount, oldFilesSize, totalSize }: Props) {
  const displayFiles = topFiles.slice(0, TOP_N);
  const oldPct = totalSize > 0 ? ((oldFilesSize / totalSize) * 100).toFixed(1) : "0";

  if (!displayFiles.length) {
    return (
      <div className="flex-1 flex items-center justify-center p-4 text-center">
        <p className="text-xs text-on-surface-variant/50">暂无数据</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto flex flex-col">
      {/* Old files banner */}
      <div className="mx-3 mt-3 mb-1 rounded-xl bg-amber-500/10 border border-amber-500/20 px-3 py-2.5 flex items-center gap-3">
        <span className="material-symbols-outlined text-amber-500 text-[20px] shrink-0">schedule</span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-on-surface">超过一年未修改</p>
          <p className="text-[10px] text-on-surface-variant mt-0.5">
            {oldFilesCount.toLocaleString()} 个文件 · {formatBytes(oldFilesSize)} · 占 {oldPct}%
          </p>
        </div>
      </div>

      {/* Top N large files */}
      <div className="px-3 pb-3 flex-1">
        <p className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant/50 pt-3 pb-2">
          最大文件 Top {TOP_N}
        </p>
        <div className="space-y-0.5">
          {displayFiles.map((f, i) => {
            const barW = displayFiles[0].size > 0 ? (f.size / displayFiles[0].size) * 100 : 0;
            return (
              <button
                key={f.path}
                onClick={() => revealItemInDir(f.path).catch(() => openPath(f.path).catch(() => {}))}
                title={f.path}
                className="w-full group flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-surface-container-high transition-colors text-left"
              >
                <span className="text-[10px] font-bold text-on-surface-variant/40 w-4 text-right shrink-0">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-on-surface truncate leading-tight">{f.name}</p>
                  <div className="mt-0.5 h-1 rounded-full bg-surface-container-highest overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary/50 group-hover:bg-primary transition-colors"
                      style={{ width: `${barW}%` }}
                    />
                  </div>
                </div>
                <span className="text-[10px] font-bold text-on-surface-variant shrink-0">{formatBytes(f.size)}</span>
                <span className="material-symbols-outlined text-[13px] text-on-surface-variant/30 group-hover:text-primary transition-colors shrink-0">
                  open_in_new
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
