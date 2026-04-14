import { useAppStore } from "../store/appStore";
import TreemapCanvas from "../components/overview/TreemapCanvas";
import DirectoryTree from "../components/overview/DirectoryTree";
import DetailPanel from "../components/overview/DetailPanel";
import InsightPanel from "../components/overview/InsightPanel";
import { useState, useEffect } from "react";
import type { FolderEntry, FolderChild } from "../types";

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

type ColorMode = "type" | "age";

export default function OverviewPage() {
  const { session, setScanStatus } = useAppStore();
  const result = session.result;
  const [colorMode, setColorMode] = useState<ColorMode>("type");
  const [selected, setSelected] = useState<FolderChild | null>(null);
  // Treemap drill-down stack — lifted here so tree and treemap stay in sync
  const [treemapStack, setTreemapStack] = useState<FolderEntry[]>(result ? [result.tree] : []);

  // Reset when scan result changes
  useEffect(() => {
    if (result) {
      setTreemapStack([result.tree]);
      setSelected(null);
    }
  }, [result]);

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
      <div className="px-6 py-3 bg-surface-container-low border-b border-outline-variant/10 flex items-center gap-6 shrink-0">
        <Stat label="Total Size" value={formatBytes(result.totalSize)} />
        <div className="w-px h-6 bg-outline-variant/30" />
        <Stat label="Files" value={result.fileCount.toLocaleString()} />
        <div className="w-px h-6 bg-outline-variant/30" />
        <Stat label="Folders" value={result.folderCount.toLocaleString()} />
        <div className="w-px h-6 bg-outline-variant/30" />
        <Stat label="Largest File" value={result.largestFile?.name ?? "—"} sub={result.largestFile ? formatBytes(result.largestFile.size) : ""} />
        <div className="flex-1" />
        {result.issueCount > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-error/10 rounded-full">
            <span className="material-symbols-outlined text-error text-[16px]">warning</span>
            <span className="text-xs font-bold text-error">{result.issueCount} issues found</span>
          </div>
        )}
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
      </div>

      {/* Main area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: directory tree */}
        <div className="w-56 shrink-0 border-r border-outline-variant/10 overflow-y-auto bg-surface-container-low/40">
          <DirectoryTree
            root={result.tree}
            onSelect={handleTreeSelect}
            selected={selected}
            currentFolderPath={treemapStack[treemapStack.length - 1]?.path}
            onNavigateToRoot={() => { setTreemapStack([result.tree]); setSelected(null); }}
          />
        </div>

        {/* Center: treemap */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <TreemapCanvas
            root={result.tree}
            colorMode={colorMode}
            selected={selected}
            onSelect={setSelected}
            stack={treemapStack}
            onStackChange={setTreemapStack}
          />
          <TypeBar />
        </div>

        {/* Right: detail + insight */}
        <div className="w-72 shrink-0 border-l border-outline-variant/10 flex flex-col overflow-hidden">
          <DetailPanel node={selected} />
          <InsightPanel issueCount={result.issueCount} />
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

const TYPE_COLORS: [string, string, string][] = [
  ["Videos", "#06b6d4", "22%"],
  ["Apps", "#6366f1", "19%"],
  ["Documents", "#94a3b8", "12%"],
  ["Images", "#f59e0b", "18%"],
  ["Code", "#10b981", "9%"],
  ["Archives", "#8b5cf6", "7%"],
  ["Other", "#a9b4b9", "13%"],
];

function TypeBar() {
  return (
    <div className="h-10 bg-surface-container-highest px-4 flex items-center gap-4 shrink-0 border-t border-outline-variant/10">
      {TYPE_COLORS.map(([label, color, pct]) => (
        <button key={label} className="flex items-center gap-1.5 hover:opacity-80 transition-opacity">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
          <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-tight">{label}</span>
          <span className="text-[10px] text-on-surface-variant/60">{pct}</span>
        </button>
      ))}
    </div>
  );
}
