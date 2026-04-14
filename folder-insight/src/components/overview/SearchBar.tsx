import { useState, useRef, useEffect } from "react";
import type { FileTypeCategory } from "../../types";

export interface SearchFilters {
  keyword: string;
  useRegex: boolean;
  types: FileTypeCategory[];
  minSize: number | null; // bytes
  modifiedWithin: "30d" | "1y" | "older1y" | null;
}

export const EMPTY_FILTERS: SearchFilters = {
  keyword: "",
  useRegex: false,
  types: [],
  minSize: null,
  modifiedWithin: null,
};

export function isFiltersActive(f: SearchFilters): boolean {
  return f.keyword.trim() !== "" || f.types.length > 0 || f.minSize !== null || f.modifiedWithin !== null;
}

/** Returns null if the regex is invalid, otherwise the compiled RegExp */
export function compileKeyword(f: SearchFilters): RegExp | string | null {
  if (!f.keyword.trim()) return null;
  if (!f.useRegex) return f.keyword.trim().toLowerCase();
  try {
    return new RegExp(f.keyword, "i");
  } catch {
    return null; // invalid regex — treat as no match
  }
}

interface Props {
  filters: SearchFilters;
  onChange: (f: SearchFilters) => void;
}

const TYPE_OPTIONS: { value: FileTypeCategory; label: string }[] = [
  { value: "video",      label: "视频" },
  { value: "image",      label: "图片" },
  { value: "audio",      label: "音频" },
  { value: "document",   label: "文档" },
  { value: "archive",    label: "压缩包" },
  { value: "installer",  label: "安装包" },
  { value: "code",       label: "代码" },
  { value: "database",   label: "数据库" },
  { value: "design",     label: "设计" },
  { value: "model",      label: "3D/游戏" },
  { value: "font",       label: "字体" },
  { value: "disk_image", label: "磁盘镜像" },
  { value: "system",     label: "系统" },
  { value: "cache",      label: "缓存" },
  { value: "unknown",    label: "未知" },
];

const SIZE_OPTIONS = [
  { value: null,       label: "不限" },
  { value: 10_000_000,  label: "> 10 MB" },
  { value: 100_000_000, label: "> 100 MB" },
  { value: 500_000_000, label: "> 500 MB" },
  { value: 1_000_000_000, label: "> 1 GB" },
];

const TIME_OPTIONS: { value: SearchFilters["modifiedWithin"]; label: string }[] = [
  { value: null,       label: "不限" },
  { value: "30d",      label: "最近 30 天" },
  { value: "1y",       label: "最近 1 年" },
  { value: "older1y",  label: "超过 1 年未修改" },
];

