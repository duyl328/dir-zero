import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useAppStore } from "../store/appStore";
import DuplicatesTab from "../components/problems/DuplicatesTab";
import StructureTab from "../components/problems/StructureTab";
import ResidueTab from "../components/problems/ResidueTab";
import { analyzeStructure } from "../analysis/structureAnalysis";
import { analyzeResidue, BUILTIN_RESIDUE_RULES, storedRuleToRuleDef } from "../analysis/residueAnalysis";
import { useCustomResidueRules } from "../hooks/useCustomResidueRules";
import { useToast } from "../hooks/useToast";
import type { FileEntry, RawDuplicateCluster, DuplicateCluster } from "../types";

type Tab = "duplicates" | "structure" | "residue";

function collectFiles(node: import("../types").FolderEntry, out: FileEntry[] = []): FileEntry[] {
  for (const child of node.children) {
    if (child.kind === "file") out.push(child);
    else collectFiles(child, out);
  }
  return out;
}

function formatBytes(b: number) {
  if (b < 1e6) return `${(b / 1e3).toFixed(0)} KB`;
  if (b < 1e9) return `${(b / 1e6).toFixed(1)} MB`;
  return `${(b / 1e9).toFixed(2)} GB`;
}

export default function FindProblemsPage() {
  const { session, duplicatesResult, duplicatesStatus, setDuplicatesResult, setDuplicatesStatus } = useAppStore();
  const result = session.result;
  const [tab, setTab] = useState<Tab>("residue");
  const [dupProgress, setDupProgress] = useState<{ processed: number; total: number } | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [deletedPaths, setDeletedPaths] = useState<Set<string>>(new Set());
  const { rules: customRules, addRule, removeRule, toggleEnabled } = useCustomResidueRules();
  const cancelledRef = useRef(false);
  const { show: showToast, ToastContainer } = useToast();
  // Track in-progress deletions per tab for the tab-button indicator
  const [activeDeletes, setActiveDeletes] = useState<Set<Tab>>(new Set());

  const markDeleteStart = useCallback((tabId: Tab) =>
    setActiveDeletes((prev) => new Set([...prev, tabId])), []);

  const markDeleteComplete = useCallback((tabId: Tab, label: string, succeeded: number, failed: number) => {
    setActiveDeletes((prev) => { const next = new Set(prev); next.delete(tabId); return next; });
    if (failed === 0) {
      showToast(`${label}：已移到回收站 ${succeeded} 个`, "check_circle");
    } else {
      showToast(`${label}：完成，${failed} 个失败`, "warning");
    }
  }, [showToast]);

  // Reset per-session state when a new scan starts
  const prevSessionId = useRef(session.id);
  useEffect(() => {
    if (session.id !== prevSessionId.current) {
      prevSessionId.current = session.id;
      setRefreshKey(0);
      setDeletedPaths(new Set());
      setDupProgress(null);
    }
  }, [session.id]);

  const allFiles = useMemo(
    () => result ? collectFiles(result.tree).filter((f) => !deletedPaths.has(f.path)) : [],
    [result, refreshKey, deletedPaths]
  );

  const structureData = useMemo(
    () => result ? analyzeStructure(result.tree) : null,
    [result, refreshKey]
  );

  const residueGroups = useMemo(
    () => analyzeResidue(allFiles, [
      ...BUILTIN_RESIDUE_RULES,
      ...customRules.filter((r) => r.enabled).map(storedRuleToRuleDef),
    ]),
    [allFiles, customRules]
  );

  // Build path→FileEntry map for enriching duplicate clusters
  const fileMap = useMemo(() => {
    const m = new Map<string, FileEntry>();
    for (const f of allFiles) m.set(f.path, f);
    return m;
  }, [allFiles]);

  async function startDuplicateScan() {
    if (!result) return;
    cancelledRef.current = false;
    setDuplicatesStatus("scanning");
    setDupProgress(null);

    const unlisten = await listen<{ processed: number; total: number }>("dup-progress", (e) => {
      setDupProgress(e.payload);
    });

    try {
      const paths = allFiles.map((f) => f.path);
      const raw = await invoke<RawDuplicateCluster[]>("find_duplicates", { paths });

      if (cancelledRef.current) {
        setDuplicatesStatus("idle");
        return;
      }

      const enriched: DuplicateCluster[] = raw.map((c) => ({
        id: c.id,
        hash: c.hash,
        fileSize: c.fileSize,
        reclaimable: c.reclaimable,
        suggestedKeep: c.suggestedKeep,
        files: c.filePaths.map((p) => fileMap.get(p) ?? {
          path: p,
          name: p.split(/[\\/]/).pop() ?? p,
          ext: "",
          size: c.fileSize,
          sizeOnDisk: c.fileSize,
          modifiedAt: 0,
          createdAt: 0,
          fileType: "unknown" as const,
          isHidden: false,
        }),
      }));

      setDuplicatesResult(enriched);
    } catch (e) {
      console.error("find_duplicates failed:", e);
      setDuplicatesStatus("idle");
    } finally {
      unlisten();
    }
  }

  function cancelDuplicateScan() {
    cancelledRef.current = true;
    setDuplicatesStatus("cancelling");
  }

  // Counts for tab badges
  const structureCount = structureData
    ? structureData.emptyFolders.filter((i) => !deletedPaths.has(i.path)).length +
      structureData.zeroByteFiles.filter((i) => !deletedPaths.has(i.path)).length +
      structureData.pathIssues.length + structureData.singleChildChains.length + structureData.denseSmall.length
    : 0;
  const residueCount = residueGroups.reduce((s, g) => s + g.files.length, 0);
  const dupCount = duplicatesResult?.length ?? 0;

  // Potential savings
  const residueSavings = residueGroups.filter((g) => g.enabled).reduce((s, g) => s + g.totalSize, 0);
  const dupSavings = duplicatesResult?.reduce((s, c) => s + c.reclaimable, 0) ?? 0;
  const totalSavings = residueSavings + dupSavings;

  const TABS: { id: Tab; icon: string; label: string; count: number }[] = [
    { id: "residue",    icon: "delete_sweep",  label: "残留",  count: residueCount },
    { id: "structure",  icon: "account_tree",  label: "结构",  count: structureCount },
    { id: "duplicates", icon: "file_copy",     label: "重复",  count: dupCount },
  ];

  if (!result) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-8 py-24 select-none">
        <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center mb-6 shadow-inner">
          <span className="material-symbols-outlined text-primary text-4xl">manage_search</span>
        </div>
        <h2 className="font-headline text-xl font-extrabold text-on-surface mb-2">先完成一次扫描</h2>
        <p className="text-sm text-on-surface-variant max-w-xs">
          请先在「透视」页面扫描文件夹，然后回到这里查看问题。
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-8 pt-6 pb-0 shrink-0">
        <div className="flex items-end justify-between mb-4">
          <div>
            <h2 className="font-headline text-2xl font-extrabold text-on-surface tracking-tight">
              发现问题
            </h2>
            <p className="text-sm text-on-surface-variant mt-1">
              扫描结果中发现的可清理内容
            </p>
          </div>
          {totalSavings > 0 && (
            <div className="bg-surface-container-low px-5 py-3 rounded-xl text-right">
              <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-0.5">
                可释放空间
              </p>
              <p className="font-headline text-2xl font-extrabold text-primary tracking-tight">
                {formatBytes(totalSavings)}
              </p>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 border-b border-outline-variant/20">
          {TABS.map(({ id, icon, label, count }) => {
            const isDeleting = activeDeletes.has(id);
            return (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={[
                  "flex items-center gap-2 px-5 py-2.5 text-sm font-semibold font-headline transition-all border-b-2 -mb-px",
                  tab === id
                    ? "border-primary text-primary"
                    : "border-transparent text-on-surface-variant hover:text-on-surface",
                ].join(" ")}
              >
                <span className="material-symbols-outlined text-[18px]">{icon}</span>
                {label}
                {isDeleting ? (
                  <span className="w-2 h-2 rounded-full bg-primary animate-pulse shrink-0" title="正在删除…" />
                ) : count > 0 ? (
                  <span className={[
                    "text-[10px] font-bold px-1.5 py-0.5 rounded-full",
                    tab === id ? "bg-primary/15 text-primary" : "bg-surface-container-high text-on-surface-variant",
                  ].join(" ")}>
                    {count.toLocaleString()}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab content — keep all tabs mounted to preserve in-progress state */}
      <div className="flex-1 overflow-y-auto relative">
        <div className={tab !== "duplicates" ? "hidden" : ""}>
          <DuplicatesTab
            clusters={duplicatesResult}
            status={duplicatesStatus}
            dupProgress={dupProgress}
            onScan={startDuplicateScan}
            onCancel={cancelDuplicateScan}
            onDeleted={(paths) => {
              if (!duplicatesResult) return;
              const updated = duplicatesResult
                .map((c) => ({ ...c, files: c.files.filter((f) => !paths.has(f.path)) }))
                .map((c) => ({ ...c, reclaimable: c.fileSize * Math.max(0, c.files.length - 1) }))
                .filter((c) => c.files.length >= 2);
              setDuplicatesResult(updated);
            }}
          />
        </div>
        {structureData && (
          <div className={tab !== "structure" ? "hidden" : ""}>
            <StructureTab
              key={session.id}
              data={structureData}
              onRefresh={() => setRefreshKey((k) => k + 1)}
              onDeleted={(paths) => setDeletedPaths((prev) => new Set([...prev, ...paths]))}
              onDeleteStart={() => markDeleteStart("structure")}
              onDeleteComplete={(s, f) => markDeleteComplete("structure", "结构", s, f)}
            />
          </div>
        )}
        <div className={tab !== "residue" ? "hidden" : ""}>
          <ResidueTab
            groups={residueGroups}
            customRules={customRules}
            onRefresh={() => setRefreshKey((k) => k + 1)}
            onAddRule={addRule}
            onToggleRule={toggleEnabled}
            onRemoveRule={removeRule}
            onDeleted={(paths) => setDeletedPaths((prev) => new Set([...prev, ...paths]))}
            onDeleteStart={() => markDeleteStart("residue")}
            onDeleteComplete={(s, f) => markDeleteComplete("residue", "残留", s, f)}
          />
        </div>
      </div>
      {ToastContainer}
    </div>
  );
}
