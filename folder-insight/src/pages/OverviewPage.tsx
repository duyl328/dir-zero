import { useAppStore } from "../store/appStore";
import TreemapCanvas from "../components/overview/TreemapCanvas";
import DirectoryTree from "../components/overview/DirectoryTree";
import DetailPanel from "../components/overview/DetailPanel";
import InsightPanel from "../components/overview/InsightPanel";
import SearchBar, { EMPTY_FILTERS, isFiltersActive, compileKeyword } from "../components/overview/SearchBar";
import SearchResultList from "../components/overview/SearchResultList";
import { useState, useEffect, useRef, useMemo } from "react";
import type { SlimFolderEntry, FolderChild, FileEntry } from "../types";
import type { SearchFilters } from "../components/overview/SearchBar";

function formatBytes(b: number) {
  if (b < 1e6) return `${(b / 1e3).toFixed(0)} KB`;
  if (b < 1e9) return `${(b / 1e6).toFixed(1)} MB`;
  return `${(b / 1e9).toFixed(2)} GB`;
}

// Find the path (stack) from root to the folder with the given path string
function findPathToFolder(node: SlimFolderEntry, targetPath: string): SlimFolderEntry[] | null {
  if (node.path === targetPath) return [node];
  for (const child of node.children) {
    const sub = findPathToFolder(child, targetPath);
    if (sub) return [node, ...sub];
  }
  return null;
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

export default function OverviewPage() {
  const { session, setScanStatus, partialTree, scanPartialProgress } = useAppStore();
  // Keep allFiles in a ref — don't subscribe reactively to avoid re-renders during chunk loading
  const allFilesRef = useRef<import("../types").FileEntry[] | null>(null);
  useEffect(() => {
    // Sync once on mount, then subscribe to future changes
    allFilesRef.current = useAppStore.getState().allFiles;
    return useAppStore.subscribe((s) => { allFilesRef.current = s.allFiles; });
  }, []);
  const filesLoading = useAppStore((s) => s.filesLoading);
  const result = session.result;
  const isScanning = session.status === "scanning";
  // During scanning use the live partial tree; after done use the final result tree
  const displayTree = result?.tree ?? partialTree;
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
  const [treemapStack, setTreemapStack] = useState<SlimFolderEntry[]>(displayTree ? [displayTree] : []);

  // Reset stack when a new scan starts (partialTree goes from null → first partial)
  // or when the final result arrives
  useEffect(() => {
    if (displayTree && treemapStack.length === 0) {
      setTreemapStack([displayTree]);
      setSelected(null);
    }
  }, [displayTree]);

  // When final result arrives, reset to root
  useEffect(() => {
    if (result) {
      setTreemapStack([result.tree]);
      setSelected(null);
    }
  }, [result]);

  // Search / filter — reads allFiles from ref (not subscribed) to avoid re-renders during loading
  const searchActive = isFiltersActive(filters);
  const matchedFiles = useMemo(
    () => {
      if (!searchActive) return [];
      const files = allFilesRef.current;
      return files ? filterFiles(files, filters) : [];
    },
    // filesLoading included so results refresh when loading completes
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filters, searchActive, filesLoading]
  );
  const matchedPaths = useMemo(
    () => searchActive ? new Set(matchedFiles.map((f) => f.path)) : undefined,
    [searchActive, matchedFiles]
  );

  // Single-click a search result: select it and navigate treemap to its parent folder
  function handleResultSelect(file: FileEntry | null) {
    if (!file) { setSelected(null); return; }
    setSelected({ kind: "file", ...file });
    if (!displayTree) return;
    const sep = file.path.includes("\\") ? "\\" : "/";
    const parentPath = file.path.substring(0, file.path.lastIndexOf(sep));
    const path = findPathToFolder(displayTree, parentPath);
    if (path) setTreemapStack(path);
  }

  // TypeBar stats from precomputed data (no collectFiles needed)
  const typeStats = useMemo(() => {
    if (!result) return [];
    const total = result.totalSize;
    return result.stats.typeStats
      .filter((s) => s.size > 0)
      .map((s) => ({
        type: s.fileType,
        label: TYPE_META[s.fileType]?.label ?? s.fileType,
        color: TYPE_META[s.fileType]?.color ?? "#a9b4b9",
        pct: total > 0 ? ((s.size / total) * 100).toFixed(1) + "%" : "0%",
        pctNum: total > 0 ? (s.size / total) * 100 : 0,
        size: s.size,
      }));
  }, [result]);

  // Unknown ext breakdown from precomputed data
  const unknownExtStats = useMemo(() => {
    if (!result) return { total: 0, exts: [] as [string, number][] };
    const unknownStat = result.stats.typeStats.find((s) => s.fileType === "unknown");
    const total = unknownStat?.size ?? 0;
    const exts = result.stats.unknownExtStats.map(([ext, sz]) => [
      ext ? `.${ext.toLowerCase()}` : "(no ext)",
      sz,
    ] as [string, number]);
    return { total, exts };
  }, [result]);

  // Called when user clicks a node in the directory tree
  function handleTreeSelect(child: FolderChild) {
    setSelected(child);
    if (child.kind === "folder" && displayTree) {
      const path = findPathToFolder(displayTree, child.path);
      if (path) setTreemapStack(path);
    }
  }

  // 空状态：尚未扫描且没有部分数据
  if (!displayTree && !isScanning) {
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

  // 扫描中但还没有任何部分数据
  if (!displayTree && isScanning) {
    const progress = session.progress;
    const pct = scanPartialProgress && scanPartialProgress.total > 0
      ? Math.round((scanPartialProgress.completed / scanPartialProgress.total) * 100)
      : null;
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-8 py-24 select-none">
        <div className="relative w-20 h-20 mb-8">
          <div className="absolute inset-0 rounded-full border-4 border-primary/20" />
          <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="material-symbols-outlined text-primary text-[28px]">radar</span>
          </div>
        </div>
        <p className="font-headline text-lg font-extrabold text-on-surface mb-1">正在扫描…</p>
        <p className="text-sm text-on-surface-variant mb-4">{session.roots.join(", ")}</p>
        {progress && (
          <p className="text-xs text-on-surface-variant/60 mb-4">
            {progress.filesFound.toLocaleString()} 个文件 · {(progress.totalSize / 1e9).toFixed(1)} GB
          </p>
        )}
        <div className="w-64 h-1.5 bg-primary/15 rounded-full overflow-hidden">
          {pct !== null ? (
            <div
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          ) : (
            <div className="h-full w-1/3 bg-primary/60 rounded-full animate-pulse" />
          )}
        </div>
        {pct !== null && (
          <p className="text-xs font-bold text-primary mt-2">{pct}%</p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Scanning progress banner — shown while scan is in progress */}
      {isScanning && (() => {
        const progress = session.progress;
        const filesFound = progress?.filesFound ?? 0;
        const pct = scanPartialProgress && scanPartialProgress.total > 0
          ? Math.round((scanPartialProgress.completed / scanPartialProgress.total) * 100)
          : null;
        return (
          <div className="px-4 pt-2 pb-1.5 bg-primary/8 border-b border-primary/15 flex flex-col gap-1.5 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-3.5 h-3.5 rounded-full border-2 border-primary border-t-transparent animate-spin shrink-0" />
              <span className="text-xs font-bold text-primary">扫描中…</span>
              <span className="text-xs text-on-surface-variant">
                {filesFound.toLocaleString()} 个文件
                {progress ? ` · ${(progress.totalSize / 1e9).toFixed(1)} GB` : ""}
              </span>
              {pct !== null && (
                <span className="text-xs font-bold text-primary/80 ml-1">{pct}%</span>
              )}
              {progress?.currentPath && (
                <span className="text-[10px] font-mono text-on-surface-variant/50 truncate flex-1 min-w-0">
                  {progress.currentPath}
                </span>
              )}
            </div>
            <div className="h-1 bg-primary/15 rounded-full overflow-hidden">
              {pct !== null ? (
                <div
                  className="h-full bg-primary rounded-full transition-all duration-500"
                  style={{ width: `${pct}%` }}
                />
              ) : (
                <div className="h-full w-1/3 bg-primary/60 rounded-full animate-pulse" />
              )}
            </div>
          </div>
        );
      })()}

      {/* Stats + search bar */}
      <div className="px-4 py-2.5 bg-surface-container-low border-b border-outline-variant/10 flex items-center gap-2 shrink-0">
        {/* Stats group */}
        <div className="flex items-center gap-1 shrink-0">
          <StatCard icon="hard_drive" label="总大小" value={result ? formatBytes(result.totalSize) : formatBytes(displayTree?.size ?? 0)} />
          <StatCard icon="insert_drive_file" label="文件" value={result ? result.fileCount.toLocaleString() : (displayTree?.fileCount ?? 0).toLocaleString()} />
          <StatCard icon="folder" label="文件夹" value={result ? result.folderCount.toLocaleString() : (displayTree?.folderCount ?? 0).toLocaleString()} />
        </div>

        <div className="w-px h-8 bg-outline-variant/20 mx-1 shrink-0" />

        {/* Search bar — takes remaining space */}
        <SearchBar
          filters={filters}
          onChange={setFilters}
          onEnter={() => matchedFiles.length > 0 && handleResultSelect(matchedFiles[0])}
        />

        <div className="flex-1" />

        {result && result.issueCount > 0 && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-error/10 rounded-full shrink-0">
            <span className="material-symbols-outlined text-error text-[15px]">warning</span>
            <span className="text-xs font-bold text-error">{result.issueCount} issues</span>
          </div>
        )}

        {/* Rescan */}
        {!isScanning && (
          <button
            onClick={() => setScanStatus("configuring")}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-on-surface-variant hover:text-primary transition-all text-xs font-bold shrink-0"
            title="重新扫描"
          >
            <span className="material-symbols-outlined text-[15px]">refresh</span>
            重新扫描
          </button>
        )}

        {/* Color mode toggle — hidden during search */}
        {!searchActive && (
          <div className="flex items-center gap-0.5 bg-surface-container-high rounded-lg p-0.5 shrink-0">
            {(["type", "age"] as ColorMode[]).map((m) => (
              <button
                key={m}
                onClick={() => setColorMode(m)}
                className={[
                  "px-2.5 py-1 rounded text-xs font-bold transition-all",
                  colorMode === m
                    ? "bg-surface-container-lowest text-on-surface shadow-sm"
                    : "text-on-surface-variant hover:text-on-surface",
                ].join(" ")}
              >
                {m === "type" ? "按类型" : "按时间"}
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
            root={displayTree!}
            onSelect={handleTreeSelect}
            selected={selected}
            currentFolderPath={treemapStack[treemapStack.length - 1]?.path}
            onNavigateToRoot={() => { setTreemapStack([displayTree!]); setSelected(null); }}
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
            <>
              {filesLoading && (
                <div className="px-4 py-1.5 text-xs text-on-surface-variant/60 bg-surface-container-low border-b border-outline-variant/10 shrink-0">
                  正在加载文件列表…
                </div>
              )}
              <SearchResultList
                files={matchedFiles}
                onSelect={handleResultSelect}
                selectedPath={selected?.path ?? null}
              />
            </>
          ) : (
            <>
              {/* Breadcrumb path */}
              {treemapStack.length > 1 && (
                <div className="flex items-center gap-1 px-3 py-1.5 bg-surface-container-low/80 border-b border-outline-variant/10 shrink-0 overflow-x-auto">
                  {treemapStack.map((entry, i) => (
                    <span key={entry.path} className="flex items-center gap-1 shrink-0">
                      {i > 0 && <span className="material-symbols-outlined text-[12px] text-on-surface-variant/30">chevron_right</span>}
                      <button
                        onClick={() => setTreemapStack(treemapStack.slice(0, i + 1))}
                        className={[
                          "text-[11px] font-medium transition-colors px-1 py-0.5 rounded",
                          i === treemapStack.length - 1
                            ? "text-primary font-bold"
                            : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high",
                        ].join(" ")}
                      >
                        {i === 0 ? (entry.name || entry.path) : entry.name}
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <TreemapCanvas
                root={displayTree!}
                colorMode={colorMode}
                selected={selected}
                onSelect={setSelected}
                stack={treemapStack}
                onStackChange={setTreemapStack}
              />
              {result && <TypeBar stats={typeStats} unknownExts={unknownExtStats} />}
            </>
          )}
        </div>

        {/* Right: detail + insight */}
        <div className="w-72 shrink-0 border-l border-outline-variant/10 flex flex-col overflow-hidden">
          <DetailPanel node={selected} />
          {result && (
            <InsightPanel
              topFiles={result.stats.topFiles}
              oldFilesCount={result.stats.oldFilesCount}
              oldFilesSize={result.stats.oldFilesSize}
              totalSize={result.totalSize}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high transition-colors">
      <span className="material-symbols-outlined text-[16px] text-primary/70 shrink-0">{icon}</span>
      <div className="flex flex-col leading-none">
        <span className="text-[9px] uppercase tracking-widest font-bold text-on-surface-variant/50">{label}</span>
        <span className="text-sm font-bold text-on-surface mt-0.5">{value}</span>
      </div>
    </div>
  );
}

interface TypeBarStat { type: string; label: string; color: string; pct: string; pctNum: number; size: number }
interface UnknownExtStats { total: number; exts: [string, number][] }

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
