# Folder Insight（文件夹透视）

一个基于 Tauri 2 + React + Rust 的桌面应用，面向 Windows 文件整理场景：扫描目录结构、识别空间占用、发现重复文件/残留文件/结构问题，并帮助用户安全地清理磁盘。

项目主程序位于 [`folder-insight/`](./folder-insight)。仓库根目录还包含产品文档与设计文档：

- [`PRD-文件夹透视产品需求文档.md`](./PRD-文件夹透视产品需求文档.md)
- [`DESIGN-产品设计文档.md`](./DESIGN-产品设计文档.md)

## 1. 项目定位

Folder Insight 不是传统“按文件名搜索”的工具，而是偏向“磁盘空间诊断 + 清理建议”的桌面应用。

当前代码已经覆盖了这几类核心场景：

1. 扫描一个或多个文件夹/磁盘根目录。
2. 生成目录树和体积统计。
3. 用 treemap 直观看到空间占用。
4. 根据规则识别残留文件、结构问题和重复文件。
5. 将选中的问题文件移动到回收站，而不是直接硬删除。

## 2. 当前功能状态

### 已具备的功能

- 多目录扫描
  - 支持一次选择多个扫描根目录。
  - 支持扫描时启用/禁用排除规则。
- 扫描过程反馈
  - 前端展示扫描进度、当前路径、累计体积、已发现文件数。
  - Rust 侧会定期发出 `scan-progress` 事件。
- 概览页（Overview）
  - 左侧目录树。
  - 中间 treemap 视图。
  - treemap 单击展开、双击钻取。
  - treemap 与目录树联动。
  - 搜索、类型筛选、体积筛选、修改时间筛选。
  - 搜索结果列表可直接定位到文件。
  - 右侧详情面板和洞察面板。
- 文件类型识别
  - 已覆盖 15 类文件类型：
    `image`、`video`、`audio`、`document`、`archive`、`installer`、`code`、`database`、`design`、`model`、`font`、`disk_image`、`system`、`cache`、`unknown`
- 问题发现页（Find Problems）
  - 残留文件分析：
    - 识别 `.DS_Store`、`Thumbs.db`、`desktop.ini`、`*.tmp`、`*.crdownload` 等
    - 支持在页面中新增自定义残留规则
    - 支持上下文菜单、复制路径、排除此文件
  - 结构问题分析：
    - 空文件夹
    - 0 字节文件
    - 路径过长
    - 过深嵌套
    - 单子目录链
    - 大量小文件目录
  - 重复文件分析：
    - 先按文件大小聚类
    - 再做 quick hash
    - 最后做 BLAKE3 全量哈希确认
    - 支持进度反馈
- 回收站清理
  - 问题页可以将选中文件移动到系统回收站。
- 设置页（Settings）
  - 管理扫描排除规则
  - 支持添加自定义排除规则

### 目前仍是“进行中”或“占位”的部分

- `ScanProgress.mode` 中虽然保留了 `mft`，但当前实际扫描仍是 `compat` 递归扫描。
- 扫描配置弹窗里“NTFS 使用 MFT fast scan”的提示还没有真正落地。
- [`folder-insight/src/pages/FileTypesPage.tsx`](./folder-insight/src/pages/FileTypesPage.tsx) 目前仍以示意数据为主，还没有完全接入真实扫描结果。
- 设置页里的“残留规则管理”目前更偏向 UI 原型；真正参与残留分析的规则主要来自内置规则，以及“问题发现”页里当次会话新增的自定义规则。

如果你准备继续开发，这几项是最值得优先补齐的。

## 3. 技术栈

### 前端

- React 19
- React Router 7
- Zustand
- TypeScript
- Vite
- Tailwind CSS
- Tauri JS API / Tauri Plugins

### 后端

- Rust
- Tauri 2
- `serde`
- `serde_json`
- `walkdir`
- `rayon`
- `blake3`
- `trash`

## 4. 目录结构

