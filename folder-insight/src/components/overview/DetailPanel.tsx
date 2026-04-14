import type { FolderChild } from "../../types";

interface Props {
  node: FolderChild | null;
}

function formatBytes(b: number) {
  if (b < 1e6) return `${(b / 1e3).toFixed(0)} KB`;
  if (b < 1e9) return `${(b / 1e6).toFixed(1)} MB`;
  return `${(b / 1e9).toFixed(2)} GB`;
}

function formatDate(ms: number): string {
  if (!ms) return "—";
  return new Date(ms).toLocaleDateString("zh-CN", { year: "numeric", month: "short", day: "numeric" });
}

export default function DetailPanel({ node }: Props) {
  if (!node) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 text-center">
        <p className="text-xs text-on-surface-variant/60">点击方块查看详情</p>
      </div>
    );
  }

  const isFolder = node.kind === "folder";

  return (
    <div className="flex-1 overflow-y-auto p-4 border-b border-outline-variant/10">
      {/* Header */}
      <div className="flex items-start gap-3 mb-4">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-primary text-[20px]">
            {isFolder ? "folder" : "insert_drive_file"}
          </span>
        </div>
        <div className="min-w-0">
          <p className="font-headline font-bold text-sm text-on-surface leading-tight truncate">
            {node.name}
          </p>
          <p className="text-[10px] font-mono text-on-surface-variant/70 truncate mt-0.5">
            {node.path}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="space-y-2">
        <Row label="大小" value={formatBytes(node.size)} />
        {isFolder && node.kind === "folder" && (
          <>
            <Row label="文件数" value={node.fileCount.toLocaleString()} />
            <Row label="子文件夹" value={node.folderCount.toLocaleString()} />
            <Row label="深度" value={String(node.depth)} />
          </>
        )}
        {!isFolder && node.kind === "file" && (
          <>
            <Row label="类型" value={node.fileType} />
            <Row label="修改时间" value={formatDate(node.modifiedAt)} />
            <Row label="创建时间" value={formatDate(node.createdAt)} />
          </>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">{label}</span>
      <span className="text-xs font-bold text-on-surface">{value}</span>
    </div>
  );
}
