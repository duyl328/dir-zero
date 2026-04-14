const STRUCTURE_ISSUES = [
  { type: "empty_folder", icon: "folder_off", label: "Empty Folders", count: 186, severity: "safe", desc: "Directories with no files or subdirectories.", action: "Delete All" },
  { type: "deep_nest", icon: "account_tree", label: "Deep Nesting", count: 12, severity: "caution", desc: "Paths exceeding 8 levels deep — hard to navigate.", action: "View" },
  { type: "long_path", icon: "straighten", label: "Long Paths", count: 23, severity: "caution", desc: "Paths near or over the 260-character Windows limit.", action: "View" },
  { type: "single_child_chain", icon: "linear_scale", label: "Single-Child Chains", count: 9, severity: "caution", desc: "Folders that only ever contain one subfolder — redundant nesting.", action: "View" },
  { type: "dense_small", icon: "grain", label: "Dense Small Files", count: 4, severity: "safe", desc: "Directories with 10,000+ tiny files — likely build artifacts or caches.", action: "View" },
];

export default function StructureTab() {
  return (
    <div className="px-8 py-6 space-y-3">
      <p className="text-xs text-on-surface-variant mb-4">
        Structure issues are <strong>display-only</strong> in v1. Empty folders can be deleted; other issues are shown for your awareness.
      </p>
      {STRUCTURE_ISSUES.map((issue) => (
        <div
          key={issue.type}
          className="bg-surface-container-lowest rounded-xl border border-outline-variant/10 p-5 flex items-start gap-4"
        >
          <div
            className={[
              "w-11 h-11 rounded-xl flex items-center justify-center shrink-0",
              issue.severity === "safe" ? "bg-secondary-container text-secondary" : "bg-amber-100 text-amber-600",
            ].join(" ")}
          >
            <span className="material-symbols-outlined text-[20px]">{issue.icon}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <p className="font-headline font-bold text-sm text-on-surface">{issue.label}</p>
              <span
                className={[
                  "text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-tight",
                  issue.severity === "safe"
                    ? "bg-tertiary/10 text-tertiary"
                    : "bg-amber-100 text-amber-700",
                ].join(" ")}
              >
                {issue.severity}
              </span>
            </div>
            <p className="text-xs text-on-surface-variant mb-3">{issue.desc}</p>
            <div className="flex items-center gap-4">
              <span className="font-headline text-2xl font-extrabold text-on-surface">{issue.count}</span>
              <span className="text-xs text-on-surface-variant">found</span>
            </div>
          </div>
          <button
            className={[
              "px-4 py-2 rounded-lg text-xs font-bold transition-colors shrink-0",
              issue.type === "empty_folder"
                ? "bg-error/10 text-error hover:bg-error/20"
                : "bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest",
            ].join(" ")}
          >
            {issue.action}
          </button>
        </div>
      ))}
    </div>
  );
}
