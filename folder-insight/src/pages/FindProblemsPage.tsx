import { useState } from "react";
import DuplicatesTab from "../components/problems/DuplicatesTab";
import StructureTab from "../components/problems/StructureTab";
import ResidueTab from "../components/problems/ResidueTab";

type Tab = "duplicates" | "structure" | "residue";

const TABS: { id: Tab; icon: string; label: string; badge?: number }[] = [
  { id: "duplicates", icon: "file_copy", label: "Duplicates", badge: 34 },
  { id: "structure", icon: "account_tree", label: "Structure", badge: 7 },
  { id: "residue", icon: "delete_sweep", label: "Residue", badge: 3 },
];

export default function FindProblemsPage() {
  const [tab, setTab] = useState<Tab>("duplicates");

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-8 pt-6 pb-0 shrink-0">
        <div className="flex items-end justify-between mb-4">
          <div>
            <h2 className="font-headline text-2xl font-extrabold text-on-surface tracking-tight">
              Optimization Center
            </h2>
            <p className="text-sm text-on-surface-variant mt-1">
              We've identified issues in your folder. Select items to clean up.
            </p>
          </div>
          <div className="bg-surface-container-low px-5 py-3 rounded-xl text-right">
            <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-0.5">
              Potential Savings
            </p>
            <p className="font-headline text-3xl font-extrabold text-primary tracking-tight">
              42.8 <span className="text-lg">GB</span>
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 border-b border-outline-variant/20">
          {TABS.map(({ id, icon, label, badge }) => (
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
              {badge !== undefined && (
                <span
                  className={[
                    "text-[10px] font-bold px-1.5 py-0.5 rounded-full",
                    tab === id ? "bg-primary/15 text-primary" : "bg-surface-container-high text-on-surface-variant",
                  ].join(" ")}
                >
                  {badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {tab === "duplicates" && <DuplicatesTab />}
        {tab === "structure" && <StructureTab />}
        {tab === "residue" && <ResidueTab />}
      </div>
    </div>
  );
}
