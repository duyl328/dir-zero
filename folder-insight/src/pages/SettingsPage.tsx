import { useState } from "react";
import { useAppStore } from "../store/appStore";

const RESIDUE_BUILTIN = [
  { id: "r-ds_store", pattern: ".DS_Store", type: "glob" as const, enabled: true, builtin: true, label: "macOS .DS_Store" },
  { id: "r-dot_under", pattern: "._*", type: "glob" as const, enabled: true, builtin: true, label: "macOS ._* AppleDouble" },
  { id: "r-thumbs", pattern: "Thumbs.db", type: "glob" as const, enabled: true, builtin: true, label: "Windows Thumbs.db" },
  { id: "r-desktop_ini", pattern: "desktop.ini", type: "glob" as const, enabled: false, builtin: true, label: "Windows desktop.ini" },
  { id: "r-tmp", pattern: "*.tmp", type: "glob" as const, enabled: true, builtin: true, label: "Temp files (*.tmp)" },
  { id: "r-crdownload", pattern: "*.crdownload", type: "glob" as const, enabled: true, builtin: true, label: "Chrome partial downloads" },
];

export default function SettingsPage() {
  const { excludeRules, toggleExcludeRule, addExcludeRule, removeExcludeRule } = useAppStore();
  const [residueRules, setResidueRules] = useState(RESIDUE_BUILTIN);
  const [newPattern, setNewPattern] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [patternType, setPatternType] = useState<"glob" | "regex">("glob");

  function handleAddExclude() {
    if (!newPattern.trim()) return;
    addExcludeRule({
      id: `u-${Date.now()}`,
      pattern: newPattern.trim(),
      type: patternType,
      enabled: true,
      builtin: false,
      label: newLabel.trim() || newPattern.trim(),
    });
    setNewPattern("");
    setNewLabel("");
  }

  function toggleResidue(id: string) {
    setResidueRules((prev) => prev.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)));
  }

  return (
    <div className="max-w-3xl mx-auto px-8 py-8 space-y-10">
      <div>
        <h2 className="font-headline text-2xl font-extrabold text-on-surface tracking-tight mb-1">Settings</h2>
        <p className="text-sm text-on-surface-variant">Configure scan behavior and rule management.</p>
      </div>

      {/* Exclude Rules */}
      <section>
        <h3 className="font-headline font-bold text-base text-on-surface mb-1">Scan Exclude Rules</h3>
        <p className="text-xs text-on-surface-variant mb-4">Paths and patterns matching these rules will be skipped during scanning.</p>

        {/* Builtin groups */}
        <div className="space-y-2 mb-4">
          {excludeRules.map((rule) => (
            <div key={rule.id} className="flex items-center gap-3 px-4 py-3 bg-surface-container-lowest rounded-xl border border-outline-variant/10">
              <button
                onClick={() => toggleExcludeRule(rule.id)}
                className={[
                  "relative w-9 h-5 rounded-full transition-colors shrink-0",
                  rule.enabled ? "bg-primary" : "bg-surface-container-highest",
                ].join(" ")}
              >
                <span className={["absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform", rule.enabled ? "translate-x-4" : "translate-x-0.5"].join(" ")} />
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-on-surface">{rule.label}</p>
                <p className="text-[10px] font-mono text-on-surface-variant/60">{rule.pattern}</p>
              </div>
              <span className={["text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded", rule.builtin ? "bg-surface-container text-on-surface-variant/50" : "bg-primary/10 text-primary"].join(" ")}>
                {rule.builtin ? "Built-in" : rule.type}
              </span>
              {!rule.builtin && (
                <button onClick={() => removeExcludeRule(rule.id)} className="text-on-surface-variant hover:text-error transition-colors">
                  <span className="material-symbols-outlined text-[18px]">delete_outline</span>
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Add custom */}
        <div className="bg-surface-container-low rounded-xl p-4 space-y-3">
          <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">Add Custom Rule</p>
          <div className="flex gap-2">
            {(["glob", "regex"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setPatternType(t)}
                className={["px-3 py-1 rounded-full text-xs font-bold uppercase transition-all", patternType === t ? "bg-primary text-on-primary" : "bg-surface-container-high text-on-surface-variant"].join(" ")}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={newPattern}
              onChange={(e) => setNewPattern(e.target.value)}
              placeholder={patternType === "glob" ? "e.g. *.log or temp_*/" : "e.g. ^\\.(git|svn)$"}
              className="flex-1 bg-surface-container-lowest border border-outline-variant/20 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/30"
            />
            <input
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="Label (optional)"
              className="w-40 bg-surface-container-lowest border border-outline-variant/20 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/30"
            />
            <button
              onClick={handleAddExclude}
              disabled={!newPattern.trim()}
              className="px-4 py-2 cta-gradient text-on-primary rounded-lg text-sm font-bold disabled:opacity-40"
            >
              Add
            </button>
          </div>
        </div>
      </section>

      {/* Residue Rules */}
      <section>
        <h3 className="font-headline font-bold text-base text-on-surface mb-1">Residue Detection Rules</h3>
        <p className="text-xs text-on-surface-variant mb-4">Files matching these patterns will appear in the Residue tab.</p>
        <div className="space-y-2">
          {residueRules.map((rule) => (
            <div key={rule.id} className="flex items-center gap-3 px-4 py-3 bg-surface-container-lowest rounded-xl border border-outline-variant/10">
              <button
                onClick={() => toggleResidue(rule.id)}
                className={["relative w-9 h-5 rounded-full transition-colors shrink-0", rule.enabled ? "bg-primary" : "bg-surface-container-highest"].join(" ")}
              >
                <span className={["absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform", rule.enabled ? "translate-x-4" : "translate-x-0.5"].join(" ")} />
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-on-surface">{rule.label}</p>
                <p className="text-[10px] font-mono text-on-surface-variant/60">{rule.pattern}</p>
              </div>
              <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded bg-surface-container text-on-surface-variant/50">
                Built-in
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
