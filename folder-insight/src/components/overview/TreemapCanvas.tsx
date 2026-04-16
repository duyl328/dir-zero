import { useRef, useEffect, useState, useMemo, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { openPath, revealItemInDir } from "@tauri-apps/plugin-opener";
import type { SlimFolderEntry, FolderChild, FileEntry } from "../../types";
import ContextMenu from "../ui/ContextMenu";

// ── Types ─────────────────────────────────────────────────────────────────────

// A unified child type for the treemap: either a slim folder or a file leaf
type TreeChild =
  | ({ kind: "folder" } & SlimFolderEntry)
  | ({ kind: "file" } & FileEntry);

interface Rect {
  x: number; y: number; w: number; h: number;
  child: TreeChild;
}

interface DrawRect extends Rect {
  depth: number;
}

interface Props {
  root: SlimFolderEntry;
  colorMode: "type" | "age";
  selected: FolderChild | null;
  onSelect: (node: FolderChild | null) => void;
  stack: SlimFolderEntry[];
  onStackChange: (stack: SlimFolderEntry[]) => void;
}

// ── Squarified treemap algorithm ─────────────────────────────────────────────

function squarify(children: TreeChild[], x: number, y: number, w: number, h: number): Rect[] {
  const total = children.reduce((s, c) => s + c.size, 0);
  if (total === 0 || !children.length) return [];
  const out: Rect[] = [];
  layoutStrip(children, x, y, w, h, total, out);
  return out;
}

function layoutStrip(items: TreeChild[], x: number, y: number, w: number, h: number, total: number, out: Rect[]) {
  if (!items.length || total === 0) return;
  const normalize = (s: number) => (s / total) * w * h;
  let strip: TreeChild[] = [], stripSize = 0, i = 0;
  while (i < items.length) {
    const item = items[i];
    const ns = [...strip, item], nz = stripSize + item.size;
    if (!strip.length || worstRatio(ns, nz, w, h, normalize) <= worstRatio(strip, stripSize, w, h, normalize)) {
      strip = ns; stripSize = nz; i++;
    } else {
      const [nx, ny, nw, nh] = nextSlice(stripSize, x, y, w, h, normalize);
      placeStrip(strip, stripSize, x, y, w, h, normalize, out);
      layoutStrip(items.slice(i), nx, ny, nw, nh, total - stripSize, out);
      return;
    }
  }
  placeStrip(strip, stripSize, x, y, w, h, normalize, out);
}

function worstRatio(strip: TreeChild[], sz: number, w: number, h: number, N: (s: number) => number) {
  if (!strip.length || sz === 0) return Infinity;
  const tot = N(sz), sh = Math.min(w, h), sl = tot / sh;
  return Math.max(...strip.map(c => { const iw = N(c.size) / sl; return Math.max(sl / iw, iw / sl); }));
}

function nextSlice(sz: number, x: number, y: number, w: number, h: number, N: (s: number) => number): [number, number, number, number] {
  const tot = N(sz);
  return w >= h ? [x + tot / h, y, w - tot / h, h] : [x, y + tot / w, w, h - tot / w];
}

function placeStrip(strip: TreeChild[], sz: number, x: number, y: number, w: number, h: number, N: (s: number) => number, out: Rect[]) {
  const tot = N(sz); let cur = 0;
  if (w >= h) { const sw = tot / h; for (const c of strip) { const rh = N(c.size) / sw; out.push({ x, y: y + cur, w: sw, h: rh, child: c }); cur += rh; } }
  else { const sh = tot / w; for (const c of strip) { const rw = N(c.size) / sh; out.push({ x: x + cur, y, w: rw, h: sh, child: c }); cur += rw; } }
}

// ── Recursive layout with inline expansion ────────────────────────────────────

const EXPAND_HEADER = 22; // px — height of expanded folder's title strip
const PAD = 3;

function computeAllRects(
  children: TreeChild[],
  x: number, y: number, w: number, h: number,
  depth: number,
  expanded: Set<string>
): DrawRect[] {
  if (!children.length || w < 6 || h < 6) return [];
  const top = squarify(children, x, y, w, h);
  const all: DrawRect[] = [];
  for (const r of top) {
    all.push({ ...r, depth });
    if (r.child.kind === "folder" && expanded.has(r.child.path) && r.child.children.length > 0) {
      const sx = r.x + PAD, sy = r.y + EXPAND_HEADER;
      const sw = r.w - PAD * 2, sh = r.h - EXPAND_HEADER - PAD;
      if (sw > 8 && sh > 8) {
        // Slim folder children are SlimFolderEntry — wrap as TreeChild
        const subChildren: TreeChild[] = r.child.children.map((c) => ({ kind: "folder" as const, ...c }));
        all.push(...computeAllRects(subChildren, sx, sy, sw, sh, depth + 1, expanded));
      }
    }
  }
  return all;
}

// ── Color helpers ─────────────────────────────────────────────────────────────

// Auto-expand folders whose initial rect is large enough to show children meaningfully
function getAutoExpanded(children: TreeChild[], w: number, h: number): Set<string> {
  const result = new Set<string>();
  const rects = squarify(children, 0, 0, w, h);
  for (const r of rects) {
    if (r.child.kind !== "folder" || r.child.children.length === 0) continue;
    const innerW = r.w - PAD * 2;
    const innerH = r.h - EXPAND_HEADER - PAD;
    if (innerW >= 110 && innerH >= 70) result.add(r.child.path);
  }
  return result;
}

// ── Color helpers ─────────────────────────────────────────────────────────────

const FILE_TYPE_COLORS: Record<string, string> = {
  image: "#f59e0b", video: "#06b6d4", audio: "#ec4899", document: "#94a3b8",
  archive: "#8b5cf6", installer: "#ef4444", code: "#10b981", database: "#f97316",
  design: "#e879f9", model: "#34d399", font: "#a78bfa", disk_image: "#fb7185",
  system: "#64748b", cache: "#6b7280", unknown: "#a9b4b9",
};
const FOLDER_COLORS = ["#6366f1", "#3b82f6", "#0ea5e9", "#06b6d4", "#14b8a6", "#10b981", "#84cc16", "#eab308"];

function folderColor(name: string): string {
  let h = 0; for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return FOLDER_COLORS[Math.abs(h) % FOLDER_COLORS.length];
}

function nodeColor(child: TreeChild, colorMode: "type" | "age"): string {
  if (child.kind === "folder") return colorMode === "age" ? "#64748b" : folderColor(child.name);
  if (colorMode === "age") {
    const d = (Date.now() - child.modifiedAt) / 86400000;
    return d < 30 ? "#10b981" : d < 365 ? "#f59e0b" : "#ef4444";
  }
  return FILE_TYPE_COLORS[child.fileType] ?? "#a9b4b9";
}

function formatBytes(b: number): string {
  if (b < 1e6) return `${(b / 1e3).toFixed(0)} KB`;
  if (b < 1e9) return `${(b / 1e6).toFixed(1)} MB`;
  return `${(b / 1e9).toFixed(2)} GB`;
}

// Truncate text with ellipsis instead of letting canvas compress it.
// cache: per-draw Map keyed by "${font}|${text}" to avoid redundant measureText calls.
function truncateText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, cache: Map<string, number>): string {
  if (maxWidth <= 0) return "";
  const font = ctx.font;
  const measure = (s: string) => {
    const k = `${font}|${s}`;
    const cached = cache.get(k);
    if (cached !== undefined) return cached;
    const w = ctx.measureText(s).width;
    cache.set(k, w);
    return w;
  };
  if (measure(text) <= maxWidth) return text;
  const ellipsisW = measure("…");
  if (ellipsisW >= maxWidth) return "";
  let lo = 0, hi = text.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (measure(text.slice(0, mid)) + ellipsisW <= maxWidth) lo = mid;
    else hi = mid - 1;
  }
  return lo === 0 ? "" : text.slice(0, lo) + "…";
}

