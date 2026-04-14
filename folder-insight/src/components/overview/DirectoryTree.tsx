import { useState, useEffect } from "react";
import { openPath, revealItemInDir } from "@tauri-apps/plugin-opener";
import type { FolderEntry, FolderChild } from "../../types";
import ContextMenu from "../ui/ContextMenu";

interface Props {
  root: FolderEntry;
  selected: FolderChild | null;
  onSelect: (node: FolderChild) => void;
  currentFolderPath?: string;
  onNavigateToRoot: () => void; // reset treemap stack back to root
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

interface TreeNodeProps {
  child: FolderChild;
  depth: number;
  selected: FolderChild | null;
  currentFolderPath?: string;
  onSelect: (node: FolderChild) => void;
  onContextMenu: (e: React.MouseEvent, child: FolderChild) => void;
}

function TreeNode({ child, depth, selected, currentFolderPath, onSelect, onContextMenu }: TreeNodeProps) {
  // Auto-expand if this folder is on the path to the current treemap folder
  const shouldExpandForCurrent = child.kind === "folder" && currentFolderPath
    ? isAncestorOrSelf(child.path, currentFolderPath)
    : false;

  // Auto-expand if the selected node is a descendant of this folder
  const shouldExpandForSelected = child.kind === "folder" && selected !== null
    ? isAncestorOrSelf(child.path, selected.path) && selected.path !== child.path
    : false;

  const [expanded, setExpanded] = useState(shouldExpandForCurrent || shouldExpandForSelected);

  // Sync expansion when currentFolderPath or selected changes
  useEffect(() => {
    if (shouldExpandForCurrent || shouldExpandForSelected) setExpanded(true);
  }, [shouldExpandForCurrent, shouldExpandForSelected]);

  const isSelected = selected !== null && selected.path === child.path;
  const isCurrentFolder = child.kind === "folder" && child.path === currentFolderPath;
  // Ancestor of selected node — show subtle highlight
  const isAncestorOfSelected = !isSelected && selected !== null && child.kind === "folder"
    && isAncestorOrSelf(child.path, selected.path);

  if (child.kind === "file") {
    return (
      <button
        onClick={() => onSelect(child)}
        onContextMenu={(e) => onContextMenu(e, child)}
        className={[
          "w-full flex items-center gap-2 py-1.5 text-left transition-colors",
          isSelected
            ? "bg-primary/10 text-primary"
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

  return (
    <div>
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
        <span className="text-[10px] font-bold shrink-0 opacity-60">{formatBytes(child.size)}</span>
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

export default function DirectoryTree({ root, selected, onSelect, currentFolderPath, onNavigateToRoot }: Props) {
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
