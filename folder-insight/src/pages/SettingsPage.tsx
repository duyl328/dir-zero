import { useState } from "react";
import { useAppStore } from "../store/appStore";
import { useT } from "../hooks/useT";
import type { Locale } from "../i18n";
import type { Theme } from "../store/appStore";

const RESIDUE_BUILTIN = [
  { id: "r-ds_store", pattern: ".DS_Store", type: "glob" as const, enabled: true, builtin: true, label: "macOS .DS_Store" },
  { id: "r-dot_under", pattern: "._*", type: "glob" as const, enabled: true, builtin: true, label: "macOS ._* AppleDouble" },
  { id: "r-thumbs", pattern: "Thumbs.db", type: "glob" as const, enabled: true, builtin: true, label: "Windows Thumbs.db" },
  { id: "r-desktop_ini", pattern: "desktop.ini", type: "glob" as const, enabled: false, builtin: true, label: "Windows desktop.ini" },
  { id: "r-tmp", pattern: "*.tmp", type: "glob" as const, enabled: true, builtin: true, label: "Temp files (*.tmp)" },
  { id: "r-crdownload", pattern: "*.crdownload", type: "glob" as const, enabled: true, builtin: true, label: "Chrome partial downloads" },
];

export default function SettingsPage() {
  const { excludeRules, toggleExcludeRule, addExcludeRule, removeExcludeRule, locale, setLocale, theme, setTheme } = useAppStore();
  const t = useT();
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
        <h2 className="font-headline text-2xl font-extrabold text-on-surface tracking-tight mb-1">{t.settings.title}</h2>
        <p className="text-sm text-on-surface-variant">{t.settings.subtitle}</p>
      </div>

      {/* Language */}
      <section>
        <h3 className="font-headline font-bold text-base text-on-surface mb-3">{t.settings.langLabel}</h3>
        <div className="flex items-center gap-2">
          {(["zh", "en"] as Locale[]).map((l) => (
            <button key={l} onClick={() => setLocale(l)}
              className={["px-4 py-2 rounded-lg text-sm font-semibold transition-colors", locale === l ? "bg-primary text-on-primary" : "bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest"].join(" ")}>
              {l === "zh" ? t.settings.langZh : t.settings.langEn}
            </button>
          ))}
        </div>
      </section>

      {/* Appearance */}
      <section>
        <h3 className="font-headline font-bold text-base text-on-surface mb-3">{t.settings.themeLabel}</h3>
        <div className="flex items-center gap-2">
          {(["light", "dark"] as Theme[]).map((th) => (
            <button key={th} onClick={() => setTheme(th)}
              className={["flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors", theme === th ? "bg-primary text-on-primary" : "bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest"].join(" ")}>
              <span className="material-symbols-outlined text-[16px]">{th === "light" ? "light_mode" : "dark_mode"}</span>
              {th === "light" ? t.settings.themeLight : t.settings.themeDark}
            </button>
          ))}
        </div>
      </section>

      {/* Exclude Rules */}
      <section>
        <h3 className="font-headline font-bold text-base text-on-surface mb-1">{t.settings.excludeRulesTitle}</h3>
        <p className="text-xs text-on-surface-variant mb-4">{t.settings.excludeRulesDesc}</p>

        <div className="space-y-2 mb-4">
          {excludeRules.map((rule) => (
            <div key={rule.id} className="flex items-center gap-3 px-4 py-3 bg-surface-container-lowest rounded-xl border border-outline-variant/10">
              <button onClick={() => toggleExcludeRule(rule.id)}
                className={["relative w-9 h-5 rounded-full transition-colors shrink-0 overflow-hidden", rule.enabled ? "bg-primary" : "bg-surface-container-highest"].join(" ")}>
                <span className={["absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform", rule.enabled ? "translate-x-4" : "translate-x-0"].join(" ")} />
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-on-surface">{rule.label}</p>
                <p className="text-[10px] font-mono text-on-surface-variant/60">{rule.pattern}</p>
              </div>
              <span className={["text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded", rule.builtin ? "bg-surface-container text-on-surface-variant/50" : "bg-primary/10 text-primary"].join(" ")}>
                {rule.builtin ? t.settings.builtin : rule.type}
              </span>
              {!rule.builtin && (
                <button onClick={() => removeExcludeRule(rule.id)} className="text-on-surface-variant hover:text-error transition-colors">
                  <span className="material-symbols-outlined text-[18px]">delete_outline</span>
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="bg-surface-container-low rounded-xl p-4 space-y-3">
          <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">{t.settings.addCustomRule}</p>
          <div className="flex gap-2">
            {(["glob", "regex"] as const).map((tp) => (
              <button key={tp} onClick={() => setPatternType(tp)}
                className={["px-3 py-1 rounded-full text-xs font-bold uppercase transition-all", patternType === tp ? "bg-primary text-on-primary" : "bg-surface-container-high text-on-surface-variant"].join(" ")}>
                {tp}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input value={newPattern} onChange={(e) => setNewPattern(e.target.value)}
              placeholder={patternType === "glob" ? t.settings.patternPlaceholder : t.settings.regexPlaceholder}
              className="flex-1 bg-surface-container-lowest border border-outline-variant/20 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/30" />
            <input value={newLabel} onChange={(e) => setNewLabel(e.target.value)}
              placeholder={t.settings.labelPlaceholder}
              className="w-40 bg-surface-container-lowest border border-outline-variant/20 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/30" />
            <button onClick={handleAddExclude} disabled={!newPattern.trim()}
              className="px-4 py-2 cta-gradient text-on-primary rounded-lg text-sm font-bold disabled:opacity-40">
              {t.settings.add}
            </button>
          </div>
        </div>
      </section>

      {/* Residue Rules */}
      <section>
        <h3 className="font-headline font-bold text-base text-on-surface mb-1">{t.settings.residueRulesTitle}</h3>
        <p className="text-xs text-on-surface-variant mb-4">{t.settings.residueRulesDesc}</p>
        <div className="space-y-2">
          {residueRules.map((rule) => (
            <div key={rule.id} className="flex items-center gap-3 px-4 py-3 bg-surface-container-lowest rounded-xl border border-outline-variant/10">
              <button onClick={() => toggleResidue(rule.id)}
                className={["relative w-9 h-5 rounded-full transition-colors shrink-0 overflow-hidden", rule.enabled ? "bg-primary" : "bg-surface-container-highest"].join(" ")}>
                <span className={["absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform", rule.enabled ? "translate-x-4" : "translate-x-0"].join(" ")} />
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-on-surface">{rule.label}</p>
                <p className="text-[10px] font-mono text-on-surface-variant/60">{rule.pattern}</p>
              </div>
              <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded bg-surface-container text-on-surface-variant/50">
                {t.settings.builtin}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
