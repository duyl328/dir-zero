import type { FileEntry } from "../types";

export interface StoredCustomRule {
  id: string;
  label: string;
  pattern: string;
  useRegex: boolean;
  enabled: boolean;
}

export function storedRuleToRuleDef(r: StoredCustomRule): ResidueRuleDef {
  const p = r.pattern;
  const matchFn: ResidueRuleDef["match"] = r.useRegex
    ? (f) => new RegExp(p, "i").test(f.name)
    : p.startsWith("*.")
      ? (f) => f.ext.toLowerCase() === p.slice(2).toLowerCase()
      : (f) => f.name.toLowerCase() === p.toLowerCase();
  return { id: r.id, label: r.label, desc: `自定义规则：${p}`, icon: "rule", defaultEnabled: true, match: matchFn };
}

export interface ResidueRuleDef {
  id: string;
  label: string;
  desc: string;
  icon: string;
  defaultEnabled: boolean;
  match: (file: FileEntry) => boolean;
}

export interface ResidueGroup {
  ruleId: string;
  label: string;
  desc: string;
  icon: string;
  files: FileEntry[];
  totalSize: number;
  enabled: boolean;
}

export const BUILTIN_RESIDUE_RULES: ResidueRuleDef[] = [
  {
    id: "ds_store",
    label: ".DS_Store 文件",
    desc: "macOS Finder 生成的元数据文件，常见于 Mac 硬盘或移动存储接入 Windows 后。删除后 Mac 重新访问时会自动重建。",
    icon: "laptop_mac",
    defaultEnabled: true,
    match: (f) => f.name === ".DS_Store",
  },
  {
    id: "dot_underscore",
    label: "._* AppleDouble 文件",
    desc: "Mac 硬盘或移动存储接入 Windows 时产生的资源分叉文件，用于存储 Mac 扩展属性。在 Windows 上无法使用，删除不影响原始文件内容。",
    icon: "laptop_mac",
    defaultEnabled: true,
    match: (f) => f.name.startsWith("._"),
  },
  {
    id: "thumbs_db",
    label: "Thumbs.db",
    desc: "Windows 缩略图缓存，会自动重新生成。",
    icon: "image",
    defaultEnabled: true,
    match: (f) => f.name.toLowerCase() === "thumbs.db",
  },
  {
    id: "desktop_ini",
    label: "desktop.ini",
    desc: "Windows 文件夹自定义配置文件，通常可安全删除。",
    icon: "settings",
    defaultEnabled: false,
    match: (f) => f.name.toLowerCase() === "desktop.ini",
  },
  {
    id: "tmp",
    label: "*.tmp / *.temp 临时文件",
    desc: "应用程序遗留的临时文件。",
    icon: "hourglass_empty",
    defaultEnabled: true,
    match: (f) => ["tmp", "temp"].includes(f.ext.toLowerCase()),
  },
  {
    id: "download_partial",
    label: "未完成的下载文件",
    desc: "浏览器或下载工具遗留的不完整下载文件（.crdownload、.part）。",
    icon: "download",
    defaultEnabled: true,
    match: (f) => ["crdownload", "part", "partial"].includes(f.ext.toLowerCase()),
  },
];

export function analyzeResidue(files: FileEntry[], rules: ResidueRuleDef[]): ResidueGroup[] {
  return rules
    .map((rule) => {
      const matched = files.filter(rule.match);
      return {
        ruleId: rule.id,
        label: rule.label,
        desc: rule.desc,
        icon: rule.icon,
        files: matched,
        totalSize: matched.reduce((s, f) => s + f.size, 0),
        enabled: rule.defaultEnabled,
      };
    })
    .filter((g) => g.files.length > 0);
}
