# Folder Insight（文件夹透视）

一个基于 `Tauri 2 + React + Rust` 的 Windows 桌面应用，用来扫描一个或多个目录，直观看到空间占用，并从“残留文件、结构问题、重复文件、文件类型与年龄”几个角度帮助用户判断哪些内容值得处理。

主程序位于 [`folder-insight/`](./folder-insight)。仓库根目录还包含产品与设计文档：

- [`PRD-文件夹透视产品需求文档.md`](./PRD-文件夹透视产品需求文档.md)
- [`DESIGN-产品设计文档.md`](./DESIGN-产品设计文档.md)

## 项目现状

当前代码已经具备一个可运行的桌面原型，重点覆盖这些能力：

1. 扫描一个或多个文件夹根目录。
2. 构建完整目录树和体积统计结果。
3. 通过 `Overview` 页面查看目录树、Treemap、搜索结果和详情洞察。
4. 通过 `Find Problems` 页面识别残留文件、结构问题和重复文件。
5. 通过 `File Types` 页面按文件类型和修改时间年龄分组查看文件，并支持批量移入回收站。
6. 通过 `Settings` 页面管理语言、主题、扫描排除规则。

当前产品仍然以 Windows 本地文件整理场景为核心，扫描实现以兼容模式递归遍历为主，`NTFS MFT` 快速扫描还没有真正落地。

## 当前功能

### 1. 扫描

- 支持一次添加多个扫描根目录。
- 支持在扫描前启用或关闭内置排除规则。
- 扫描进度通过 `scan-progress` 事件实时返回：
  - 已发现文件数
  - 累计体积
  - 当前路径
  - 已耗时
  - 扫描模式标记（当前实际为 `compat`）
- 多根目录扫描时，前端会把结果组织成一个虚拟根节点统一展示。

当前内置排除规则包括：

- `node_modules/`
- `.git/`
- `__pycache__/`
- `target/`
- `*.vmdk`
- `*.vhd`
- `$RECYCLE.BIN`
- `System Volume Information`

### 2. Overview（透视）

`Overview` 是当前最完整的浏览页，已经接入真实扫描结果。

主要能力：

- 左侧目录树，支持展开、折叠和定位。
- 中央 `Treemap` 画布，按体积显示文件和文件夹。
- 单击文件夹块做 inline expand。
- 双击文件夹块 drill-down。
- 顶部和详情区联动显示当前选中节点信息。
- 搜索栏支持：
  - 关键词
  - 正则
  - 文件类型过滤
  - 最小体积过滤
  - 修改时间过滤
- 搜索结果列表可直接定位文件或目录。
- 右侧详情面板显示当前节点：
  - 路径
  - 大小
  - 文件数 / 文件夹数
  - 类型构成
- 洞察面板会给出如 Top-N 大文件等摘要信息。

当前文件类型分类共 15 类：

`image`、`video`、`audio`、`document`、`archive`、`installer`、`code`、`database`、`design`、`model`、`font`、`disk_image`、`system`、`cache`、`unknown`

### 3. Find Problems（发现问题）

当前问题页分为三个标签页：

- `Residue`
- `Structure`
- `Duplicates`

#### 3.1 Residue（残留文件）

当前已接入真实扫描结果，并基于规则分组展示命中的文件。

内置残留规则包括：

- `.DS_Store`
- `._*`
- `Thumbs.db`
- `desktop.ini`
- `*.tmp`
- `*.temp`
- `*.crdownload`
- `*.part`
- `*.partial`

当前能力：

- 按规则分组查看命中文件数量与总大小。
- 批量选择规则并将匹配文件移入回收站。
- 支持在页面里新增会话级自定义残留规则。
- 支持对误报文件执行“排除该文件”之类的临时处理。

说明：

- 真正参与 `Residue` 分析的是内置规则和“问题页会话内新增规则”。
- `Settings` 页面里的残留规则区域目前还是独立 UI 状态，没有和这里共用持久化配置。

#### 3.2 Structure（结构问题）

