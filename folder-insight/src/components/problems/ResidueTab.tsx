import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import ContextMenu from "../ui/ContextMenu";
import { useToast } from "../../hooks/useToast";
import type { ResidueGroup, ResidueRuleDef } from "../../analysis/residueAnalysis";
import type { FileEntry } from "../../types";

interface Props {
  groups: ResidueGroup[];
  onRefresh: () => void;
  onAddRule: (rule: ResidueRuleDef) => void;
}

function formatBytes(b: number) {
  if (b < 1e6) return `${(b / 1e3).toFixed(0)} KB`;
  if (b < 1e9) return `${(b / 1e6).toFixed(1)} MB`;
  return `${(b / 1e9).toFixed(2)} GB`;
}

function AddRuleForm({ onAdd, onCancel }: {
  onAdd: (rule: ResidueRuleDef) => void;
  onCancel: () => void;
}) {
  const [label, setLabel] = useState("");
  const [pattern, setPattern] = useState("");
  const [useRegex, setUseRegex] = useState(false);
  const [error, setError] = useState("");

  function handleSubmit() {
    const p = pattern.trim();
    const l = label.trim() || p;
    if (!p) { setError("请输入匹配规则"); return; }
    if (useRegex) {
      try { new RegExp(p); } catch { setError("正则表达式无效"); return; }
    }
    const matchFn: ResidueRuleDef["match"] = useRegex
      ? (f) => new RegExp(p, "i").test(f.name)
      : p.startsWith("*.")
        ? (f) => f.ext.toLowerCase() === p.slice(2).toLowerCase()
        : (f) => f.name.toLowerCase() === p.toLowerCase();
    onAdd({ id: `custom-${Date.now()}`, label: l, desc: `自定义规则：${p}`, icon: "rule", defaultEnabled: true, match: matchFn });
  }

  return (
    <div className="bg-surface-container-lowest rounded-xl border border-primary/30 p-4 space-y-3">
      <p className="text-xs font-bold text-on-surface">添加自定义规则</p>
      <div className="flex gap-2">
        <div className="flex-1">
          <input
            type="text" value={pattern} autoFocus
            onChange={(e) => { setPattern(e.target.value); setError(""); }}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            placeholder={useRegex ? "正则表达式，如 ^~\\$.*" : "glob 模式，如 *.bak 或 thumbs.db"}
            className={[
              "w-full px-3 py-2 rounded-lg bg-surface-container text-xs text-on-surface outline-none",
              "placeholder:text-on-surface-variant/40 focus:ring-1 transition-all",
              useRegex ? "font-mono focus:ring-amber-400/50" : "focus:ring-primary/50",
              error ? "ring-1 ring-error" : "",
            ].join(" ")}
          />
          {error && <p className="text-[10px] text-error mt-1">{error}</p>}
        </div>
        <button
          onClick={() => setUseRegex((v) => !v)}
          title={useRegex ? "切换为 glob 模式" : "切换为正则模式"}
          className={[
            "px-2.5 py-2 rounded-lg text-[10px] font-bold font-mono transition-all shrink-0",
            useRegex ? "bg-amber-400/20 text-amber-600" : "bg-surface-container text-on-surface-variant hover:text-on-surface",
          ].join(" ")}
        >.*</button>
      </div>
      <input
        type="text" value={label} onChange={(e) => setLabel(e.target.value)}
        placeholder="规则名称（可选）"
        className="w-full px-3 py-2 rounded-lg bg-surface-container text-xs text-on-surface outline-none placeholder:text-on-surface-variant/40 focus:ring-1 focus:ring-primary/50 transition-all"
      />
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="px-4 py-1.5 rounded-lg text-xs font-semibold text-on-surface-variant hover:bg-surface-container-high transition-colors">取消</button>
        <button onClick={handleSubmit} className="px-4 py-1.5 rounded-lg text-xs font-bold bg-primary text-on-primary hover:opacity-90 transition-opacity">添加</button>
      </div>
    </div>
  );
}

interface CtxState { x: number; y: number; file: FileEntry }

