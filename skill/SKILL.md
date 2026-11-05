---
name: dsh-plugin-discovery
description: >
  当用户要在网上找 DSH 社区插件（桌宠、壁纸、非官方 bundle 等）：使用 dsh-plugin-discovery。
  支持内置精选推荐/分类浏览（data/recommended.json），也可 GitHub/npm 联网搜索，
  用 pluginManager.inspect 校验 bundle 后再 installBundle 安装。
---

# 发现插件（dsh-plugin-discovery）

## 何时使用

用户想找 / 安装非官方 DSH 社区 Bundle（例如桌宠、主题、工具类插件）时使用本能力。

## 步骤

1. 安装 bundle：`dsh-plugin-discovery`（npm）或 `github:hjhcos/dsh-plugin-discovery`。
2. 优先看「为你推荐 / 分类浏览」（本地精选目录）；需要更多结果再用关键词搜索或解析完整链接。
3. 可用 agent 工具 `plugin_discovery_catalog` / `plugin_discovery_search`。
4. 仅当 `inspect` 表明 `bundle: true` 时再 `installBundle`；UI 的安装按钮已走同一流程。
5. 安装完成后引导用户到「插件」页确认状态。

## 注意

- 社区插件非官方维护，安装前应提示用户自行审阅仓库。
- 不同来源的同名短包（如 `dsh-pet` 与 `@scope/dsh-pet`）按精确包名区分安装态。
- 精选目录在 `data/recommended.json`，随包装发，其他用户安装后即可看到。