// ── Canvas helpers ────────────────────────────────────────────────────────────

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  if (w < r * 2) r = w / 2; if (h < r * 2) r = h / 2;
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function TreemapCanvas({ root, colorMode, selected, onSelect, stack, onStackChange }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  const [dims, setDims] = useState({ w: 0, h: 0 });
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; child: TreeChild } | null>(null);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const initializedPathRef = useRef<string | null>(null);

  // Cache of lazy-loaded file leaves per folder path
  const fileCacheRef = useRef<Map<string, FileEntry[]>>(new Map());

  // Text measurement cache — cleared each draw to stay in sync with font/dpr changes
  const measureCacheRef = useRef<Map<string, number>>(new Map());

  // RAF throttle refs for mousemove hit-testing
  const rafPendingRef = useRef(false);
  const mousePosRef = useRef({ x: 0, y: 0 });

  const current = stack[stack.length - 1] ?? root;

  // Build TreeChild[] for the current folder (slim folder children only — files not in slim tree)
  const currentChildren = useMemo<TreeChild[]>(
    () => current.children.map((c) => ({ kind: "folder" as const, ...c })),
    [current]
  );

  // Lazy-load file leaves for the current folder and merge into children
  const [fileLeaves, setFileLeaves] = useState<FileEntry[]>([]);
  const loadFiles = useCallback(async (folderPath: string) => {
    if (fileCacheRef.current.has(folderPath)) {
      setFileLeaves(fileCacheRef.current.get(folderPath)!);
      return;
    }
    try {
      const files = await invoke<FileEntry[]>("get_folder_files", { path: folderPath });
      fileCacheRef.current.set(folderPath, files);
      setFileLeaves(files);
    } catch {
      setFileLeaves([]);
    }
  }, []);

  useEffect(() => { loadFiles(current.path); }, [current.path, loadFiles]);

  const allChildren = useMemo<TreeChild[]>(() => {
    const fileChildren: TreeChild[] = fileLeaves.map((f) => ({ kind: "file" as const, ...f }));
    return [...currentChildren, ...fileChildren].sort((a, b) => b.size - a.size);
  }, [currentChildren, fileLeaves]);

  // Reset when root changes
  useEffect(() => { onStackChange([root]); }, [root]);

  // When navigating to a new folder, auto-expand large folders
  useEffect(() => {
    if (dims.w === 0 || dims.h === 0) return;
    if (initializedPathRef.current === current.path) return;
    initializedPathRef.current = current.path;
    setExpandedPaths(getAutoExpanded(currentChildren, dims.w, dims.h));
  }, [current.path, dims.w, dims.h, currentChildren]);

  // Resize observer
  useEffect(() => {
    const el = containerRef.current; if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      const { width, height } = e.contentRect;
      setDims({ w: Math.round(width), h: Math.round(height) });
    });
    ro.observe(el); return () => ro.disconnect();
  }, []);

  // All drawable rects (memoized by a string key of expanded set)
  const expandedKey = useMemo(() => [...expandedPaths].join("|"), [expandedPaths]);
  const allRects = useMemo<DrawRect[]>(() => {
    if (dims.w === 0 || dims.h === 0) return [];
    return computeAllRects(allChildren, 0, 0, dims.w, dims.h, 0, expandedPaths);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dims, allChildren, expandedKey]);

  // Keep a ref for event handlers to avoid stale closure issues
  const allRectsRef = useRef(allRects);
  allRectsRef.current = allRects;

  // ── Draw ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || dims.w === 0 || dims.h === 0) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = dims.w * dpr; canvas.height = dims.h * dpr;
    canvas.style.width = `${dims.w}px`; canvas.style.height = `${dims.h}px`;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, dims.w, dims.h);

    // Clear text measurement cache — font/dpr may have changed
    measureCacheRef.current.clear();
    const mc = measureCacheRef.current;

    // Draw in depth order so sub-rects appear on top of their parents
    const sorted = [...allRects].sort((a, b) => a.depth - b.depth);

    // Pass 1: backgrounds + labels
    for (const { x, y, w, h, child, depth } of sorted) {
      if (w < 2 || h < 2) continue;
      const color = nodeColor(child, colorMode);
      const isHov = hovered !== null && allRects[hovered]?.child.path === child.path;
      const isSel = selected?.path === child.path;
      const isExp = child.kind === "folder" && expandedPaths.has(child.path);

      ctx.save();
      roundRect(ctx, x + PAD, y + PAD, w - PAD * 2, h - PAD * 2, 4 - depth);
      ctx.fillStyle = color + (isSel ? "ee" : isHov ? "cc" : depth > 0 ? "99" : "88");
      ctx.fill();

      if (isExp && child.kind === "folder") {
        // Header strip for expanded folder
        ctx.save();
        roundRect(ctx, x + PAD, y + PAD, w - PAD * 2, EXPAND_HEADER - PAD, 4 - depth);
        ctx.fillStyle = color + "dd";
        ctx.fill();
        ctx.restore();

        // Folder name in header (left-aligned)
        const name = child.name + "/";
        const headerTextW = w - PAD * 2 - 24;
        ctx.fillStyle = "#ffffff";
        ctx.globalAlpha = 0.95;
        ctx.font = `bold 11px Inter, system-ui, sans-serif`;
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        const tHeaderName = truncateText(ctx, name, headerTextW, mc);
        if (tHeaderName) ctx.fillText(tHeaderName, x + PAD + 6, y + PAD + (EXPAND_HEADER - PAD) / 2);
        // Collapse indicator
        ctx.font = `12px "Material Symbols Outlined", system-ui, sans-serif`;
        ctx.textAlign = "right";
        ctx.fillText("−", x + w - PAD - 6, y + PAD + (EXPAND_HEADER - PAD) / 2);
        ctx.globalAlpha = 1;
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
      } else {
        // Centered label for unexpanded nodes
        const innerW = w - PAD * 2 - 8;
        const innerH = h - PAD * 2;
        if (innerW > 20 && innerH > 14) {
          const cx = x + w / 2, cy = y + h / 2;
          const name = child.kind === "folder" ? child.name + "/" : child.name;
          const sizeStr = formatBytes(child.size);
          const fontSize = Math.min(13, Math.max(9, Math.min(innerW / 7, innerH / 4)));
          const showSize = innerH > fontSize * 3.5 && depth === 0;

          ctx.textAlign = "center"; ctx.textBaseline = "middle";

          if (showSize) {
            const sf = Math.max(8, fontSize - 2), gap = 3;
            const totalH = fontSize + gap + sf;
            const nameY = cy - totalH / 2 + fontSize / 2;
            const sizeY = nameY + fontSize / 2 + gap + sf / 2;
            ctx.font = `bold ${fontSize}px Inter, system-ui, sans-serif`;
            ctx.fillStyle = "#ffffff"; ctx.globalAlpha = 0.95;
            const tName = truncateText(ctx, name, innerW, mc);
            if (tName) ctx.fillText(tName, cx, nameY);
            ctx.font = `${sf}px Inter, system-ui, sans-serif`;
            ctx.globalAlpha = 0.65;
            const tSize = truncateText(ctx, sizeStr, innerW, mc);
            if (tSize) ctx.fillText(tSize, cx, sizeY);
          } else {
            ctx.font = `bold ${fontSize}px Inter, system-ui, sans-serif`;
            ctx.fillStyle = "#ffffff"; ctx.globalAlpha = 0.95;
            const tName = truncateText(ctx, name, innerW, mc);
            if (tName) ctx.fillText(tName, cx, cy);
          }
          ctx.globalAlpha = 1; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
        }
      }
      ctx.restore();
    }

    // Pass 2: borders (hover / selected — always on top)
    for (const { x, y, w, h, child } of sorted) {
      if (w < 2 || h < 2) continue;
      const isHov = hovered !== null && allRects[hovered]?.child.path === child.path;
      const isSel = selected?.path === child.path;
      if (!isHov && !isSel) continue;
      const color = nodeColor(child, colorMode);
      ctx.save();
      roundRect(ctx, x + PAD, y + PAD, w - PAD * 2, h - PAD * 2, 4);
      ctx.strokeStyle = isSel ? "#ffffff" : color;
      ctx.lineWidth = isSel ? 2 : 1.5;
      ctx.stroke();
      ctx.restore();
    }
  }, [dims, hovered, selected, colorMode, allRects, expandedPaths]);

  // ── Hit testing ───────────────────────────────────────────────────────────

  function getDeepestAt(mx: number, my: number): number | null {
    const rects = allRectsRef.current;
    let best: number | null = null, bestDepth = -1, bestArea = Infinity;
    rects.forEach((r, i) => {
      if (mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h) {
        const area = r.w * r.h;
        if (r.depth > bestDepth || (r.depth === bestDepth && area < bestArea)) {
          bestDepth = r.depth; bestArea = area; best = i;
        }
      }
    });
    return best;
  }

  // ── Event handlers ────────────────────────────────────────────────────────

  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    const r = canvasRef.current!.getBoundingClientRect();
    mousePosRef.current = { x: e.clientX - r.left, y: e.clientY - r.top };
    if (rafPendingRef.current) return;
    rafPendingRef.current = true;
    requestAnimationFrame(() => {
      rafPendingRef.current = false;
      const idx = getDeepestAt(mousePosRef.current.x, mousePosRef.current.y);
      setHovered(idx);
    });
  }

  function handleClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const r = canvasRef.current!.getBoundingClientRect();
    const idx = getDeepestAt(e.clientX - r.left, e.clientY - r.top);
    if (idx === null) { onSelect(null); return; }
    const child = allRectsRef.current[idx].child;
    // Convert TreeChild to FolderChild for the parent's onSelect
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { kind: _k, ...rest } = child;
    onSelect(child.kind === "folder" ? { kind: "folder", ...rest } as FolderChild : { kind: "file", ...rest } as FolderChild);
    if (child.kind === "folder") {
      // Single click: toggle inline expansion
      setExpandedPaths(prev => {
        const next = new Set(prev);
        if (next.has(child.path)) next.delete(child.path);
        else next.add(child.path);
        return next;
      });
    }
  }

  function handleDoubleClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const r = canvasRef.current!.getBoundingClientRect();
    const idx = getDeepestAt(e.clientX - r.left, e.clientY - r.top);
    if (idx === null) return;
    const child = allRectsRef.current[idx].child;
    if (child.kind === "folder" && child.children.length > 0) {
      onStackChange([...stack, child]);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { kind: _k, ...rest } = child;
      onSelect({ kind: "folder", ...rest } as FolderChild);
      setHovered(null);
      setFileLeaves([]);
    }
  }

  function handleContextMenu(e: React.MouseEvent<HTMLCanvasElement>) {
    e.preventDefault();
    const r = canvasRef.current!.getBoundingClientRect();
    const idx = getDeepestAt(e.clientX - r.left, e.clientY - r.top);
    if (idx === null) return;
    setContextMenu({ x: e.clientX, y: e.clientY, child: allRectsRef.current[idx].child });
  }

  // ── Hovered node (for tooltip) ────────────────────────────────────────────

  const hoveredChild = hovered !== null ? allRects[hovered]?.child : null;
  const canGoUp = stack.length > 1;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div ref={containerRef} className="flex-1 relative bg-surface-container rounded-xl m-2 overflow-hidden">

      {/* 返回上级 — 右上角 */}
      {canGoUp && (
        <button
          onClick={() => { onStackChange(stack.slice(0, -1)); onSelect(null); setHovered(null); }}
          className="absolute top-3 right-3 z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/40 hover:bg-black/60 text-white text-xs font-bold backdrop-blur-sm transition-all active:scale-95"
        >
          <span className="material-symbols-outlined text-[16px]">arrow_upward</span>
          返回上级
        </button>
      )}

      {!canGoUp && (
        <div className="absolute top-3 right-3 z-10 flex items-center gap-1 text-[10px] text-on-surface-variant/40 pointer-events-none select-none">
          <span className="material-symbols-outlined text-[12px]">touch_app</span>
          单击展开 · 双击进入
        </div>
      )}

      <canvas
        ref={canvasRef}
        className="w-full h-full cursor-pointer"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHovered(null)}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
      />

      {/* Tooltip */}
      {hoveredChild && !contextMenu && (
        <div className="absolute bottom-3 right-3 glass-panel px-4 py-3 rounded-xl border border-white/30 shadow-xl pointer-events-none z-20" style={{ minWidth: 180 }}>
          <p className="font-headline font-bold text-sm text-on-surface truncate max-w-[200px]">
            {hoveredChild.kind === "folder" ? hoveredChild.name + "/" : hoveredChild.name}
          </p>
          <p className="text-xs text-on-surface-variant mt-0.5">{formatBytes(hoveredChild.size)}</p>
          {hoveredChild.kind === "folder" && (
            <p className="text-[10px] text-on-surface-variant/60 mt-1">
              {expandedPaths.has(hoveredChild.path) ? "单击折叠 · 双击进入" : `单击展开 · 双击进入`}
            </p>
          )}
        </div>
      )}

      {/* Context menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x} y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          items={[
            {
              label: "在文件管理器中打开",
              icon: "folder_open",
              onClick: () => revealItemInDir(contextMenu.child.path).catch(() => openPath(contextMenu.child.path).catch(() => {})),
            },
            ...(contextMenu.child.kind === "folder" && contextMenu.child.children.length > 0
              ? [{
                  label: "进入此文件夹",
                  icon: "subdirectory_arrow_right",
                  onClick: () => {
                    const child = contextMenu.child;
                    if (child.kind === "folder") {
                      // eslint-disable-next-line @typescript-eslint/no-unused-vars
                      const { kind: _k, ...rest } = child;
                      onStackChange([...stack, child]); onSelect({ kind: "folder", ...rest } as FolderChild); setHovered(null); setFileLeaves([]);
                    }
                  },
                }]
              : []),
          ]}
        />
      )}
    </div>
  );
}
