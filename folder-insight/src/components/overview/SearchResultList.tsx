import { useState, useMemo } from "react";
import { revealItemInDir, openPath } from "@tauri-apps/plugin-opener";
import type { FileEntry } from "../../types";

type SortKey = "name" | "size" | "type" | "date";
type SortDir = "asc" | "desc";

interface Props {
  files: FileEntry[];
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

export default function SearchResultList({ files }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("size");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

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
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center px-4 py-2 border-b border-outline-variant/10 bg-surface-container-low/60 shrink-0 gap-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/50">
          找到 {files.length.toLocaleString()} 个文件
          {files.length > PAGE_SIZE && `，显示前 ${PAGE_SIZE}`}
        </span>
        <div className="flex-1" />
        {/* Sort buttons */}
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
      <div className="flex-1 overflow-y-auto">
        {sorted.map((f) => (
          <button
            key={f.path}
            onClick={() => revealItemInDir(f.path).catch(() => openPath(f.path).catch(() => {}))}
            title={f.path}
            className="w-full flex items-center gap-3 px-4 py-2 hover:bg-surface-container-high transition-colors text-left group border-b border-outline-variant/5"
          >
            {/* Type icon */}
            <span className="material-symbols-outlined text-[18px] shrink-0 text-on-surface-variant/50 group-hover:text-primary transition-colors">
              {TYPE_ICON[f.fileType] ?? "insert_drive_file"}
            </span>

            {/* Name + path */}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-on-surface truncate leading-tight">{f.name}</p>
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
            <span className="text-xs font-bold text-on-surface-variant shrink-0 w-16 text-right">
              {formatBytes(f.size)}
            </span>

            {/* Open icon */}
            <span className="material-symbols-outlined text-[14px] text-on-surface-variant/20 group-hover:text-primary transition-colors shrink-0">
              open_in_new
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
