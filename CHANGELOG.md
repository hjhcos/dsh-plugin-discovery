# Changelog

本仓库每次发版都会同步更新 GitHub / Gitee，并在此记录版本说明。

## 1.2.6 — 2026-11-07

### 新增

- 安装因 `build-blocked` / `ERR_PNPM_IGNORED_BUILDS` 失败时，弹出「批准依赖构建脚本」确认框；用户勾选同意后，通过 `installBundle({ approvedBuilds })` 代为写入 allowBuilds 并重试安装（不静默自动批准）。

### 说明

- 1.2.5 在 npm 上被 staged 冲突占用，正式包号为 **1.2.6**。

## 1.2.5 — 2026-11-07

- （未上架）内容同 1.2.6；npm staged 冲突后跳号。

## 1.2.4 — 2026-11-07

### 修复

- 修复 Typert 远程方法 `grantVersionExemption` 签名：改为位置参数 `(packageVersion, runtimeVersion, acceptRisk)`，去掉默认值/解构，解决「承担风险安装」时 `pluginDiscovery/grantVersionExemption` 失败。

### 新增

- 版本不兼容（`incompatible-version`）时，安装结果附带精选目录推荐（相关 / 同标签 / 相近包）。
- 风险确认弹窗展示推荐列表，可一键安装推荐包，也可勾选确认后豁免并重试原包。
- 安装失败文案展示真实 diagnostic / 错误码，并支持一键复制。

### 目录

- `data/recommended.json` catalog `version` → `3`。

### 合并

- 合入 Gitee Issue #IKT84R：搜索 `dsh-ssh` 时精选目录命中置顶；镜像拉取失败时提示相近精选包。

## 1.2.1 — 2026-11-05

### 修复

- Issue #IKT84R：`dsh-ssh` 搜索与下载失败引导（Gitee 合入）。

## 1.2.0 — 2026-11-05

### 新增

- 插件自更新：启动/打开面板时检查 npm 最新版（Gitee `package.json` 兜底），支持自动或一键更新。