前端基于扫描树做启发式分析，当前会识别：

- 空文件夹
- 0 字节文件
- 路径过长
- 过深嵌套
- 单子目录链
- 大量小文件目录

当前阈值在 [`folder-insight/src/analysis/structureAnalysis.ts`](./folder-insight/src/analysis/structureAnalysis.ts) 中定义：

- 深度阈值：`8`
- 路径长度预警：`200`
- 大量小文件目录：文件数 `> 1000` 且平均体积 `< 10 KB`

当前能力：

- 按问题类别查看结果。
- 对低风险项目进行批量选择。
- 支持将可处理项移入回收站。

#### 3.3 Duplicates（重复文件）

重复文件检测由 Rust 命令 `find_duplicates` 完成。

当前流程：

1. 先按文件大小分组。
2. 对候选文件做 quick hash（前 `64 KB`）。
3. 只对 quick-hash 冲突组做 `BLAKE3` 全量哈希。
4. 返回重复簇、建议保留文件和可回收体积估算。

当前能力：

- 扫描重复文件时显示进度。
- 支持“保留最新 / 保留最旧 / 手动选择”等保留策略。
- 可按重复组批量选择要处理的副本。
- 批量将待删除副本移入回收站。

### 4. File Types（文件类型 / 年龄）

这个页面现在已经接入真实扫描结果，不再只是示意页面。

当前分为两个视角：

- `By Type`：按文件类型分类
- `By Age`：按修改时间年龄分类

年龄分桶当前包括：

- 7 天内
- 30 天内
- 3 个月内
- 1 年内
- 1 到 3 年
- 3 年以上

当前能力：

- 查看每个类型或年龄组的总大小、文件数、扩展名构成。
- 查看每组的 Top 目录和文件列表。
- 批量选择文件并移入回收站。
- 从列表里直接在资源管理器中定位文件。

### 5. Settings（设置）

当前设置页已经接入的内容：

- 语言切换：中文 / 英文
- 主题切换：浅色 / 深色
- 扫描排除规则管理
  - 启用 / 禁用内置规则
  - 新增自定义 `glob` / `regex` 规则
  - 删除自定义规则

当前设置页还包含一个“残留规则”区域，但这部分仍是页面内本地状态，不会直接驱动 `Find Problems` 页的实际分析逻辑。

## 当前限制

目前有这些明确的边界和未完成项：

- 扫描模式字段虽然保留了 `mft`，但当前实际扫描实现仍然是兼容模式递归遍历。
- `ScanConfigModal` 里的“NTFS fast scan”目前只是提示文案，不是实际功能。
- 扫描没有真正的中途取消；关闭配置或重置会话会终止前端流程，但不会打断已发出的 Rust 扫描命令。
- `sizeOnDisk` 当前基本等于逻辑大小 `size`，还没有按磁盘簇大小计算真实占用。
- 结构问题和残留识别目前都属于启发式规则，不代表绝对错误。
- 设置页允许创建 `regex` 排除规则，但 Rust 扫描端当前实际只处理 `glob` 和 `path`。
- 设置页的残留规则与问题页残留规则还没有统一为一套持久化配置。
- 当前没有扫描快照、历史对比、导出报告、增量刷新。

## 技术栈

### 前端

- React 19
- React Router 7
- Zustand
- TypeScript
- Vite
- Tailwind CSS
- Tauri JS API

### 后端

- Rust
- Tauri 2
- `serde`
- `serde_json`
- `rayon`
- `blake3`
- `trash`

## 目录结构

```text
dir-zero/
├─ README.md
├─ PRD-文件夹透视产品需求文档.md
├─ DESIGN-产品设计文档.md
└─ folder-insight/
   ├─ package.json
   ├─ src/
   │  ├─ analysis/              # 前端问题分析逻辑
   │  ├─ components/
   │  │  ├─ layout/
   │  │  ├─ overview/
   │  │  ├─ problems/
   │  │  ├─ scan/
   │  │  └─ ui/
   │  ├─ hooks/
   │  ├─ i18n/
   │  ├─ pages/
   │  ├─ store/
   │  ├─ styles/
   │  ├─ types/
   │  └─ App.tsx
   └─ src-tauri/
      ├─ capabilities/
      ├─ src/
      │  ├─ lib.rs
      │  └─ main.rs
      └─ tauri.conf.json
```

