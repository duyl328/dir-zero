import { useAppStore } from "../store/appStore";
import TreemapCanvas from "../components/overview/TreemapCanvas";
import DirectoryTree from "../components/overview/DirectoryTree";
import DetailPanel from "../components/overview/DetailPanel";
import InsightPanel from "../components/overview/InsightPanel";
import SearchBar, { EMPTY_FILTERS, isFiltersActive, compileKeyword } from "../components/overview/SearchBar";
import SearchResultList from "../components/overview/SearchResultList";
import { useState, useEffect, useRef, useMemo } from "react";
import type { FolderEntry, FolderChild, FileEntry } from "../types";
import type { SearchFilters } from "../components/overview/SearchBar";

function formatBytes(b: number) {
  if (b < 1e6) return `${(b / 1e3).toFixed(0)} KB`;
  if (b < 1e9) return `${(b / 1e6).toFixed(1)} MB`;
  return `${(b / 1e9).toFixed(2)} GB`;
}

// Find the path (stack) from root to the folder with the given path string
function findPathToFolder(node: FolderEntry, targetPath: string): FolderEntry[] | null {
  if (node.path === targetPath) return [node];
  for (const child of node.children) {
    if (child.kind === "folder") {
      const sub = findPathToFolder(child, targetPath);
      if (sub) return [node, ...sub];
    }
  }
  return null;
}

// Recursively collect all file entries from the tree
function collectFiles(node: FolderEntry, out: FileEntry[] = []): FileEntry[] {
  for (const child of node.children) {
    if (child.kind === "file") out.push(child);
    else collectFiles(child, out);
  }
  return out;
}

const MS_30D = 30 * 24 * 60 * 60 * 1000;
const MS_1Y = 365 * 24 * 60 * 60 * 1000;

function filterFiles(files: FileEntry[], f: SearchFilters): FileEntry[] {
  const now = Date.now();
  const kw = compileKeyword(f);
  return files.filter((file) => {
    if (kw !== null) {
      const hayName = file.name;
      const hayPath = file.path;
      if (typeof kw === "string") {
        const hn = hayName.toLowerCase();
        const hp = hayPath.toLowerCase();
        if (!hn.includes(kw) && !hp.includes(kw)) return false;
      } else {
        if (!kw.test(hayName) && !kw.test(hayPath)) return false;
      }
    }
    if (f.types.length > 0 && !f.types.includes(file.fileType)) return false;
    if (f.minSize !== null && file.size < f.minSize) return false;
    const age = now - file.modifiedAt;
    if (f.modifiedWithin === "30d" && age > MS_30D) return false;
    if (f.modifiedWithin === "1y" && age > MS_1Y) return false;
    if (f.modifiedWithin === "older1y" && age <= MS_1Y) return false;
    return true;
  });
}

type ColorMode = "type" | "age";

