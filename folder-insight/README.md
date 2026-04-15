# Folder Insight App

这个目录是 `Folder Insight（文件夹透视）` 的实际应用工程。

完整项目说明、功能状态、开发环境准备和配置说明见：

- [仓库根 README](../README.md)

## 快速开始

```powershell
cd folder-insight
npm install
npm run tauri dev
```

## 常用命令

```powershell
npm run dev
npm run tauri dev
npm run build
npx tsc --noEmit
```

Rust 后端命令：

```powershell
cd src-tauri
cargo build
cargo test
cargo clippy
```

## 关键目录

```text
folder-insight/
├─ src/                 # React 前端
├─ src/analysis/        # 残留/结构分析
├─ src/components/      # UI 组件
├─ src/pages/           # 四个主页面
├─ src/store/           # Zustand 状态
├─ src/types/           # 前后端共享类型
└─ src-tauri/           # Rust + Tauri 后端
```
