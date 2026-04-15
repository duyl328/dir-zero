import { invoke } from "@tauri-apps/api/core";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { useMemo, useState, useCallback } from "react";
import { useAppStore } from "../store/appStore";
import type { FileEntry, FileTypeCategory } from "../types";

type PageTab = "types" | "age";
type SortKey = "size" | "count" | "name";

const TYPE_META: Record<FileTypeCategory, { label: string; icon: string; color: string }> = {
  video:      { label: "视频",     icon: "videocam",                 color: "#06b6d4" },
  image:      { label: "图片",     icon: "image",                    color: "#ec4899" },
  audio:      { label: "音频",     icon: "music_note",               color: "#a855f7" },
  document:   { label: "文档",     icon: "description",              color: "#f59e0b" },
  archive:    { label: "压缩包",   icon: "folder_zip",               color: "#8b5cf6" },
  installer:  { label: "安装包",   icon: "install_desktop",          color: "#3b82f6" },
  code:       { label: "代码",     icon: "code",                     color: "#10b981" },
  database:   { label: "数据库",   icon: "database",                 color: "#f97316" },
  design:     { label: "设计文件", icon: "palette",                  color: "#e879f9" },
  model:      { label: "3D 模型",  icon: "view_in_ar",               color: "#14b8a6" },
  font:       { label: "字体",     icon: "font_download",            color: "#84cc16" },
  disk_image: { label: "磁盘镜像", icon: "album",                    color: "#64748b" },
  system:     { label: "系统文件", icon: "settings_system_daydream", color: "#94a3b8" },
  cache:      { label: "缓存",     icon: "cached",                   color: "#6b7280" },
  unknown:    { label: "未知",     icon: "help_outline",             color: "#a9b4b9" },
};

const NOW = Date.now();
const AGE_BUCKETS = [
  { label: "本周内",   color: "#0053db", maxAge: 7 * 86400_000 },
  { label: "本月内",   color: "#3b82f6", maxAge: 30 * 86400_000 },
  { label: "3 个月内", color: "#60a5fa", maxAge: 90 * 86400_000 },
  { label: "1 年内",   color: "#93c5fd", maxAge: 365 * 86400_000 },
  { label: "1–3 年",   color: "#f59e0b", maxAge: 3 * 365 * 86400_000 },
  { label: "3 年以上", color: "#ef4444", maxAge: Infinity },
];

function formatBytes(b: number) {
  if (b < 1e6) return `${(b / 1e3).toFixed(0)} KB`;
  if (b < 1e9) return `${(b / 1e6).toFixed(1)} MB`;
  return `${(b / 1e9).toFixed(2)} GB`;
}

function collectFiles(node: import("../types").FolderEntry, out: FileEntry[] = []): FileEntry[] {
  for (const child of node.children) {
    if (child.kind === "file") out.push(child);
    else collectFiles(child, out);
  }
  return out;
}

function topDirs(files: FileEntry[], n = 3): { dir: string; size: number }[] {
  const map = new Map<string, number>();
  for (const f of files) {
    const dir = f.path.replace(/[\\/][^\\/]+$/, "") || f.path;
    map.set(dir, (map.get(dir) ?? 0) + f.size);
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([dir, size]) => ({ dir, size }));
}

interface ExtRow { ext: string; size: number; count: number }

function buildExtBreakdown(files: FileEntry[]): ExtRow[] {
  const map = new Map<string, { size: number; count: number }>();
  for (const f of files) {
    const ext = f.ext ? `.${f.ext.toLowerCase()}` : "(无扩展名)";
    const cur = map.get(ext) ?? { size: 0, count: 0 };
    cur.size += f.size; cur.count += 1;
    map.set(ext, cur);
  }
  return [...map.entries()].map(([ext, { size, count }]) => ({ ext, size, count })).sort((a, b) => b.size - a.size);
}

interface TypeGroup { category: FileTypeCategory; totalSize: number; count: number; files: FileEntry[] }
interface AgeGroup  { label: string; color: string; totalSize: number; count: number; files: FileEntry[] }