export default function SearchBar({ filters, onChange }: Props) {
  const [typeOpen, setTypeOpen] = useState(false);
  const [sizeOpen, setSizeOpen] = useState(false);
  const [timeOpen, setTimeOpen] = useState(false);
  const typeRef = useRef<HTMLDivElement>(null);
  const sizeRef = useRef<HTMLDivElement>(null);
  const timeRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (typeRef.current && !typeRef.current.contains(e.target as Node)) setTypeOpen(false);
      if (sizeRef.current && !sizeRef.current.contains(e.target as Node)) setSizeOpen(false);
      if (timeRef.current && !timeRef.current.contains(e.target as Node)) setTimeOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const activeCount =
    (filters.types.length > 0 ? 1 : 0) +
    (filters.minSize !== null ? 1 : 0) +
    (filters.modifiedWithin !== null ? 1 : 0);

  function toggleType(t: FileTypeCategory) {
    const next = filters.types.includes(t)
      ? filters.types.filter((x) => x !== t)
      : [...filters.types, t];
    onChange({ ...filters, types: next });
  }

  const sizeLabel = SIZE_OPTIONS.find((o) => o.value === filters.minSize)?.label ?? "大小";
  const timeLabel = TIME_OPTIONS.find((o) => o.value === filters.modifiedWithin)?.label ?? "时间";
  const typesActive = filters.types.length > 0;

  return (
    <div className="flex items-center gap-2 flex-1 min-w-0">
      {/* Keyword input */}
      <div className="relative flex items-center flex-1 min-w-0 max-w-xs">
        <span className="material-symbols-outlined absolute left-2.5 text-[15px] text-on-surface-variant/50 pointer-events-none">
          search
        </span>
        <input
          type="text"
          value={filters.keyword}
          onChange={(e) => onChange({ ...filters, keyword: e.target.value })}
          placeholder={filters.useRegex ? "正则表达式…" : "搜索文件名 / 路径…"}
          className={[
            "w-full pl-8 py-1.5 rounded-lg bg-surface-container text-xs text-on-surface placeholder:text-on-surface-variant/40 outline-none focus:ring-1 transition-all",
            filters.useRegex ? "pr-16 focus:ring-amber-400/50 font-mono" : "pr-14 focus:ring-primary/50",
          ].join(" ")}
        />
        {/* Regex toggle */}
        <button
          onClick={() => onChange({ ...filters, useRegex: !filters.useRegex })}
          title={filters.useRegex ? "关闭正则" : "启用正则"}
          className={[
            "absolute right-6 flex items-center justify-center w-5 h-5 rounded text-[10px] font-bold font-mono transition-all",
            filters.useRegex
              ? "bg-amber-400/20 text-amber-500"
              : "text-on-surface-variant/30 hover:text-on-surface-variant",
          ].join(" ")}
        >
          .*
        </button>
        {filters.keyword && (
          <button
            onClick={() => onChange({ ...filters, keyword: "" })}
            className="absolute right-1 text-on-surface-variant/40 hover:text-on-surface-variant transition-colors"
          >
            <span className="material-symbols-outlined text-[14px]">close</span>
          </button>
        )}
      </div>

      {/* Type dropdown */}
      <div ref={typeRef} className="relative shrink-0">
        <button
          onClick={() => { setTypeOpen((v) => !v); setSizeOpen(false); setTimeOpen(false); }}
          className={[
            "flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all",
            typesActive
              ? "bg-primary/15 text-primary"
              : "bg-surface-container text-on-surface-variant hover:text-on-surface",
          ].join(" ")}
        >
          类型
          {typesActive && (
            <span className="w-4 h-4 rounded-full bg-primary text-on-primary text-[9px] flex items-center justify-center font-bold">
              {filters.types.length}
            </span>
          )}
          <span className="material-symbols-outlined text-[13px]">{typeOpen ? "expand_less" : "expand_more"}</span>
        </button>
        {typeOpen && (
          <div className="absolute top-full left-0 mt-1 z-50 bg-surface-container-highest border border-outline-variant/20 rounded-xl shadow-xl p-2 w-40">
            {TYPE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => toggleType(opt.value)}
                className={[
                  "w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors text-left",
                  filters.types.includes(opt.value)
                    ? "bg-primary/10 text-primary font-bold"
                    : "text-on-surface-variant hover:bg-surface-container-high",
                ].join(" ")}
              >
                {filters.types.includes(opt.value) && (
                  <span className="material-symbols-outlined text-[13px]">check</span>
                )}
                {!filters.types.includes(opt.value) && <span className="w-[13px]" />}
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Size dropdown */}
      <div ref={sizeRef} className="relative shrink-0">
        <button
          onClick={() => { setSizeOpen((v) => !v); setTypeOpen(false); setTimeOpen(false); }}
          className={[
            "flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all",
            filters.minSize !== null
              ? "bg-primary/15 text-primary"
              : "bg-surface-container text-on-surface-variant hover:text-on-surface",
          ].join(" ")}
        >
          {filters.minSize !== null ? sizeLabel : "大小"}
          <span className="material-symbols-outlined text-[13px]">{sizeOpen ? "expand_less" : "expand_more"}</span>
        </button>
        {sizeOpen && (
          <div className="absolute top-full left-0 mt-1 z-50 bg-surface-container-highest border border-outline-variant/20 rounded-xl shadow-xl p-2 w-36">
            {SIZE_OPTIONS.map((opt) => (
              <button
                key={String(opt.value)}
                onClick={() => { onChange({ ...filters, minSize: opt.value }); setSizeOpen(false); }}
                className={[
                  "w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors text-left",
                  filters.minSize === opt.value
                    ? "bg-primary/10 text-primary font-bold"
                    : "text-on-surface-variant hover:bg-surface-container-high",
                ].join(" ")}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Time dropdown */}
      <div ref={timeRef} className="relative shrink-0">
        <button
          onClick={() => { setTimeOpen((v) => !v); setTypeOpen(false); setSizeOpen(false); }}
          className={[
            "flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all",
            filters.modifiedWithin !== null
              ? "bg-primary/15 text-primary"
              : "bg-surface-container text-on-surface-variant hover:text-on-surface",
          ].join(" ")}
        >
          {filters.modifiedWithin !== null ? timeLabel : "时间"}
          <span className="material-symbols-outlined text-[13px]">{timeOpen ? "expand_less" : "expand_more"}</span>
        </button>
        {timeOpen && (
          <div className="absolute top-full left-0 mt-1 z-50 bg-surface-container-highest border border-outline-variant/20 rounded-xl shadow-xl p-2 w-44">
            {TIME_OPTIONS.map((opt) => (
              <button
                key={String(opt.value)}
                onClick={() => { onChange({ ...filters, modifiedWithin: opt.value }); setTimeOpen(false); }}
                className={[
                  "w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors text-left",
                  filters.modifiedWithin === opt.value
                    ? "bg-primary/10 text-primary font-bold"
                    : "text-on-surface-variant hover:bg-surface-container-high",
                ].join(" ")}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Clear all */}
      {activeCount > 0 && (
        <button
          onClick={() => onChange(EMPTY_FILTERS)}
          className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs text-on-surface-variant/60 hover:text-error hover:bg-error/10 transition-all shrink-0"
        >
          <span className="material-symbols-outlined text-[14px]">filter_alt_off</span>
          清除
        </button>
      )}
    </div>
  );
}