export default function ResidueTab({ groups: initialGroups, onRefresh, onAddRule }: Props) {
  const groups = initialGroups;
  const { show: showToast, ToastContainer } = useToast();
  const [selected, setSelected] = useState<Set<string>>(
    new Set(initialGroups.filter((g) => g.enabled).map((g) => g.ruleId))
  );
  const [expanded, setExpanded] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [showExcluded, setShowExcluded] = useState(false);
  const [ctx, setCtx] = useState<CtxState | null>(null);

  useEffect(() => {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const g of groups) {
        if (!prev.has(g.ruleId) && g.enabled) next.add(g.ruleId);
      }
      return next;
    });
  }, [groups]);

  function toggleSelect(ruleId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(ruleId) ? next.delete(ruleId) : next.add(ruleId);
      return next;
    });
  }

  // Filter out excluded files from groups
  const visibleGroups = groups.map((g) => ({
    ...g,
    files: g.files.filter((f) => !excluded.has(f.path)),
    totalSize: g.files.filter((f) => !excluded.has(f.path)).reduce((s, f) => s + f.size, 0),
  })).filter((g) => g.files.length > 0);

  const activeGroups = visibleGroups.filter((g) => selected.has(g.ruleId));
  const totalSize = activeGroups.reduce((s, g) => s + g.totalSize, 0);
  const totalCount = activeGroups.reduce((s, g) => s + g.files.length, 0);

  async function handleClean() {
    const paths = activeGroups.flatMap((g) => g.files.map((f: FileEntry) => f.path));
    if (paths.length === 0) return;
    setDeleting(true);
    try {
      await invoke("move_to_trash", { paths });
      onRefresh();
    } finally {
      setDeleting(false);
    }
  }

  function openCtx(e: React.MouseEvent, file: FileEntry) {
    e.preventDefault();
    e.stopPropagation();
    setCtx({ x: e.clientX, y: e.clientY, file });
  }

  if (visibleGroups.length === 0 && !showAddForm) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
        <span className="material-symbols-outlined text-4xl text-tertiary/60">check_circle</span>
        <p className="text-sm font-bold text-on-surface">未发现残留文件</p>
        <p className="text-xs text-on-surface-variant/60 mb-4">没有匹配内置规则的垃圾文件</p>
        <button onClick={() => setShowAddForm(true)} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold text-primary bg-primary/10 hover:bg-primary/15 transition-colors">
          <span className="material-symbols-outlined text-[15px]">add</span>
          添加自定义规则
        </button>
      </div>
    );
  }

  return (
    <div className="px-8 py-6 pb-28">{/* pb-28 reserves space for the floating action bar */}
      {visibleGroups.length > 1 && (
        <div className="flex items-center gap-3 mb-3">
          <button
            onClick={() => setSelected(selected.size === visibleGroups.length ? new Set() : new Set(visibleGroups.map((g) => g.ruleId)))}
            className="text-[10px] font-bold text-primary hover:underline"
          >
            {selected.size === visibleGroups.length ? "取消全选" : "全选"}
          </button>
          <span className="text-[10px] text-on-surface-variant/50">已选 {selected.size} / {visibleGroups.length} 类规则</span>
        </div>
      )}

      <div className="space-y-2 mb-5">
        {visibleGroups.map((group) => {
          const isSelected = selected.has(group.ruleId);
          const isExpanded = expanded === group.ruleId;
          return (
            <div
              key={group.ruleId}
              className={[
                "rounded-xl border overflow-hidden transition-all",
                isSelected ? "border-primary/40 bg-primary/5" : "border-outline-variant/10 bg-surface-container-lowest",
              ].join(" ")}
            >
              {/* Card header — whole row is clickable for expand, checkbox is independent */}
              <div
                className="flex items-center gap-3 p-4 cursor-pointer select-none"
                onClick={() => setExpanded(isExpanded ? null : group.ruleId)}
              >
                {/* Checkbox — larger hit area, stops propagation so it doesn't also expand */}
                <div
                  className="shrink-0 flex items-center justify-center w-10 h-10 -ml-2 -my-2 rounded-lg cursor-pointer hover:bg-surface-container-high transition-colors"
                  onClick={(e) => { e.stopPropagation(); toggleSelect(group.ruleId); }}
                  title={isSelected ? "取消选中" : "选中此规则"}
                >
                  <span className={[
                    "material-symbols-outlined text-[22px] transition-colors",
                    isSelected ? "text-primary" : "text-on-surface-variant/30 hover:text-on-surface-variant",
                  ].join(" ")}>
                    {isSelected ? "check_circle" : "radio_button_unchecked"}
                  </span>
                </div>

                {/* Type icon */}
                <div className={[
                  "w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-colors",
                  isSelected ? "bg-primary/15 text-primary" : "bg-surface-container text-on-surface-variant",
                ].join(" ")}>
                  <span className="material-symbols-outlined text-[17px]">{group.icon}</span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-on-surface leading-tight">{group.label}</p>
                  <p className="text-xs text-on-surface-variant mt-0.5 leading-snug">{group.desc}</p>
                  <p className="text-[10px] font-bold text-on-surface-variant/60 mt-1">
                    {group.files.length.toLocaleString()} 个文件 · {formatBytes(group.totalSize)}
                  </p>
                </div>

                {/* Expand indicator */}
                <span className="material-symbols-outlined text-[18px] text-on-surface-variant/50 shrink-0 transition-transform" style={{ transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)" }}>
                  expand_more
                </span>
              </div>

              {isExpanded && (
                <div className="border-t border-outline-variant/10 max-h-64 overflow-y-auto">
                  {group.files.map((f: FileEntry) => (
                    <div
                      key={f.path}
                      onContextMenu={(e) => openCtx(e, f)}
                      className="flex items-center gap-3 px-4 py-2 border-b border-outline-variant/5 last:border-0 hover:bg-surface-container-high transition-colors group"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-on-surface truncate">{f.name}</p>
                        <p className="text-[10px] font-mono text-on-surface-variant/50 truncate">{f.path}</p>
                      </div>
                      <span className="text-[10px] font-bold text-on-surface-variant/60 shrink-0">{formatBytes(f.size)}</span>
                      <button
                        onClick={() => revealItemInDir(f.path).catch(() => {})}
                        title="在文件管理器中打开"
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5"
                      >
                        <span className="material-symbols-outlined text-[14px] text-on-surface-variant/50 hover:text-primary transition-colors">open_in_new</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Excluded files section */}
      {excluded.size > 0 && (
        <div className="mb-5">
          <button
            onClick={() => setShowExcluded((v) => !v)}
            className="flex items-center gap-2 text-[10px] font-bold text-on-surface-variant/50 uppercase tracking-widest hover:text-on-surface-variant transition-colors mb-2"
          >
            <span className="material-symbols-outlined text-[14px]">{showExcluded ? "expand_less" : "expand_more"}</span>
            已排除 {excluded.size} 个文件
          </button>
          {showExcluded && (
            <div className="rounded-xl border border-outline-variant/10 bg-surface-container-lowest overflow-hidden">
              {[...excluded].map((path) => {
                const name = path.split(/[\\/]/).pop() ?? path;
                return (
                  <div key={path} className="flex items-center gap-3 px-4 py-2.5 border-b border-outline-variant/5 last:border-0 hover:bg-surface-container-high transition-colors group">
                    <span className="material-symbols-outlined text-[15px] text-on-surface-variant/30 shrink-0">block</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-on-surface-variant truncate">{name}</p>
                      <p className="text-[10px] font-mono text-on-surface-variant/40 truncate">{path}</p>
                    </div>
                    <button
                      onClick={() => setExcluded((prev) => { const next = new Set(prev); next.delete(path); return next; })}
                      className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold text-primary hover:bg-primary/10"
                    >
                      <span className="material-symbols-outlined text-[13px]">undo</span>
                      恢复
                    </button>
                  </div>
                );
              })}
              <div className="px-4 py-2 border-t border-outline-variant/10 flex justify-end">
                <button
                  onClick={() => setExcluded(new Set())}
                  className="text-[10px] font-bold text-on-surface-variant/50 hover:text-error transition-colors"
                >
                  清空白名单
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {showAddForm ? (
        <AddRuleForm
          onCancel={() => setShowAddForm(false)}
          onAdd={(ruleDef) => { onAddRule(ruleDef); setShowAddForm(false); }}
        />
      ) : (
        <button
          onClick={() => setShowAddForm(true)}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-outline-variant/30 rounded-xl text-sm font-semibold text-on-surface-variant hover:border-primary/30 hover:text-primary hover:bg-primary/5 transition-all mb-6"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          添加自定义规则（glob / 正则）
        </button>
      )}

      {totalCount > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 glass-panel px-8 py-4 rounded-2xl shadow-2xl border border-white/30 flex items-center gap-8 z-50">
          <div>
            <p className="text-[10px] uppercase font-bold tracking-widest text-on-surface-variant">已选中</p>
            <p className="font-headline text-lg font-extrabold text-on-surface">
              {formatBytes(totalSize)} · {totalCount.toLocaleString()} 个文件
            </p>
          </div>
          <button
            onClick={handleClean} disabled={deleting}
            className="cta-gradient px-7 py-2.5 rounded-lg text-sm font-bold text-on-primary shadow-lg shadow-primary/20 flex items-center gap-2 active:scale-95 duration-150 disabled:opacity-60"
          >
            <span className="material-symbols-outlined text-[18px]">delete_sweep</span>
            {deleting ? "处理中…" : "移到回收站"}
          </button>
        </div>
      )}

      {/* Context menu */}
      {ctx && (
        <ContextMenu
          x={ctx.x} y={ctx.y}
          onClose={() => setCtx(null)}
          items={[
            {
              label: "复制文件名",
              icon: "file_copy",
              onClick: () => { navigator.clipboard.writeText(ctx.file.name); showToast("已复制文件名"); },
            },
            {
              label: "复制完整路径",
              icon: "content_copy",
              onClick: () => { navigator.clipboard.writeText(ctx.file.path); showToast("已复制完整路径"); },
            },
            {
              label: "复制路径和文件名",
              icon: "copy_all",
              onClick: () => { navigator.clipboard.writeText(ctx.file.path); showToast("已复制路径和文件名"); },
            },
            {
              label: "在文件管理器中打开",
              icon: "folder_open",
              onClick: () => revealItemInDir(ctx.file.path).catch(() => {}),
            },
            {
              label: "排除此文件（不再提示）",
              icon: "block",
              onClick: () => { setExcluded((prev) => new Set([...prev, ctx.file.path])); showToast("已加入白名单", "block"); },
              danger: true,
            },
          ]}
        />
      )}
      {ToastContainer}
    </div>
  );
}
