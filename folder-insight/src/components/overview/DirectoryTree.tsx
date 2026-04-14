import { useState, useEffect } from "react";
import { openPath, revealItemInDir } from "@tauri-apps/plugin-opener";
import type { FolderEntry, FolderChild } from "../../types";
import ContextMenu from "../ui/ContextMenu";

interface Props {
  root: FolderEntry;
  selected: FolderChild | null;
  onSelect: (node: FolderChild) => void;
  currentFolderPath?: string;
  onNavigateToRoot: () => void;
  matchedPaths?: Set<string>; // when search is active: paths of matching files
}

function formatBytes(b: number): string {
  if (b < 1e6) return `${(b / 1e3).toFixed(0)} KB`;
  if (b < 1e9) return `${(b / 1e6).toFixed(1)} MB`;
  return `${(b / 1e9).toFixed(2)} GB`;
}

function getFolderIcon(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes("video") || lower.includes("movie")) return "video_library";
  if (lower.includes("image") || lower.includes("photo") || lower.includes("picture")) return "photo_library";
  if (lower.includes("music") || lower.includes("audio")) return "library_music";
  if (lower.includes("download")) return "download";
  if (lower.includes("document") || lower.includes("doc")) return "description";
  if (lower.includes("code") || lower.includes("src") || lower.includes("project")) return "code";
  if (lower.includes("cache") || lower.includes("temp")) return "cached";
  if (lower.includes("system") || lower.includes("windows")) return "settings_system_daydream";
  if (lower === "node_modules") return "code";
  if (lower === ".git") return "code_blocks";
  return "folder";
}

// Check if a path is an ancestor of (or equal to) another path
function isAncestorOrSelf(ancestorPath: string, childPath: string): boolean {
  if (ancestorPath === childPath) return true;
  return childPath.startsWith(ancestorPath + "\\") || childPath.startsWith(ancestorPath + "/");
}

// Returns true if this folder contains any matched path
function folderHasMatch(folder: FolderEntry, matchedPaths: Set<string>): boolean {
  for (const child of folder.children) {
    if (child.kind === "file" && matchedPaths.has(child.path)) return true;
    if (child.kind === "folder" && folderHasMatch(child, matchedPaths)) return true;
  }
  return false;
}

function countFolderMatches(folder: FolderEntry, matchedPaths: Set<string>): number {
  let n = 0;
  for (const child of folder.children) {
    if (child.kind === "file" && matchedPaths.has(child.path)) n++;
    else if (child.kind === "folder") n += countFolderMatches(child, matchedPaths);
  }
  return n;
}

interface TreeNodeProps {
  child: FolderChild;
  depth: number;
  selected: FolderChild | null;
  currentFolderPath?: string;
  onSelect: (node: FolderChild) => void;
  onContextMenu: (e: React.MouseEvent, child: FolderChild) => void;
  matchedPaths?: Set<string>;
}