function buildTypeGroups(files: FileEntry[]): TypeGroup[] {
  const map = new Map<FileTypeCategory, FileEntry[]>();
  for (const f of files) { const arr = map.get(f.fileType) ?? []; arr.push(f); map.set(f.fileType, arr); }
  return [...map.entries()]
    .map(([category, fs]) => ({ category, totalSize: fs.reduce((s, f) => s + f.size, 0), count: fs.length, files: [...fs].sort((a, b) => b.size - a.size) }))
    .sort((a, b) => b.totalSize - a.totalSize);
}

function buildAgeGroups(files: FileEntry[]): AgeGroup[] {
  const buckets = AGE_BUCKETS.map((b) => ({ ...b, totalSize: 0, count: 0, files: [] as FileEntry[] }));
  for (const f of files) {
    const age = NOW - f.modifiedAt;
    const bucket = buckets.find((b) => age <= b.maxAge) ?? buckets[buckets.length - 1];
    bucket.totalSize += f.size; bucket.count += 1; bucket.files.push(f);
  }
  for (const b of buckets) b.files.sort((a, c) => c.size - a.size);
  return buckets.filter((b) => b.count > 0).map(({ label, color, totalSize, count, files }) => ({ label, color, totalSize, count, files }));
}

// ── ExtBreakdown ─────────────────────────────────────────────────────────────

function ExtBreakdown({ files, color }: { files: FileEntry[]; color: string }) {
  const [showAll, setShowAll] = useState(false);
  const rows = buildExtBreakdown(files);
  const maxSize = rows[0]?.size ?? 1;
  const visible = showAll ? rows : rows.slice(0, 6);
  return (
    <div>
      <div className="space-y-1.5">
        {visible.map((r) => (
          <div key={r.ext} className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-on-surface-variant w-20 shrink-0 truncate">{r.ext}</span>
            <div className="flex-1 h-1 bg-surface-container-high rounded-full overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${(r.size / maxSize) * 100}%`, background: color }} />
            </div>
            <span className="text-[10px] text-on-surface-variant/60 w-14 text-right shrink-0">{formatBytes(r.size)}</span>
            <span className="text-[10px] text-on-surface-variant/40 w-10 text-right shrink-0">{r.count} 个</span>
          </div>
        ))}
      </div>
      {rows.length > 6 && (
        <button onClick={() => setShowAll((v) => !v)} className="mt-1.5 text-[10px] font-bold text-primary hover:underline">
          {showAll ? "收起" : `+${rows.length - 6} 种扩展名`}
        </button>
      )}
    </div>
  );
}

// ── FileList ─────────────────────────────────────────────────────────────────

function FileList({ files, selected, onToggle, limit = 8 }: { files: FileEntry[]; selected: Set<string>; onToggle: (p: string) => void; limit?: number }) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? files : files.slice(0, limit);
  return (
    <div>
      <div className="max-h-48 overflow-y-auto rounded-lg border border-outline-variant/10">
        {visible.map((f) => {
          const isSel = selected.has(f.path);
          return (
            <div key={f.path} onClick={() => onToggle(f.path)}
              className={["flex items-center gap-3 px-3 py-1.5 transition-colors group border-b border-outline-variant/5 last:border-0 cursor-pointer", isSel ? "bg-primary/5" : "hover:bg-surface-container-high"].join(" ")}
            >
              <span className={["material-symbols-outlined text-[16px] shrink-0 transition-colors", isSel ? "text-primary" : "text-on-surface-variant/25 group-hover:text-on-surface-variant"].join(" ")}>
                {isSel ? "check_circle" : "radio_button_unchecked"}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-on-surface truncate">{f.name}</p>
                <p className="text-[10px] font-mono text-on-surface-variant/50 truncate">{f.path}</p>
              </div>
              <span className="text-xs text-on-surface-variant/60 shrink-0">{formatBytes(f.size)}</span>
              <button onClick={(e) => { e.stopPropagation(); revealItemInDir(f.path).catch(() => {}); }}
                title="在文件管理器中打开" className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 shrink-0">
                <span className="material-symbols-outlined text-[14px] text-on-surface-variant/50 hover:text-primary transition-colors">open_in_new</span>
              </button>
            </div>
          );
        })}
      </div>
      {files.length > limit && (
        <button onClick={() => setShowAll((v) => !v)} className="mt-1.5 text-[10px] font-bold text-primary hover:underline">
          {showAll ? "收起" : `查看全部 ${files.length.toLocaleString()} 个文件`}
        </button>
      )}
    </div>
  );
}