export default function OverviewPage() {
  const { session, setScanStatus } = useAppStore();
  const result = session.result;
  const [colorMode, setColorMode] = useState<ColorMode>("type");
  const [selected, setSelected] = useState<FolderChild | null>(null);
  const [leftWidth, setLeftWidth] = useState(224);
  const [filters, setFilters] = useState<SearchFilters>(EMPTY_FILTERS);
  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartW = useRef(0);

  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!isDragging.current) return;
      const delta = e.clientX - dragStartX.current;
      setLeftWidth(Math.max(140, Math.min(400, dragStartW.current + delta)));
    }
    function onUp() { isDragging.current = false; }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, []);

  // Treemap drill-down stack — lifted here so tree and treemap stay in sync
  const [treemapStack, setTreemapStack] = useState<FolderEntry[]>(result ? [result.tree] : []);

  // Reset when scan result changes
  useEffect(() => {
    if (result) {
      setTreemapStack([result.tree]);
      setSelected(null);
    }
  }, [result]);

  // Compute real file stats from the tree
  const allFiles = useMemo(() => result ? collectFiles(result.tree) : [], [result]);

  // Search / filter
  const searchActive = isFiltersActive(filters);
  const matchedFiles = useMemo(
    () => searchActive ? filterFiles(allFiles, filters) : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allFiles, filters]
  );
  const matchedPaths = useMemo(
    () => searchActive ? new Set(matchedFiles.map((f) => f.path)) : undefined,
    [searchActive, matchedFiles]
  );

  const typeStats = useMemo(() => {
    if (!allFiles.length) return [];
    const totals: Record<string, number> = {};
    let total = 0;
    for (const f of allFiles) {
      totals[f.fileType] = (totals[f.fileType] ?? 0) + f.size;
      total += f.size;
    }
    const TYPE_META: Record<string, { label: string; color: string }> = {
      video:      { label: "Videos",     color: "#06b6d4" },
      installer:  { label: "Apps",       color: "#6366f1" },
      document:   { label: "Docs",       color: "#94a3b8" },
      image:      { label: "Images",     color: "#f59e0b" },
      code:       { label: "Code",       color: "#10b981" },
      archive:    { label: "Archives",   color: "#8b5cf6" },
      audio:      { label: "Audio",      color: "#ec4899" },
      database:   { label: "Database",   color: "#f97316" },
      design:     { label: "Design",     color: "#e879f9" },
      model:      { label: "3D/Game",    color: "#34d399" },
      font:       { label: "Fonts",      color: "#a78bfa" },
      disk_image: { label: "Disk Img",   color: "#fb7185" },
      system:     { label: "System",     color: "#64748b" },
      cache:      { label: "Cache",      color: "#6b7280" },
      unknown:    { label: "Unknown",    color: "#a9b4b9" },
    };
    return Object.entries(totals)
      .filter(([, sz]) => sz > 0)
      .sort(([, a], [, b]) => b - a)
      .map(([type, sz]) => ({
        type,
        label: TYPE_META[type]?.label ?? type,
        color: TYPE_META[type]?.color ?? "#a9b4b9",
        pct: total > 0 ? ((sz / total) * 100).toFixed(1) + "%" : "0%",
        pctNum: total > 0 ? (sz / total) * 100 : 0,
        size: sz,
      }));
  }, [allFiles]);

  // Per-extension breakdown for unknown files
  const unknownExtStats = useMemo(() => {
    const extTotals: Record<string, number> = {};
    let total = 0;
    for (const f of allFiles) {
      if (f.fileType !== "unknown") continue;
      const ext = f.ext ? `.${f.ext.toLowerCase()}` : "(no ext)";
      extTotals[ext] = (extTotals[ext] ?? 0) + f.size;
      total += f.size;
    }
    return { total, exts: Object.entries(extTotals).sort(([, a], [, b]) => b - a).slice(0, 8) };
  }, [allFiles]);

  // Called when user clicks a node in the directory tree
  function handleTreeSelect(child: FolderChild) {
    setSelected(child);
    // If it's a folder, navigate the treemap to show its contents
    if (child.kind === "folder" && result) {
      const path = findPathToFolder(result.tree, child.path);
      if (path) setTreemapStack(path);
    }
  }

  // 空状态：尚未扫描
  if (!result) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-8 py-24 select-none">
        <div className="w-24 h-24 rounded-3xl bg-primary/10 flex items-center justify-center mb-8 shadow-inner">
          <span className="material-symbols-outlined text-primary text-5xl">folder_open</span>
        </div>
        <h2 className="font-headline text-2xl font-extrabold text-on-surface mb-3">
          选择文件夹，开始分析
        </h2>
        <p className="text-on-surface-variant text-sm max-w-sm mb-8 leading-relaxed">
          点击下方按钮选择要分析的文件夹或盘符，查看空间占用分布，快速找到占用大户。
        </p>
        <button
          onClick={() => setScanStatus("configuring")}
          className="px-8 py-3 rounded-xl cta-gradient text-on-primary font-headline font-bold text-sm shadow-md hover:opacity-90 active:scale-95 transition-all flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          新建扫描
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Stats bar */}
      <div className="px-4 py-2 bg-surface-container-low border-b border-outline-variant/10 flex items-center gap-3 shrink-0 flex-wrap">
        <Stat label="Total Size" value={formatBytes(result.totalSize)} />
        <div className="w-px h-6 bg-outline-variant/30" />
        <Stat label="Files" value={result.fileCount.toLocaleString()} />
        <div className="w-px h-6 bg-outline-variant/30" />
        <Stat label="Folders" value={result.folderCount.toLocaleString()} />
        <div className="w-px h-6 bg-outline-variant/30" />
        {/* Search bar */}
        <SearchBar filters={filters} onChange={setFilters} />
        <div className="flex-1" />
        {result.issueCount > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-error/10 rounded-full">
            <span className="material-symbols-outlined text-error text-[16px]">warning</span>
            <span className="text-xs font-bold text-error">{result.issueCount} issues found</span>
          </div>
        )}
        {/* Rescan button */}
        <button
          onClick={() => setScanStatus("configuring")}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-on-surface-variant hover:text-primary transition-all text-xs font-bold"
          title="重新扫描"
        >
          <span className="material-symbols-outlined text-[16px]">refresh</span>
          重新扫描
        </button>
        {!searchActive && (
          <div className="flex items-center gap-1 bg-surface-container-high rounded-lg p-1">
            {(["type", "age"] as ColorMode[]).map((m) => (
              <button
                key={m}
                onClick={() => setColorMode(m)}
                className={[
                  "px-3 py-1 rounded text-xs font-bold transition-all capitalize",
                  colorMode === m
                    ? "bg-surface-container-lowest text-on-surface shadow-sm"
                    : "text-on-surface-variant hover:text-on-surface",
                ].join(" ")}
              >
                {m === "type" ? "By Type" : "By Age"}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Main area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: directory tree */}
        <div style={{ width: leftWidth }} className="shrink-0 overflow-y-auto bg-surface-container-low/40">
          <DirectoryTree
            root={result.tree}
            onSelect={handleTreeSelect}
            selected={selected}
            currentFolderPath={treemapStack[treemapStack.length - 1]?.path}
            onNavigateToRoot={() => { setTreemapStack([result.tree]); setSelected(null); }}
            matchedPaths={matchedPaths}
          />
        </div>

        {/* Drag handle */}
        <div
          onMouseDown={(e) => { isDragging.current = true; dragStartX.current = e.clientX; dragStartW.current = leftWidth; e.preventDefault(); }}
          className="w-1 shrink-0 cursor-col-resize bg-outline-variant/10 hover:bg-primary/40 transition-colors"
        />

        {/* Center: treemap or search results */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {searchActive ? (
            <SearchResultList files={matchedFiles} />
          ) : (
            <>
              <TreemapCanvas
                root={result.tree}
                colorMode={colorMode}
                selected={selected}
                onSelect={setSelected}
                stack={treemapStack}
                onStackChange={setTreemapStack}
              />
              <TypeBar stats={typeStats} unknownExts={unknownExtStats} />
            </>
          )}
        </div>

        {/* Right: detail + insight */}
        <div className="w-72 shrink-0 border-l border-outline-variant/10 flex flex-col overflow-hidden">
          <DetailPanel node={selected} />
          <InsightPanel allFiles={allFiles} totalSize={result.totalSize} />
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[9px] uppercase tracking-widest font-bold text-on-surface-variant/60">{label}</span>
      <span className="text-sm font-bold text-on-surface leading-tight">{value}</span>
      {sub && <span className="text-[10px] text-on-surface-variant">{sub}</span>}
    </div>
  );
}

interface TypeBarStat { type: string; label: string; color: string; pct: string; pctNum: number; size: number }
interface UnknownExtStats { total: number; exts: [string, number][] }

// Unknown is "large" if it contributes more than this share
const UNKNOWN_EXPAND_THRESHOLD = 15; // percent

function TypeBar({ stats, unknownExts }: { stats: TypeBarStat[]; unknownExts: UnknownExtStats }) {
  if (!stats.length) return null;
  const unknownStat = stats.find((s) => s.type === "unknown");
  const showUnknownDetail = (unknownStat?.pctNum ?? 0) >= UNKNOWN_EXPAND_THRESHOLD && unknownExts.exts.length > 0;

  return (
    <div className="bg-surface-container-highest border-t border-outline-variant/10 shrink-0">
      {/* Proportional colour bar */}
      <div className="flex h-1.5">
        {stats.map((s) => (
          <div key={s.type} style={{ flex: s.size, background: s.color }} title={`${s.label} ${s.pct}`} />
        ))}
      </div>

      {/* Legend row */}
      <div className="px-4 py-2 flex items-center gap-4 flex-wrap">
        {stats.map((s) => (
          <div key={s.type} className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: s.color }} />
            <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-tight">{s.label}</span>
            <span className="text-[10px] text-on-surface-variant/60">{s.pct}</span>
          </div>
        ))}
      </div>

      {/* Unknown breakdown — only shown when unknown is a large slice */}
      {showUnknownDetail && (
        <div className="px-4 pb-2.5 flex items-center gap-1 flex-wrap border-t border-outline-variant/10 pt-2">
          <span className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant/50 mr-1">Unknown 细分：</span>
          {unknownExts.exts.map(([ext, sz]) => {
            const pct = unknownExts.total > 0 ? ((sz / unknownExts.total) * 100).toFixed(0) : "0";
            return (
              <div key={ext} className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-container-high">
                <span className="text-[10px] font-mono font-bold text-on-surface-variant">{ext}</span>
                <span className="text-[9px] text-on-surface-variant/50">{pct}%</span>
              </div>
            );
          })}
          {unknownExts.exts.length === 8 && (
            <span className="text-[9px] text-on-surface-variant/40">…</span>
          )}
        </div>
      )}
    </div>
  );
}