function TreeNode({ child, depth, selected, currentFolderPath, onSelect, onContextMenu, matchedPaths }: TreeNodeProps) {
  // Auto-expand if this folder is on the path to the current treemap folder
  const shouldExpandForCurrent = child.kind === "folder" && currentFolderPath
    ? isAncestorOrSelf(child.path, currentFolderPath)
    : false;

  // Auto-expand if the selected node is a descendant of this folder
  const shouldExpandForSelected = child.kind === "folder" && selected !== null
    ? isAncestorOrSelf(child.path, selected.path) && selected.path !== child.path
    : false;

  const isSearching = matchedPaths !== undefined;

  // In search mode: auto-expand folders that contain matches
  const shouldExpandForSearch = isSearching && child.kind === "folder"
    ? folderHasMatch(child, matchedPaths!)
    : false;

  const [expanded, setExpanded] = useState(shouldExpandForCurrent || shouldExpandForSelected);

  // Sync expansion when currentFolderPath, selected, or search changes
  useEffect(() => {
    if (shouldExpandForCurrent || shouldExpandForSelected || shouldExpandForSearch) setExpanded(true);
    else if (isSearching) setExpanded(false); // collapse non-matching folders when search activates
  }, [shouldExpandForCurrent, shouldExpandForSelected, shouldExpandForSearch, isSearching]);

  const isSelected = selected !== null && selected.path === child.path;
  const isCurrentFolder = child.kind === "folder" && child.path === currentFolderPath;
  const isAncestorOfSelected = !isSelected && selected !== null && child.kind === "folder"
    && isAncestorOrSelf(child.path, selected.path);

  // Search-mode visibility
  const isFileMatch = isSearching && child.kind === "file" && matchedPaths!.has(child.path);
  const isFolderWithMatches = isSearching && child.kind === "folder" && folderHasMatch(child, matchedPaths!);
  const isDimmed = isSearching && !isFileMatch && !isFolderWithMatches;

  if (child.kind === "file") {
    if (isSearching && !isFileMatch) return null; // hide non-matching files in search mode
    return (
      <button
        onClick={() => onSelect(child)}
        onContextMenu={(e) => onContextMenu(e, child)}
        className={[
          "w-full flex items-center gap-2 py-1.5 text-left transition-colors",
          isSelected
            ? "bg-primary/10 text-primary"
            : isFileMatch
            ? "text-primary/80 hover:bg-primary/5"
            : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface",
        ].join(" ")}
        style={{ paddingLeft: `${(depth + 1) * 14 + 4}px`, paddingRight: "12px" }}
      >
        <span className="material-symbols-outlined text-[14px] shrink-0 opacity-60">insert_drive_file</span>
        <span className="text-xs truncate flex-1">{child.name}</span>
        <span className="text-[10px] font-bold shrink-0 opacity-50">{formatBytes(child.size)}</span>
      </button>
    );
  }

  const hasChildren = child.children.length > 0;
  const subFolders = child.children.filter((c) => c.kind === "folder");
  const matchCount = isSearching && child.kind === "folder"
    ? countFolderMatches(child, matchedPaths!)
    : 0;

  return (
    <div className={isDimmed ? "opacity-30" : undefined}>
      <button
        onClick={() => {
          onSelect(child);
          if (hasChildren) setExpanded((e) => !e);
        }}
        onContextMenu={(e) => onContextMenu(e, child)}
        className={[
          "w-full flex items-center gap-2 py-1.5 text-left transition-colors",
          isSelected
            ? "bg-primary/10 text-primary"
            : isAncestorOfSelected
            ? "bg-primary/5 text-primary/80"
            : isCurrentFolder
            ? "bg-primary/5 text-primary/70"
            : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface",
        ].join(" ")}
        style={{ paddingLeft: `${(depth + 1) * 14 + 4}px`, paddingRight: "12px" }}
      >
        <span className="material-symbols-outlined text-[14px] shrink-0 opacity-60">
          {!hasChildren ? "remove" : expanded ? "expand_more" : "chevron_right"}
        </span>
        <span className="material-symbols-outlined text-[16px] shrink-0">
          {getFolderIcon(child.name)}
        </span>
        <span className="text-xs font-medium truncate flex-1">{child.name}</span>
        {matchCount > 0 && (
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-primary/15 text-primary shrink-0">
            {matchCount}
          </span>
        )}
        {!isSearching && (
          <span className="text-[10px] font-bold shrink-0 opacity-60">{formatBytes(child.size)}</span>
        )}
      </button>

      {expanded && subFolders.length > 0 && (
        <div>
          {subFolders.slice(0, 50).map((c) => (
            <TreeNode
              key={c.path}
              child={c}
              depth={depth + 1}
              selected={selected}
              currentFolderPath={currentFolderPath}
              onSelect={onSelect}
              onContextMenu={onContextMenu}
              matchedPaths={matchedPaths}
            />
          ))}
          {subFolders.length > 50 && (
            <div className="text-[10px] text-on-surface-variant/40 py-1" style={{ paddingLeft: `${(depth + 2) * 14 + 4}px` }}>
              还有 {subFolders.length - 50} 个子文件夹…
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function DirectoryTree({ root, selected, onSelect, currentFolderPath, onNavigateToRoot, matchedPaths }: Props) {
  const topChildren = [...root.children].sort((a, b) => b.size - a.size);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; child: FolderChild } | null>(null);
  const isAtRoot = !currentFolderPath || currentFolderPath === root.path;

  function handleContextMenu(e: React.MouseEvent, child: FolderChild) {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, child });
  }

  return (
    <div className="py-2">
      {/* Root selector header */}
      <button
        onClick={onNavigateToRoot}
        className={[
          "w-full flex items-center gap-2 px-3 py-2 mb-1 text-left transition-colors border-b border-outline-variant/10",
          isAtRoot
            ? "bg-primary/8 text-primary"
            : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface",
        ].join(" ")}
        title={root.path}
      >
        <span className="material-symbols-outlined text-[16px] shrink-0" style={isAtRoot ? { fontVariationSettings: "'FILL' 1" } : undefined}>
          hard_drive
        </span>
        <span className="text-xs font-bold truncate flex-1">{root.name || root.path}</span>
        <span className="text-[10px] font-bold shrink-0 opacity-60">{formatBytes(root.size)}</span>
      </button>
      {topChildren.length === 0 ? (
        <p className="text-xs text-on-surface-variant/40 px-4 py-2">无内容</p>
      ) : (
        topChildren.map((child) => (
          <TreeNode
            key={child.path}
            child={child}
            depth={0}
            selected={selected}
            currentFolderPath={currentFolderPath}
            onSelect={onSelect}
            onContextMenu={handleContextMenu}
            matchedPaths={matchedPaths}
          />
        ))
      )}

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          items={[
            {
              label: "在文件管理器中打开",
              icon: "folder_open",
              onClick: () => revealItemInDir(contextMenu.child.path).catch(() =>
                openPath(contextMenu.child.path).catch(() => {})
              ),
            },
          ]}
        />
      )}
    </div>
  );
}
