import type { FolderEntry } from "../types";

export interface StructureItem {
  path: string;
  name: string;
  detail: string;
}

export interface StructureAnalysisResult {
  emptyFolders: StructureItem[];
  zeroByteFiles: StructureItem[];
  pathIssues: StructureItem[];
  singleChildChains: StructureItem[];
  denseSmall: StructureItem[];
}

const DEEP_NEST_THRESHOLD = 8;
const LONG_PATH_WARN = 200;
const DENSE_MIN_FILES = 1000;
const DENSE_MAX_AVG_BYTES = 10_000;

export function analyzeStructure(root: FolderEntry): StructureAnalysisResult {
  const result: StructureAnalysisResult = {
    emptyFolders: [],
    zeroByteFiles: [],
    pathIssues: [],
    singleChildChains: [],
    denseSmall: [],
  };
  traverseFolder(root, result);
  return result;
}

function traverseFolder(folder: FolderEntry, result: StructureAnalysisResult) {
  const directFiles = folder.children.filter((c) => c.kind === "file");
  const directFolders = folder.children.filter((c) => c.kind === "folder");

  // Empty folder
  if (folder.children.length === 0 && folder.depth > 0) {
    result.emptyFolders.push({ path: folder.path, name: folder.name, detail: "空目录" });
  }

  // Deep nesting
  if (folder.depth > DEEP_NEST_THRESHOLD) {
    result.pathIssues.push({
      path: folder.path,
      name: folder.name,
      detail: `嵌套深度 ${folder.depth} 层`,
    });
  } else if (folder.path.length > LONG_PATH_WARN) {
    // Long path (only add if not already flagged for deep nesting to avoid double-counting)
    result.pathIssues.push({
      path: folder.path,
      name: folder.name,
      detail: `路径长度 ${folder.path.length} 字符`,
    });
  }

  // Single-child chain: only 1 subfolder, no direct files
  if (directFolders.length === 1 && directFiles.length === 0 && folder.depth > 0) {
    result.singleChildChains.push({
      path: folder.path,
      name: folder.name,
      detail: "仅含一个子文件夹，形成冗余嵌套",
    });
  }

  // Dense small files (use recursive fileCount for detection, but only flag the folder itself)
  if (folder.fileCount > DENSE_MIN_FILES) {
    const avgSize = folder.fileCount > 0 ? folder.size / folder.fileCount : 0;
    if (avgSize < DENSE_MAX_AVG_BYTES) {
      result.denseSmall.push({
        path: folder.path,
        name: folder.name,
        detail: `${folder.fileCount.toLocaleString()} 个文件，均 ${(avgSize / 1024).toFixed(1)} KB`,
      });
    }
  }

  // Recurse into children
  for (const child of folder.children) {
    if (child.kind === "folder") {
      traverseFolder(child, result);
    } else {
      // Zero-byte files
      if (child.size === 0) {
        result.zeroByteFiles.push({ path: child.path, name: child.name, detail: "0 字节文件" });
      }
      // Long path for files
      if (child.path.length > LONG_PATH_WARN) {
        result.pathIssues.push({
          path: child.path,
          name: child.name,
          detail: `路径长度 ${child.path.length} 字符`,
        });
      }
    }
  }
}
