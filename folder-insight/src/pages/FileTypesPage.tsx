import { useState } from "react";

type AgeTab = "types" | "age";

const FILE_TYPES = [
  { label: "Videos", icon: "videocam", color: "#06b6d4", size: 120_000_000_000, count: 1_204, largest: "Raw_Footage_2024.mov (14.2 GB)", dirs: ["D:\\Video_Assets\\", "D:\\Projects\\"] },
  { label: "Applications", icon: "apps", color: "#6366f1", size: 84_000_000_000, count: 312, largest: "Creative Cloud (8.4 GB)", dirs: ["C:\\Program Files\\"] },
  { label: "System", icon: "settings_system_daydream", color: "#94a3b8", size: 142_000_000_000, count: 48_210, largest: "pagefile.sys (16 GB)", dirs: ["C:\\Windows\\"] },
  { label: "Documents", icon: "description", color: "#f59e0b", size: 22_000_000_000, count: 8_420, largest: "Annual_Report_2023.pdf (420 MB)", dirs: ["D:\\Documents\\"] },
  { label: "Images", icon: "image", color: "#ec4899", size: 18_000_000_000, count: 24_100, largest: "Panorama_RAW.tiff (2.1 GB)", dirs: ["D:\\Photos\\"] },
  { label: "Archives", icon: "folder_zip", color: "#8b5cf6", size: 14_000_000_000, count: 203, largest: "Backup_2022.zip (4.2 GB)", dirs: ["D:\\Backup\\"] },
  { label: "Code", icon: "code", color: "#10b981", size: 8_000_000_000, count: 142_000, largest: "node_modules (6 GB)", dirs: ["D:\\Projects\\"] },
  { label: "Unknown", icon: "help_outline", color: "#a9b4b9", size: 2_000_000_000, count: 1_840, largest: "data.bin (340 MB)", dirs: ["D:\\Misc\\"] },
];

const AGE_BUCKETS = [
  { label: "This week", color: "#0053db", size: 4_200_000_000, count: 1_204, pct: 1 },
  { label: "This month", color: "#3b82f6", size: 12_000_000_000, count: 4_820, pct: 3 },
  { label: "3 months", color: "#60a5fa", size: 28_000_000_000, count: 18_400, pct: 7 },
  { label: "1 year", color: "#93c5fd", size: 84_000_000_000, count: 84_200, pct: 20 },
  { label: "1–3 years", color: "#f59e0b", size: 142_000_000_000, count: 420_000, pct: 33 },
  { label: "3+ years", color: "#ef4444", size: 158_000_000_000, count: 720_000, pct: 37 },
];

function formatBytes(b: number) {
  if (b < 1e6) return `${(b / 1e3).toFixed(0)} KB`;
  if (b < 1e9) return `${(b / 1e6).toFixed(1)} MB`;
  return `${(b / 1e9).toFixed(2)} GB`;
}

const TOTAL = FILE_TYPES.reduce((s, t) => s + t.size, 0);

export default function FileTypesPage() {
  const [activeTab, setActiveTab] = useState<AgeTab>("types");
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-8 pt-6 pb-0 shrink-0">
        <div className="flex items-end justify-between mb-4">
          <div>
            <h2 className="font-headline text-2xl font-extrabold text-on-surface tracking-tight">File Types</h2>
            <p className="text-sm text-on-surface-variant mt-1">Understand what's taking up space by content category.</p>
          </div>
        </div>
        <div className="flex items-center gap-1 border-b border-outline-variant/20">
          {(["types", "age"] as AgeTab[]).map((t) => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={[
                "flex items-center gap-2 px-5 py-2.5 text-sm font-semibold font-headline transition-all border-b-2 -mb-px capitalize",
                activeTab === t ? "border-primary text-primary" : "border-transparent text-on-surface-variant hover:text-on-surface",
              ].join(" ")}
            >
              <span className="material-symbols-outlined text-[18px]">{t === "types" ? "category" : "schedule"}</span>
              {t === "types" ? "By Type" : "By Age"}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-6">
        {activeTab === "types" ? (
          <div className="space-y-2">
            {FILE_TYPES.map((type) => {
              const pct = (type.size / TOTAL) * 100;
              const isOpen = expanded === type.label;
              return (
                <div key={type.label} className="bg-surface-container-lowest rounded-xl border border-outline-variant/10 overflow-hidden">
                  <button
                    onClick={() => setExpanded(isOpen ? null : type.label)}
                    className="w-full flex items-center gap-4 p-4 hover:bg-surface-container-high/50 transition-colors text-left"
                  >
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: type.color + "20" }}>
                      <span className="material-symbols-outlined text-[20px]" style={{ color: type.color }}>{type.icon}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-sm font-semibold text-on-surface">{type.label}</p>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-on-surface-variant">{type.count.toLocaleString()} files</span>
                          <span className="text-sm font-bold text-on-surface">{formatBytes(type.size)}</span>
                          <span className="text-xs font-bold text-on-surface-variant/60 w-10 text-right">{pct.toFixed(1)}%</span>
                        </div>
                      </div>
                      <div className="w-full h-1.5 bg-surface-container-high rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: type.color }} />
                      </div>
                    </div>
                    <span className="material-symbols-outlined text-[18px] text-on-surface-variant shrink-0">
                      {isOpen ? "expand_less" : "expand_more"}
                    </span>
                  </button>

                  {isOpen && (
                    <div className="border-t border-outline-variant/10 px-6 py-4 grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60 mb-1">Largest File</p>
                        <p className="text-xs font-medium text-on-surface">{type.largest}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60 mb-1">Top Directories</p>
                        {type.dirs.map((d) => (
                          <p key={d} className="text-xs font-mono text-on-surface-variant truncate">{d}</p>
                        ))}
                      </div>
                      <div className="col-span-2 flex justify-end">
                        <button className="px-4 py-1.5 bg-error/10 text-error rounded-lg text-xs font-bold hover:bg-error/20 transition-colors">
                          Move to Trash
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-on-surface-variant mb-2">Based on last modified time (mtime).</p>
            {AGE_BUCKETS.map((bucket) => (
              <div key={bucket.label} className="bg-surface-container-lowest rounded-xl border border-outline-variant/10 p-4 flex items-center gap-4">
                <div className="w-3 h-3 rounded-full shrink-0" style={{ background: bucket.color }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-sm font-semibold text-on-surface">{bucket.label}</p>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-on-surface-variant">{bucket.count.toLocaleString()} files</span>
                      <span className="text-sm font-bold text-on-surface">{formatBytes(bucket.size)}</span>
                      <span className="text-xs font-bold text-on-surface-variant/60 w-10 text-right">{bucket.pct}%</span>
                    </div>
                  </div>
                  <div className="w-full h-1.5 bg-surface-container-high rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${bucket.pct}%`, background: bucket.color }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
