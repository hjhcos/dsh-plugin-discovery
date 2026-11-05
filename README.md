# dsh-plugin-discovery

在 [DeepSeek Harness](https://github.com/deepseek-ai)（DSH）里发现并安装社区 Bundle 插件。

侧栏新增「发现插件」面板：可按关键词搜索 GitHub / npm 上的社区插件，也可粘贴已知仓库链接解析安装。安装前会走 `pluginManager.inspect`，确认是合法 DSH Bundle 后再安装。

![关键词搜索](docs/images/discover-search.png)

## 功能

- 关键词搜索（全部 / npm / GitHub）
- 链接解析安装（npm / GitHub URL）
- 安装状态：未安装 / 安装中 / 已安装（支持刷新后继续跟踪）
- 安装前 Bundle 校验，降低装错包的风险
- 中英文界面

![安装状态](docs/images/discover-status.jpg)

![已安装示例](docs/images/discover-installed.jpg)

## 安装

在 DSH 的「插件」页安装以下任一形式：

```text
dsh-plugin-discovery
```

或：

```text
npm:dsh-plugin-discovery
```

或 GitHub：

```text
github:hjhcos/dsh-plugin-discovery
```

安装并启用后，刷新 Web UI，侧栏会出现「发现插件」。

> 社区插件非 DeepSeek 官方维护，安装前请自行审阅仓库与权限。

## 使用

1. 打开侧栏「发现插件」
2. 输入关键词（如 `dsh-pet`）后搜索，或在下方粘贴完整仓库链接
3. 点击「安装」，等待状态变为「已安装」
4. 到「插件」页确认启用情况

可选：在插件配置中填写 GitHub Token，可提高 GitHub 搜索配额。

## 开发

```bash
# 本地以 file: 方式挂到 profile
# package.json dependencies:
#   "dsh-plugin-discovery": "file:../../../bundles/dsh-plugin-discovery"
```

## 仓库镜像

- GitHub：https://github.com/hjhcos/dsh-plugin-discovery
- Gitee：https://gitee.com/hjhcos/dsh-plugin-discovery
- npm：https://www.npmjs.com/package/dsh-plugin-discovery

## License

[MIT](./LICENSE) © hjhcos
