// Global app state
export type ScanStatus = "idle" | "configuring" | "scanning" | "done";

export interface ScanSession {
  id: string;
  roots: string[];
  status: ScanStatus;
  progress: ScanProgress | null;
  result: SlimScanResult | null;
  startedAt: number | null;
}

export interface ScanProgress {
  filesFound: number;
  totalSize: number;
  currentPath: string;
  elapsedMs: number;
  mode: "mft" | "compat";
}

// ── Slim tree (IPC-safe, folders only) ───────────────────────────────────────

export interface SlimFolderEntry {
  path: string;
  name: string;
  size: number;
  fileCount: number;
  folderCount: number;
  children: SlimFolderEntry[];
  depth: number;
}

export interface TypeStat {
  fileType: FileTypeCategory;
  size: number;
  count: number;
}

export interface ResidueStatEntry {
  ruleId: string;
  totalSize: number;
  count: number;
  files: FileEntry[];
}

export interface PrecomputedStats {
  typeStats: TypeStat[];
  topFiles: FileEntry[];
  oldFilesCount: number;
  oldFilesSize: number;
  unknownExtStats: [string, number][]; // [ext, size][]
  residueStats: ResidueStatEntry[];
}

export interface SlimScanResult {
  totalSize: number;
  fileCount: number;
  folderCount: number;
  largestFile: FileEntry | null;
  largestFolder: SlimFolderEntry | null;
  issueCount: number;
  tree: SlimFolderEntry;
  stats: PrecomputedStats;
}

export interface FileChunk {
  files: FileEntry[];
  total: number;
}

// ── File / folder entries ─────────────────────────────────────────────────────

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

export interface StructureIssue {
  type: "empty_folder" | "zero_byte" | "deep_nest" | "long_path" | "single_child_chain" | "dense_small" | "odd_name";
  path: string;
  severity: "safe" | "caution";
  detail: string;
}

// Raw shape returned by Rust find_duplicates command
export interface RawDuplicateCluster {
  id: string;
  hash: string;
  fileSize: number;
  filePaths: string[];
  reclaimable: number;
  suggestedKeep: string;
}

export interface DuplicateCluster {
  id: string;
  hash: string;
  fileSize: number;
  files: FileEntry[];
  reclaimable: number;
  suggestedKeep: string;
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