```text
dir-zero/
├─ README.md
├─ PRD-文件夹透视产品需求文档.md
├─ DESIGN-产品设计文档.md
└─ folder-insight/
   ├─ package.json
   ├─ src/
   │  ├─ analysis/              # 残留/结构分析逻辑
   │  ├─ components/
   │  │  ├─ layout/
   │  │  ├─ overview/
   │  │  ├─ problems/
   │  │  ├─ scan/
   │  │  └─ ui/
   │  ├─ pages/
   │  ├─ store/
   │  ├─ types/
   │  └─ App.tsx
   └─ src-tauri/
      ├─ capabilities/
      ├─ src/
      │  ├─ lib.rs
      │  └─ main.rs
      └─ tauri.conf.json
```

## 5. 开发环境准备

### 5.1 推荐系统

- 推荐：Windows 10/11
- 项目目标场景是 Windows 桌面端
- 其他平台理论上可编译部分逻辑，但当前产品设计、交互和测试重点都在 Windows

### 5.2 Node.js

- 建议安装 Node.js LTS
- 安装后确认：

```powershell
node -v
npm -v
```

### 5.3 Rust

- 需要 Rust stable
- Windows 下建议使用 `stable-msvc`

```powershell
rustup default stable-msvc
rustc -V
cargo -V
```

### 5.4 Tauri / Windows 依赖

根据 Tauri 2 官方 prerequisites，Windows 开发至少需要：

- Microsoft C++ Build Tools
  - 安装时勾选 `Desktop development with C++`
- Microsoft Edge WebView2 Runtime
  - Windows 10 1803+ 通常已内置
  - 如果缺失，可手动安装 Evergreen Bootstrapper
- 如果你要构建 MSI 安装包：
  - 可能还需要启用 Windows 的 `VBSCRIPT` 可选功能

官方参考：

