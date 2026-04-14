import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { revealItemInDir, openPath } from "@tauri-apps/plugin-opener";
import type { FileEntry } from "../../types";

type SortKey = "name" | "size" | "type" | "date";
type SortDir = "asc" | "desc";

interface Props {
  files: FileEntry[];
  onSelect: (file: FileEntry | null) => void;
  selectedPath: string | null;
}

function formatBytes(b: number): string {
  if (b < 1e6) return `${(b / 1e3).toFixed(0)} KB`;
  if (b < 1e9) return `${(b / 1e6).toFixed(1)} MB`;
  return `${(b / 1e9).toFixed(2)} GB`;
}

function formatDate(ms: number): string {
  if (!ms) return "—";
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const TYPE_ICON: Record<string, string> = {
  image: "image", video: "movie", audio: "music_note", document: "description",
  archive: "folder_zip", installer: "install_desktop", code: "code",
  database: "storage", design: "palette", model: "view_in_ar",
  font: "font_download", disk_image: "hard_drive", system: "settings",
  cache: "cached", unknown: "insert_drive_file",
};

const TYPE_LABEL: Record<string, string> = {
  image: "图片", video: "视频", audio: "音频", document: "文档",
  archive: "压缩包", installer: "安装包", code: "代码",
  database: "数据库", design: "设计", model: "3D/游戏",
  font: "字体", disk_image: "磁盘镜像", system: "系统",
  cache: "缓存", unknown: "未知",
};

const PAGE_SIZE = 200;

function openFile(path: string) {
  revealItemInDir(path).catch(() => openPath(path).catch(() => {}));
}

export default function SearchResultList({ files, onSelect, selectedPath }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("size");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const listRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<(HTMLButtonElement | null)[]>([]);

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir(key === "size" || key === "date" ? "desc" : "asc"); }
  }

  const sorted = useMemo(() => {
    const arr = [...files];
    arr.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name") cmp = a.name.localeCompare(b.name);
      else if (sortKey === "size") cmp = a.size - b.size;
      else if (sortKey === "type") cmp = a.fileType.localeCompare(b.fileType);
      else if (sortKey === "date") cmp = a.modifiedAt - b.modifiedAt;
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr.slice(0, PAGE_SIZE);
  }, [files, sortKey, sortDir]);

  // Derive focused index from selectedPath
  const focusedIdx = useMemo(
    () => sorted.findIndex((f) => f.path === selectedPath),
    [sorted, selectedPath]
  );

  // Scroll focused row into view
  useEffect(() => {
    if (focusedIdx >= 0) {
      rowRefs.current[focusedIdx]?.scrollIntoView({ block: "nearest" });
    }
  }, [focusedIdx]);

  // Reset row refs array size on sort change
  useEffect(() => {
    rowRefs.current = rowRefs.current.slice(0, sorted.length);
  }, [sorted.length]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (sorted.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = focusedIdx < sorted.length - 1 ? focusedIdx + 1 : 0;
      onSelect(sorted[next]);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const prev = focusedIdx > 0 ? focusedIdx - 1 : sorted.length - 1;
      onSelect(sorted[prev]);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (focusedIdx >= 0) openFile(sorted[focusedIdx].path);
    }
  }, [sorted, focusedIdx, onSelect]);

  function SortIcon({ k }: { k: SortKey }) {
    if (sortKey !== k) return <span className="material-symbols-outlined text-[12px] opacity-20">unfold_more</span>;
    return (
      <span className="material-symbols-outlined text-[12px] text-primary">
        {sortDir === "asc" ? "arrow_upward" : "arrow_downward"}
      </span>
    );
  }

  if (files.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center p-8">
        <span className="material-symbols-outlined text-4xl text-on-surface-variant/30">search_off</span>
        <p className="text-sm text-on-surface-variant/50">没有符合条件的文件</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden" onKeyDown={handleKeyDown} tabIndex={-1}>
      {/* Header */}
      <div className="flex items-center px-4 py-2 border-b border-outline-variant/10 bg-surface-container-low/60 shrink-0 gap-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/50">
          找到 {files.length.toLocaleString()} 个文件
          {files.length > PAGE_SIZE && `，显示前 ${PAGE_SIZE}`}
        </span>
        <span className="text-[10px] text-on-surface-variant/30 ml-1">· 单击选中 · 双击打开 · ↑↓ 切换 · ⏎ 打开</span>
        <div className="flex-1" />
        {(["name", "size", "type", "date"] as SortKey[]).map((k) => (
          <button
            key={k}
            onClick={() => handleSort(k)}
            className="flex items-center gap-0.5 px-2 py-1 rounded text-[10px] font-bold text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors"
          >
            {{ name: "名称", size: "大小", type: "类型", date: "修改时间" }[k]}
            <SortIcon k={k} />
          </button>
        ))}
      </div>

      {/* Rows */}
      <div ref={listRef} className="flex-1 overflow-y-auto outline-none">
        {sorted.map((f, idx) => {
          const isSelected = f.path === selectedPath;
          return (
            <button
              key={f.path}
              ref={(el) => { rowRefs.current[idx] = el; }}
              onClick={() => onSelect(isSelected ? null : f)}
              onDoubleClick={() => openFile(f.path)}
              title={`单击选中 · 双击在文件管理器打开\n${f.path}`}
              className={[
                "w-full flex items-center gap-3 px-4 py-2 transition-colors text-left group border-b border-outline-variant/5 outline-none",
                isSelected
                  ? "bg-primary/10 border-l-2 border-l-primary"
                  : "hover:bg-surface-container-high",
              ].join(" ")}
            >
              {/* Type icon */}
              <span className={[
                "material-symbols-outlined text-[18px] shrink-0 transition-colors",
                isSelected ? "text-primary" : "text-on-surface-variant/50 group-hover:text-primary",
              ].join(" ")}>
                {TYPE_ICON[f.fileType] ?? "insert_drive_file"}
              </span>

              {/* Name + path */}
              <div className="flex-1 min-w-0">
                <p className={[
                  "text-xs font-medium truncate leading-tight",
                  isSelected ? "text-primary font-bold" : "text-on-surface",
                ].join(" ")}>{f.name}</p>
                <p className="text-[10px] text-on-surface-variant/50 truncate mt-0.5 font-mono">{f.path}</p>
              </div>

              {/* Type badge */}
              <span className="text-[9px] font-bold uppercase tracking-wide text-on-surface-variant/40 shrink-0 hidden sm:block w-16 text-right">
                {TYPE_LABEL[f.fileType] ?? f.fileType}
              </span>

              {/* Date */}
              <span className="text-[10px] text-on-surface-variant/50 shrink-0 w-24 text-right hidden md:block">
                {formatDate(f.modifiedAt)}
              </span>

              {/* Size */}
              <span className={[
                "text-xs font-bold shrink-0 w-16 text-right",
                isSelected ? "text-primary" : "text-on-surface-variant",
              ].join(" ")}>
                {formatBytes(f.size)}
              </span>

              {/* Open hint (only on selected row) */}
              <span className={[
                "material-symbols-outlined text-[14px] shrink-0 transition-colors",
                isSelected ? "text-primary/60" : "text-on-surface-variant/15 group-hover:text-on-surface-variant/40",
              ].join(" ")}>
                open_in_new
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
