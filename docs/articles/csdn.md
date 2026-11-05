# 给 DeepSeek Harness 加一个「应用商店」：开源插件 dsh-plugin-discovery

> 作者：hjhcos  
> 开源协议：MIT  
> npm：`dsh-plugin-discovery`  
> GitHub：https://github.com/hjhcos/dsh-plugin-discovery  
> Gitee：https://gitee.com/hjhcos/dsh-plugin-discovery

## 写在前面

DeepSeek Harness（DSH）本身能力很强，但社区 Bundle 分散在 GitHub、npm 各处，新人常常不知道去哪找、怎么装才安全。

我做了一个侧栏插件：**发现插件（dsh-plugin-discovery）**——把「搜索 → 校验 → 安装」收进 DSH Web UI，让社区插件发现体验更接近应用商店。

## 它能做什么

- 关键词搜索（全部 / npm / GitHub）
- 粘贴完整链接直接解析安装
- 安装前用官方 `pluginManager.inspect` 校验是否为合法 DSH Bundle
- 安装状态三态：未安装 / 安装中 / 已安装（刷新后也能继续跟踪）

界面示意：

![关键词搜索](../images/discover-search.png)

![安装状态](../images/discover-status.jpg)

## 一分钟安装

在 DSH「插件」页安装：

```text
dsh-plugin-discovery
```

或：

```text
github:hjhcos/dsh-plugin-discovery
```

启用后刷新页面，侧栏会出现「发现插件」。

## 使用建议

1. 先搜关键词（例如 `dsh-pet`），不要拿「解析安装」当搜索框。
2. 安装前打开仓库链接看一眼权限与维护情况——社区插件非官方维护。
3. 装完到「插件」页确认是否启用成功。

## 为什么开源

希望降低社区 Bundle 的分发门槛：作者把插件发到 npm / GitHub 后，用户可以在发现页搜到并一键安装。

欢迎 Star、提 Issue / PR：

- GitHub：https://github.com/hjhcos/dsh-plugin-discovery
- Gitee：https://gitee.com/hjhcos/dsh-plugin-discovery

MIT 协议，欢迎二次分发与改进。