- [Tauri 2 Prerequisites](https://v2.tauri.app/start/prerequisites/)

### 5.5 IDE 建议

- VS Code
- 推荐插件：
  - `rust-analyzer`
  - `Tauri`
  - `ESLint`
  - `Tailwind CSS IntelliSense`

## 6. 安装与启动

以下命令都在 [`folder-insight/`](./folder-insight) 目录下执行。

### 6.1 安装依赖

```powershell
cd folder-insight
npm install
```

### 6.2 启动前端开发环境

```powershell
npm run dev
```

默认启动 Vite 开发服务器。

### 6.3 启动完整桌面应用

```powershell
npm run tauri dev
```

这个命令会同时启动：

- Vite 前端开发服务器
- Tauri 桌面壳
- Rust 后端

### 6.4 类型检查

```powershell
npx tsc --noEmit
```

### 6.5 前端构建

```powershell
npm run build
```

### 6.6 生产构建

```powershell
npm run tauri build
```

如果要单独验证 Rust 端：

```powershell
cd src-tauri
cargo build
cargo test
cargo clippy
```

## 7. 应用内如何配置

这个项目目前没有 `.env` 或外部配置文件要求，主要配置都在应用界面中完成。

### 7.1 扫描目录

首次进入应用后：

1. 点击“新建扫描”
2. 选择一个或多个文件夹
3. 选择是否启用排除规则
4. 开始扫描

### 7.2 扫描排除规则

当前支持三类排除规则：

- `glob`
- `regex`
- `path`

内置规则包括：

- `node_modules/`
- `.git/`
- `__pycache__/`
- `target/`
- `*.vmdk`
- `*.vhd`
- `$RECYCLE.BIN`
- `System Volume Information`

用户可以在设置页新增自定义排除规则。

### 7.3 残留规则

残留文件识别当前主要来源于：

- 内置规则
- 问题发现页里新增的自定义规则

典型内置规则示例：

- `.DS_Store`
- `._*`
- `Thumbs.db`
- `desktop.ini`
- `*.tmp`
- `*.temp`
- `*.crdownload`
- `*.part`

### 7.4 Tauri 能力配置

如果你后续要加新的 Tauri 插件，不只要改 `Cargo.toml`，还需要同步两处：

1. 在 [`folder-insight/src-tauri/src/lib.rs`](./folder-insight/src-tauri/src/lib.rs) 注册 `.plugin(...)`
2. 在 [`folder-insight/src-tauri/capabilities/default.json`](./folder-insight/src-tauri/capabilities/default.json) 添加对应权限

这是这个仓库里非常容易漏掉的一步。

## 8. 主要页面说明

### 8.1 Overview（透视）

作用：用空间视角理解当前扫描结果。

主要能力：

- 可拖拽宽度的目录树
- Treemap 体积视图
- 单击展开目录块
- 双击钻取目录
- 面包屑路径导航
- 文件搜索
- 正则搜索
- 文件类型筛选
- 最小体积筛选
- 修改时间筛选
- 右侧详情面板
- Top-N 大文件洞察

### 8.2 Problems（发现问题）

分为三个 tab：

- `残留`
- `结构`
- `重复`

#### 残留

- 查看规则分组
- 选中后批量清理
- 对单个文件打开上下文菜单
- 排除误报文件

#### 结构

检测逻辑位于 [`folder-insight/src/analysis/structureAnalysis.ts`](./folder-insight/src/analysis/structureAnalysis.ts)。

当前启发式阈值包括：

- 深度超过 8 层
- 路径长度超过 200
- 文件数超过 1000 且平均文件体积小于 10 KB

#### 重复

后端逻辑位于 [`folder-insight/src-tauri/src/lib.rs`](./folder-insight/src-tauri/src/lib.rs) 的 `find_duplicates` 命令。

当前流程：

1. 先按文件大小分组
2. 对候选分组做 quick hash
3. 对 quick hash 冲突组做 BLAKE3 全量哈希
4. 生成重复簇和可回收空间估算

### 8.3 File Types

这个页面目前还是产品/界面演示性质，尚未完全接入真实扫描数据。

### 8.4 Settings

目前最实用的部分是：

- 扫描排除规则管理
- 自定义排除规则添加/删除

## 9. 扫描与数据流

当前主流程如下：

1. 用户在扫描弹窗中选择根目录和排除规则
2. 前端通过 `invoke("scan_folder")` 调用 Rust
3. Rust 递归扫描目录并持续发送 `scan-progress`
4. 扫描完成后返回 `ScanResult`
5. 前端将结果写入 Zustand
6. Overview / Problems 页面基于树状结果做二次分析与展示

## 10. 关键实现文件

### 前端

- [`folder-insight/src/App.tsx`](./folder-insight/src/App.tsx)
  - 路由入口
- [`folder-insight/src/store/appStore.ts`](./folder-insight/src/store/appStore.ts)
  - 全局状态
- [`folder-insight/src/pages/OverviewPage.tsx`](./folder-insight/src/pages/OverviewPage.tsx)
  - 透视页
- [`folder-insight/src/pages/FindProblemsPage.tsx`](./folder-insight/src/pages/FindProblemsPage.tsx)
  - 问题分析入口
- [`folder-insight/src/analysis/residueAnalysis.ts`](./folder-insight/src/analysis/residueAnalysis.ts)
  - 残留分析逻辑
- [`folder-insight/src/analysis/structureAnalysis.ts`](./folder-insight/src/analysis/structureAnalysis.ts)
  - 结构分析逻辑

### 后端

- [`folder-insight/src-tauri/src/lib.rs`](./folder-insight/src-tauri/src/lib.rs)
  - 扫描
  - 重复文件检测
  - 回收站删除
- [`folder-insight/src-tauri/tauri.conf.json`](./folder-insight/src-tauri/tauri.conf.json)
  - 窗口、构建和打包配置
- [`folder-insight/src-tauri/capabilities/default.json`](./folder-insight/src-tauri/capabilities/default.json)
  - Tauri 权限能力声明

## 11. 已知限制

- 当前扫描仍是同步递归扫描，超大目录下性能和 UI 细节还有优化空间。
- `sizeOnDisk` 当前基本等于 `size`，尚未做真实簇大小计算。
- 问题分析有一部分是启发式规则，不是绝对判断。
- File Types 页面还没完全接入真实数据。
- MFT 快速扫描尚未落地。
- 自定义残留规则目前主要是会话级体验，还不是全局持久化配置。

## 12. 后续建议

如果继续推进这个项目，建议按下面顺序补强：

1. 真正实现 NTFS MFT 快速扫描
2. 让 File Types 页面接入真实扫描数据
3. 将残留规则与设置页统一，并做持久化
4. 为扫描结果引入缓存与增量刷新
5. 增加自动化测试，尤其是分析逻辑与 Rust 命令层
6. 补充导出报告能力

## 13. License

本仓库当前包含 [`LICENSE`](./LICENSE) 文件。若你准备公开发布应用，建议再补充：

- 图标资源授权说明
- 第三方依赖声明
- Windows 打包与签名说明
