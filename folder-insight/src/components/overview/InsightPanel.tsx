import { useNavigate } from "react-router-dom";

interface Props {
  issueCount: number;
}

const MOCK_INSIGHTS = [
  { icon: "file_copy", color: "text-primary", label: "Duplicate files", detail: "12.4 GB recoverable", to: "/problems" },
  { icon: "folder_off", color: "text-on-surface-variant", label: "Empty folders", detail: "186 found", to: "/problems" },
  { icon: "schedule", color: "text-amber-500", label: "Files older than 2 years", detail: "34.2 GB untouched", to: "/types" },
  { icon: "delete_sweep", color: "text-tertiary", label: "Residue files", detail: "3.2 GB .DS_Store etc.", to: "/problems" },
];

export default function InsightPanel({ issueCount }: Props) {
  const nav = useNavigate();

  if (issueCount === 0) {
    return (
      <div className="p-4 text-center">
        <span className="material-symbols-outlined text-tertiary text-2xl">check_circle</span>
        <p className="text-xs font-bold text-tertiary mt-1">No issues found</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-2">
      <p className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant/50 mb-3">Insights</p>
      {MOCK_INSIGHTS.map((item) => (
        <button
          key={item.label}
          onClick={() => nav(item.to)}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-surface-container-high transition-colors text-left group"
        >
          <span className={`material-symbols-outlined text-[18px] shrink-0 ${item.color}`}>{item.icon}</span>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-on-surface truncate">{item.label}</p>
            <p className="text-[10px] text-on-surface-variant">{item.detail}</p>
          </div>
          <span className="material-symbols-outlined text-[14px] text-on-surface-variant/40 group-hover:text-primary transition-colors">
            arrow_forward_ios
          </span>
        </button>
      ))}
    </div>
  );
}