## 开发环境

推荐环境：

- Windows 10 / 11
- Node.js LTS
- Rust stable（Windows 下建议 `stable-msvc`）
- WebView2 Runtime
- Visual Studio C++ Build Tools

Tauri 官方依赖说明：

- [Tauri v2 Prerequisites](https://v2.tauri.app/start/prerequisites/)

## 启动方式

以下命令都在 [`folder-insight/`](./folder-insight) 目录执行。

### 安装依赖

```powershell
cd folder-insight
npm install
```

### 启动前端开发服务器

```powershell
npm run dev
```

### 启动完整桌面应用

```powershell
npm run tauri dev
```

### 前端构建

```powershell
npm run build
```

### TypeScript 类型检查

```powershell
npx tsc --noEmit
```

### 单独验证 Rust 端

```powershell
cd src-tauri
cargo build
cargo test
cargo clippy
```

## 关键文件

### 前端

- [`folder-insight/src/App.tsx`](./folder-insight/src/App.tsx)：路由入口
- [`folder-insight/src/components/layout/Shell.tsx`](./folder-insight/src/components/layout/Shell.tsx)：页面壳和主导航
- [`folder-insight/src/pages/OverviewPage.tsx`](./folder-insight/src/pages/OverviewPage.tsx)：透视页
- [`folder-insight/src/pages/FindProblemsPage.tsx`](./folder-insight/src/pages/FindProblemsPage.tsx)：问题发现页
- [`folder-insight/src/pages/FileTypesPage.tsx`](./folder-insight/src/pages/FileTypesPage.tsx)：类型 / 年龄页
- [`folder-insight/src/pages/SettingsPage.tsx`](./folder-insight/src/pages/SettingsPage.tsx)：设置页
- [`folder-insight/src/store/appStore.ts`](./folder-insight/src/store/appStore.ts)：全局状态
- [`folder-insight/src/analysis/residueAnalysis.ts`](./folder-insight/src/analysis/residueAnalysis.ts)：残留分析
- [`folder-insight/src/analysis/structureAnalysis.ts`](./folder-insight/src/analysis/structureAnalysis.ts)：结构分析

### 后端

- [`folder-insight/src-tauri/src/lib.rs`](./folder-insight/src-tauri/src/lib.rs)：扫描、重复检测、回收站删除
- [`folder-insight/src-tauri/src/main.rs`](./folder-insight/src-tauri/src/main.rs)：Tauri 入口
- [`folder-insight/src-tauri/capabilities/default.json`](./folder-insight/src-tauri/capabilities/default.json)：权限能力声明
- [`folder-insight/src-tauri/tauri.conf.json`](./folder-insight/src-tauri/tauri.conf.json)：窗口与构建配置

## Tauri 插件注意事项

如果后续新增 Tauri 插件，需要同步修改两处：

1. 在 [`folder-insight/src-tauri/src/lib.rs`](./folder-insight/src-tauri/src/lib.rs) 中注册 `.plugin(...)`
2. 在 [`folder-insight/src-tauri/capabilities/default.json`](./folder-insight/src-tauri/capabilities/default.json) 中添加对应权限

这是这个仓库里最容易漏掉的一步。

## 后续建议

如果继续推进这个项目，当前最值得优先补齐的是：

1. 真正实现 `NTFS MFT` 快速扫描
2. 把残留规则统一成一套可持久化配置
3. 为扫描过程补上真正的取消能力
4. 增加扫描快照、历史对比和报告导出
5. 为 Rust 命令层和前端分析逻辑补测试

## License

仓库当前包含 [`LICENSE`](./LICENSE) 文件。