// ── TypeCard ─────────────────────────────────────────────────────────────────

function TypeCard({ group, totalSize, selected, onToggle, onToggleAll }: {
  group: TypeGroup; totalSize: number; selected: Set<string>;
  onToggle: (p: string) => void; onToggleAll: (ps: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const meta = TYPE_META[group.category];
  const pct = totalSize > 0 ? (group.totalSize / totalSize) * 100 : 0;
  const paths = group.files.map((f) => f.path);
  const allSel = paths.length > 0 && paths.every((p) => selected.has(p));
  const anySel = paths.some((p) => selected.has(p));
  const dirs = topDirs(group.files);

  return (
    <div className={["bg-surface-container-lowest rounded-xl border overflow-hidden transition-all", anySel ? "border-primary/40 bg-primary/5" : "border-outline-variant/10"].join(" ")}>
      <div className="flex items-center gap-3 p-4">
        <div className="shrink-0 flex items-center justify-center w-10 h-10 -ml-2 -my-2 rounded-lg cursor-pointer hover:bg-surface-container-high transition-colors"
          onClick={() => onToggleAll(paths)} title={allSel ? "取消全选" : "全选此类"}>
          <span className={["material-symbols-outlined text-[22px] transition-colors", anySel ? "text-primary" : "text-on-surface-variant/30 hover:text-on-surface-variant"].join(" ")}>
            {allSel ? "check_circle" : anySel ? "indeterminate_check_box" : "radio_button_unchecked"}
          </span>
        </div>
        <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: meta.color + "20" }}>
          <span className="material-symbols-outlined text-[20px]" style={{ color: meta.color }}>{meta.icon}</span>
        </div>
        <button onClick={() => setOpen((v) => !v)} className="flex-1 min-w-0 text-left">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-sm font-semibold text-on-surface">{meta.label}</p>
            <div className="flex items-center gap-3">
              <span className="text-xs text-on-surface-variant">{group.count.toLocaleString()} 个</span>
              <span className="text-sm font-bold text-on-surface">{formatBytes(group.totalSize)}</span>
              <span className="text-xs font-bold text-on-surface-variant/60 w-10 text-right">{pct.toFixed(1)}%</span>
            </div>
          </div>
          <div className="w-full h-1.5 bg-surface-container-high rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: meta.color }} />
          </div>
        </button>
        <span onClick={() => setOpen((v) => !v)} className="material-symbols-outlined text-[18px] text-on-surface-variant shrink-0 transition-transform cursor-pointer"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}>expand_more</span>
      </div>
      {open && (
        <div className="border-t border-outline-variant/10 px-5 py-4 space-y-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60 mb-2">扩展名分布</p>
            <ExtBreakdown files={group.files} color={meta.color} />
          </div>
          {dirs.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60 mb-2">主要目录</p>
              <div className="space-y-1">
                {dirs.map((d) => (
                  <div key={d.dir} className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[13px] text-on-surface-variant/40">folder</span>
                    <p className="text-xs font-mono text-on-surface-variant truncate flex-1">{d.dir}</p>
                    <span className="text-[10px] text-on-surface-variant/50 shrink-0">{formatBytes(d.size)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">文件列表</p>
              <button onClick={() => onToggleAll(paths)} className="text-[10px] font-bold text-primary hover:underline">
                {allSel ? "取消全选" : "全选"}
              </button>
            </div>
            <FileList files={group.files} selected={selected} onToggle={onToggle} />
          </div>
        </div>
      )}
    </div>
  );
}

// ── AgeCard ──────────────────────────────────────────────────────────────────

function AgeCard({ group, totalSize, selected, onToggle, onToggleAll }: {
  group: AgeGroup; totalSize: number; selected: Set<string>;
  onToggle: (p: string) => void; onToggleAll: (ps: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const pct = totalSize > 0 ? (group.totalSize / totalSize) * 100 : 0;
  const paths = group.files.map((f) => f.path);
  const allSel = paths.length > 0 && paths.every((p) => selected.has(p));
  const anySel = paths.some((p) => selected.has(p));

  return (
    <div className={["bg-surface-container-lowest rounded-xl border overflow-hidden transition-all", anySel ? "border-primary/40 bg-primary/5" : "border-outline-variant/10"].join(" ")}>
      <div className="flex items-center gap-3 p-4">
        <div className="shrink-0 flex items-center justify-center w-10 h-10 -ml-2 -my-2 rounded-lg cursor-pointer hover:bg-surface-container-high transition-colors"
          onClick={() => onToggleAll(paths)}>
          <span className={["material-symbols-outlined text-[22px] transition-colors", anySel ? "text-primary" : "text-on-surface-variant/30 hover:text-on-surface-variant"].join(" ")}>
            {allSel ? "check_circle" : anySel ? "indeterminate_check_box" : "radio_button_unchecked"}
          </span>
        </div>
        <div className="w-3 h-3 rounded-full shrink-0" style={{ background: group.color }} />
        <button onClick={() => setOpen((v) => !v)} className="flex-1 min-w-0 text-left">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-sm font-semibold text-on-surface">{group.label}</p>
            <div className="flex items-center gap-3">
              <span className="text-xs text-on-surface-variant">{group.count.toLocaleString()} 个</span>
              <span className="text-sm font-bold text-on-surface">{formatBytes(group.totalSize)}</span>
              <span className="text-xs font-bold text-on-surface-variant/60 w-10 text-right">{pct.toFixed(1)}%</span>
            </div>
          </div>
          <div className="w-full h-1.5 bg-surface-container-high rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: group.color }} />
          </div>
        </button>
        <span onClick={() => setOpen((v) => !v)} className="material-symbols-outlined text-[18px] text-on-surface-variant shrink-0 transition-transform cursor-pointer"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}>expand_more</span>
      </div>
      {open && (
        <div className="border-t border-outline-variant/10 px-5 py-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">文件列表</p>
            <button onClick={() => onToggleAll(paths)} className="text-[10px] font-bold text-primary hover:underline">
              {allSel ? "取消全选" : "全选"}
            </button>
          </div>
          <FileList files={group.files} selected={selected} onToggle={onToggle} />
        </div>
      )}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function FileTypesPage() {
  const result = useAppStore((s) => s.session.result);
  const [activeTab, setActiveTab] = useState<PageTab>("types");
  const [sortBy, setSortBy] = useState<SortKey>("size");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deletedPaths, setDeletedPaths] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [deleteProgress, setDeleteProgress] = useState<{ done: number; total: number } | null>(null);

  const allFiles = useMemo(
    () => result ? collectFiles(result.tree).filter((f) => !deletedPaths.has(f.path)) : [],
    [result, deletedPaths]
  );
  const totalSize = useMemo(() => allFiles.reduce((s, f) => s + f.size, 0), [allFiles]);

  const typeGroups = useMemo(() => {
    const groups = buildTypeGroups(allFiles);
    if (sortBy === "count") return [...groups].sort((a, b) => b.count - a.count);
    if (sortBy === "name") return [...groups].sort((a, b) => TYPE_META[a.category].label.localeCompare(TYPE_META[b.category].label, "zh"));
    return groups;
  }, [allFiles, sortBy]);

  const ageGroups = useMemo(() => buildAgeGroups(allFiles), [allFiles]);

  const toggleItem = useCallback((path: string) => {
    setSelected((prev) => { const next = new Set(prev); next.has(path) ? next.delete(path) : next.add(path); return next; });
  }, []);

  const toggleAll = useCallback((paths: string[]) => {
    setSelected((prev) => {
      const next = new Set(prev);
      const allIn = paths.every((p) => next.has(p));
      if (allIn) paths.forEach((p) => next.delete(p)); else paths.forEach((p) => next.add(p));
      return next;
    });
  }, []);

  async function handleDelete() {
    const toDelete = Array.from(selected);
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
      const succeeded = new Set(toDelete.filter((p) => !failed.includes(p)));
      setDeletedPaths((prev) => new Set([...prev, ...succeeded]));
      setSelected((prev) => { const next = new Set(prev); succeeded.forEach((p) => next.delete(p)); return next; });
    } finally {
      setDeleting(false);
      setDeleteProgress(null);
    }
  }

  if (!result) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-8 py-24 select-none">
        <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center mb-6 shadow-inner">
          <span className="material-symbols-outlined text-primary text-4xl">category</span>
        </div>
        <h2 className="font-headline text-xl font-extrabold text-on-surface mb-2">先完成一次扫描</h2>
        <p className="text-sm text-on-surface-variant max-w-xs">请先在「透视」页面扫描文件夹，然后回到这里查看文件类型分布。</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-8 pt-6 pb-0 shrink-0">
        <div className="flex items-end justify-between mb-4">
          <div>
            <h2 className="font-headline text-2xl font-extrabold text-on-surface tracking-tight">文件类型</h2>
            <p className="text-sm text-on-surface-variant mt-1">{allFiles.length.toLocaleString()} 个文件 · {formatBytes(totalSize)}</p>
          </div>
          {activeTab === "types" && (
            <div className="flex items-center gap-1 bg-surface-container-low rounded-lg p-1">
              {(["size", "count", "name"] as SortKey[]).map((k) => (
                <button key={k} onClick={() => setSortBy(k)}
                  className={["px-3 py-1 rounded-md text-xs font-semibold transition-colors", sortBy === k ? "bg-surface text-on-surface shadow-sm" : "text-on-surface-variant hover:text-on-surface"].join(" ")}>
                  {{ size: "大小", count: "文件数", name: "名称" }[k]}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 border-b border-outline-variant/20">
          {([["types", "category", "按类型"], ["age", "schedule", "按时间"]] as const).map(([id, icon, label]) => (
            <button key={id} onClick={() => setActiveTab(id)}
              className={["flex items-center gap-2 px-5 py-2.5 text-sm font-semibold font-headline transition-all border-b-2 -mb-px", activeTab === id ? "border-primary text-primary" : "border-transparent text-on-surface-variant hover:text-on-surface"].join(" ")}>
              <span className="material-symbols-outlined text-[18px]">{icon}</span>{label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-6 pb-28 space-y-2">
        {activeTab === "types" ? (
          typeGroups.length === 0
            ? <p className="text-sm text-on-surface-variant/60 text-center py-12">无文件数据</p>
            : typeGroups.map((g) => <TypeCard key={g.category} group={g} totalSize={totalSize} selected={selected} onToggle={toggleItem} onToggleAll={toggleAll} />)
        ) : (
          ageGroups.length === 0
            ? <p className="text-sm text-on-surface-variant/60 text-center py-12">无文件数据</p>
            : <>
                <p className="text-xs text-on-surface-variant/60 mb-3">基于文件最后修改时间（mtime）。</p>
                {ageGroups.map((g) => <AgeCard key={g.label} group={g} totalSize={totalSize} selected={selected} onToggle={toggleItem} onToggleAll={toggleAll} />)}
              </>
        )}
      </div>

      {selected.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 glass-panel px-8 py-4 rounded-2xl shadow-2xl border border-white/30 flex items-center gap-8 z-50">
          {deleting && deleteProgress ? (
            <div className="flex items-center gap-5">
              <div>
                <p className="text-[10px] uppercase font-bold tracking-widest text-on-surface-variant">正在移到回收站</p>
                <p className="font-headline text-lg font-extrabold text-on-surface">{deleteProgress.done} / {deleteProgress.total} 个文件</p>
              </div>
              <div className="w-40">
                <div className="h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full transition-all duration-200"
                    style={{ width: `${Math.round((deleteProgress.done / deleteProgress.total) * 100)}%` }} />
                </div>
                <p className="text-[10px] text-on-surface-variant/50 mt-1 text-right">
                  {Math.round((deleteProgress.done / deleteProgress.total) * 100)}%
                </p>
              </div>
            </div>
          ) : (
            <>
              <div>
                <p className="text-[10px] uppercase font-bold tracking-widest text-on-surface-variant">已选中</p>
                <p className="font-headline text-lg font-extrabold text-on-surface">{selected.size.toLocaleString()} 个文件</p>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => setSelected(new Set())}
                  className="px-5 py-2.5 rounded-lg text-sm font-semibold text-on-surface-variant hover:bg-surface-container-high transition-colors">取消</button>
                <button onClick={handleDelete} disabled={deleting}
                  className="cta-gradient px-7 py-2.5 rounded-lg text-sm font-bold text-on-primary shadow-lg shadow-primary/20 flex items-center gap-2 active:scale-95 duration-150 disabled:opacity-60">
                  <span className="material-symbols-outlined text-[18px]">delete_sweep</span>移到回收站
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
