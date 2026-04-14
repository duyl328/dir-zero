// Global app state
export type ScanStatus = "idle" | "configuring" | "scanning" | "done";

export interface ScanSession {
  id: string;
  roots: string[];
  status: ScanStatus;
  progress: ScanProgress | null;
  result: ScanResult | null;
  startedAt: number | null;
}

export interface ScanProgress {
  filesFound: number;
  totalSize: number;
  currentPath: string;
  elapsedMs: number;
  mode: "mft" | "compat";
}

export interface ScanResult {
  totalSize: number;
  fileCount: number;
  folderCount: number;
  largestFile: FileEntry | null;
  largestFolder: FolderEntry | null;
  issueCount: number;
  tree: FolderEntry;
}

export interface FileEntry {
  path: string;
  name: string;
  ext: string;
  size: number;
  sizeOnDisk: number;
  modifiedAt: number;
  createdAt: number;
  fileType: FileTypeCategory;
  isHidden: boolean;
}

export interface FolderEntry {
  path: string;
  name: string;
  size: number;
  fileCount: number;
  folderCount: number;
  children: FolderChild[];
  depth: number;
}

export type FolderChild =
  | ({ kind: "folder" } & FolderEntry)
  | ({ kind: "file" } & FileEntry);

export type FileTypeCategory =
  | "image"
  | "video"
  | "audio"
  | "document"
  | "archive"
  | "installer"
  | "code"
  | "database"
  | "design"
  | "model"
  | "font"
  | "disk_image"
  | "system"
  | "cache"
  | "unknown";

export interface DuplicateCluster {
  id: string;
  hash: string;
  fileSize: number;
  files: FileEntry[];
  reclaimable: number;
  suggestedKeep: string; // path
}

export interface StructureIssue {
  type: "empty_folder" | "deep_nest" | "long_path" | "single_child_chain" | "dense_small" | "odd_name";
  path: string;
  severity: "safe" | "caution";
  detail: string;
}

export interface ResidueFile {
  path: string;
  size: number;
  ruleId: string;
  ruleName: string;
  ruleDesc: string;
}

export interface ExcludeRule {
  id: string;
  pattern: string;
  type: "glob" | "regex" | "path";
  enabled: boolean;
  builtin: boolean;
  label: string;
}
