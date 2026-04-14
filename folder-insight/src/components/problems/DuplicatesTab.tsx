import { useState } from "react";

type KeepStrategy = "newest" | "oldest" | "manual";

const MOCK_CLUSTERS = [
  {
    id: "c1",
    count: 4,
    totalSize: 12_400_000_000,
    reclaimable: 9_300_000_000,
    files: [
      { name: "IMG_2023_Final_Render_01.exr", path: "D:\\Projects\\2023\\Final\\", size: 3_100_000_000, modifiedAt: "2023-11-02", keep: true },
      { name: "IMG_2023_Final_Render_01.exr", path: "D:\\Backup\\2023\\", size: 3_100_000_000, modifiedAt: "2023-10-15", keep: false },
      { name: "IMG_2023_Final_Render_01.exr", path: "D:\\Archive\\", size: 3_100_000_000, modifiedAt: "2023-09-01", keep: false },
      { name: "IMG_2023_Final_Render_01.exr", path: "D:\\Temp\\", size: 3_100_000_000, modifiedAt: "2023-08-20", keep: false },
    ],
    severity: "critical",
  },
  {
    id: "c2",
    count: 2,
    totalSize: 2_100_000_000,
    reclaimable: 2_100_000_000,
    files: [
      { name: "Client_Brief_V4_MASTER.mp4", path: "D:\\Projects\\Client\\", size: 2_100_000_000, modifiedAt: "2024-01-10", keep: true },
      { name: "Client_Brief_V4_MASTER.mp4", path: "D:\\Downloads\\", size: 2_100_000_000, modifiedAt: "2024-01-08", keep: false },
    ],
    severity: "high",
  },
  {
    id: "c3",
    count: 3,
    totalSize: 850_000_000,
    reclaimable: 1_700_000_000,
    files: [
      { name: "Tax_Records_2022_Full_Archive.zip", path: "D:\\Documents\\Tax\\", size: 850_000_000, modifiedAt: "2022-04-15", keep: true },
      { name: "Tax_Records_2022_Full_Archive.zip", path: "D:\\Backup\\", size: 850_000_000, modifiedAt: "2022-04-14", keep: false },
      { name: "Tax_Records_2022_Full_Archive.zip", path: "D:\\Temp\\", size: 850_000_000, modifiedAt: "2022-04-10", keep: false },
    ],
    severity: "medium",
  },
];

function formatBytes(b: number) {
  if (b < 1e6) return `${(b / 1e3).toFixed(0)} KB`;
  if (b < 1e9) return `${(b / 1e6).toFixed(1)} MB`;
  return `${(b / 1e9).toFixed(2)} GB`;
}

export default function DuplicatesTab() {
  const [strategy, setStrategy] = useState<KeepStrategy>("newest");
  const [expanded, setExpanded] = useState<string | null>("c1");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function toggleCluster(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const totalSelected = MOCK_CLUSTERS.filter((c) => selected.has(c.id)).reduce((s, c) => s + c.reclaimable, 0);

  return (
    <div className="px-8 py-6">
      {/* Strategy selector */}
      <div className="flex items-center gap-4 mb-6">
        <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">Keep strategy:</p>
        {(["newest", "oldest", "manual"] as KeepStrategy[]).map((s) => (
          <button
            key={s}
            onClick={() => setStrategy(s)}
            className={[
              "px-3 py-1.5 rounded-full text-xs font-bold capitalize transition-all",
              strategy === s
                ? "bg-primary text-on-primary"
                : "bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest",
            ].join(" ")}
          >
            {s === "newest" ? "Keep Newest" : s === "oldest" ? "Keep Oldest" : "Manual"}
          </button>
        ))}
      </div>

      {/* Cluster list */}
      <div className="space-y-3">
        {MOCK_CLUSTERS.map((cluster) => (
          <div
            key={cluster.id}
            className="bg-surface-container-lowest rounded-xl border border-outline-variant/10 overflow-hidden"
          >
            {/* Cluster header */}
            <div className="flex items-center gap-4 p-4">
              <input
                type="checkbox"
                checked={selected.has(cluster.id)}
                onChange={() => toggleCluster(cluster.id)}
                className="w-4 h-4 rounded border-outline-variant text-primary focus:ring-primary/20"
              />
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-primary text-[18px]">file_copy</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-on-surface truncate">
                  {cluster.files[0].name}
                </p>
                <p className="text-xs text-on-surface-variant">
                  {cluster.count} copies • <span className="text-primary font-medium">{formatBytes(cluster.reclaimable)} recoverable</span>
                </p>
              </div>
              {cluster.severity === "critical" && (
                <span className="px-2 py-0.5 bg-error/10 text-error text-[10px] font-bold rounded-full uppercase tracking-tight shrink-0">
                  Critical
                </span>
              )}
              <button
                onClick={() => setExpanded(expanded === cluster.id ? null : cluster.id)}
                className="p-1 text-on-surface-variant hover:text-on-surface transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">
                  {expanded === cluster.id ? "expand_less" : "expand_more"}
                </span>
              </button>
            </div>

            {/* Expanded file list */}
            {expanded === cluster.id && (
              <div className="border-t border-outline-variant/10">
                {cluster.files.map((f, i) => (
                  <div
                    key={i}
                    className={[
                      "flex items-center gap-4 px-6 py-3 transition-colors",
                      f.keep ? "bg-tertiary-container/20" : "hover:bg-surface-container-high",
                    ].join(" ")}
                  >
                    <span
                      className={`material-symbols-outlined text-[16px] shrink-0 ${f.keep ? "text-tertiary" : "text-on-surface-variant/40"}`}
                    >
                      {f.keep ? "shield" : "delete_outline"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-mono text-on-surface truncate">{f.path}{f.name}</p>
                      <p className="text-[10px] text-on-surface-variant">{formatBytes(f.size)} · Modified {f.modifiedAt}</p>
                    </div>
                    {f.keep ? (
                      <span className="text-[10px] font-bold text-tertiary bg-tertiary/10 px-2 py-0.5 rounded-full">Keep</span>
                    ) : (
                      <span className="text-[10px] font-bold text-error/70">Remove</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Action bar */}
      {selected.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 glass-panel px-8 py-4 rounded-2xl shadow-2xl border border-white/30 flex items-center gap-8 z-50">
          <div>
            <p className="text-[10px] uppercase font-bold tracking-widest text-on-surface-variant">Selected</p>
            <p className="font-headline text-lg font-extrabold text-on-surface">
              {formatBytes(totalSelected)} · {selected.size} group{selected.size > 1 ? "s" : ""}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSelected(new Set())}
              className="px-5 py-2.5 rounded-lg text-sm font-semibold text-on-surface-variant hover:bg-surface-container-high transition-colors"
            >
              Deselect All
            </button>
            <button className="cta-gradient px-7 py-2.5 rounded-lg text-sm font-bold text-on-primary shadow-lg shadow-primary/20 flex items-center gap-2 active:scale-95 duration-150">
              <span className="material-symbols-outlined text-[18px]">delete_sweep</span>
              Move to Trash
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
