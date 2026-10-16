# 来源与迁移边界

## Canvas 核心

本目录的初始 SDK、renderer、runtime store、工作台和 TSX 示例来自 [Codex Canvas](https://github.com/payAgain/codex-canvas) 1.1.1 系列的本地工作副本。保留 [MIT 许可证](../LICENSE) 与[第三方声明](../THIRD_PARTY_NOTICES.md)。当前副本还包含原项目尚未发布的 Skill 使用策略；PI 专用 Skill 单独适配，不复制 Codex 宿主扩展要求。

- 复制范围仅包含任务相关源码、示例、SDK 文档与声明，不包含原库数据、node_modules、研究检出、Git 元数据或凭据。
- SDK 导入名继续使用 @codex-canvas/sdk 以兼容已有画布，不代表 PI 接口。
- 上游示例中的 Codex 结构是原项目的示意，不伪称为本插件或 PI 宿主内部结构。
- 编译器、宿主桥、文件授权与后端入口由本次迁移适配。

## PI-Desktop

插件骨架由当前宿主的 PluginScaffold / full-demo 生成。公开接口调研固定于 PI-Desktop 提交 `0d235a91a7718c8b7c0b1b485dc603c2840d5645`，该提交领先当时公开 v0.20.1；不能当作当前安装宿主已实测能力。

- [开发指南](https://pi-docs.aiuo.net/plugin-development)
- [SDK 类型与工具来源 sessionId](https://github.com/vastsa/PI-Desktop/blob/0d235a91a7718c8b7c0b1b485dc603c2840d5645/packages/plugin-sdk/src/index.ts#L807-L832)
- [面板 preload / pluginBridge](https://github.com/vastsa/PI-Desktop/blob/0d235a91a7718c8b7c0b1b485dc603c2840d5645/apps/desktop/electron/preload/plugin-panel.ts#L19-L42)
- [onPanelInvoke dispatch](https://github.com/vastsa/PI-Desktop/blob/0d235a91a7718c8b7c0b1b485dc603c2840d5645/apps/desktop/electron/main/plugin-host-process.mjs#L525-L593)
- [desktop.control 与显式发送](https://github.com/vastsa/PI-Desktop/blob/0d235a91a7718c8b7c0b1b485dc603c2840d5645/docs/spec/07-plugins/03-plugin-api.md#L983-L1025)
- [agent/prompt 参数](https://github.com/vastsa/PI-Desktop/blob/0d235a91a7718c8b7c0b1b485dc603c2840d5645/apps/desktop/electron/main/mcp-control.ts#L364-L375)
- [安装打包规范](https://github.com/vastsa/PI-Desktop/blob/0d235a91a7718c8b7c0b1b485dc603c2840d5645/docs/spec/07-plugins/06-plugin-packaging.md)

这些链接证实接口定义或源码路径，不证明当前宿主的 UI、权限或消息体验已验收。

## 0.1.2 右侧视图复核

本轮再次检查最新正式版 v0.20.1 与公开 main 固定提交 `b6e439437769b7763e9a51b78725a3534a52ab8f`（2026-10-16）。关键 SDK/runtime/panel/view/preload 文件哈希相同，不据此推断已安装宿主版本。

- [公开 UI 类型](https://github.com/vastsa/PI-Desktop/blob/b6e439437769b7763e9a51b78725a3534a52ab8f/packages/plugin-sdk/src/index.ts#L1148-L1157)：openPanel/closePanel/showToast 等，无 openView/focusView/revealView。
- [openPanel runtime](https://github.com/vastsa/PI-Desktop/blob/b6e439437769b7763e9a51b78725a3534a52ab8f/apps/desktop/electron/main/plugin-runtime.ts#L5241-L5279) 与 [BrowserWindow](https://github.com/vastsa/PI-Desktop/blob/b6e439437769b7763e9a51b78725a3534a52ab8f/apps/desktop/electron/main/plugin-panel-host.ts#L474-L516)：公开方法只开独立窗口，没有 placement/dock 选项。
- [宿主侧视图组件](https://github.com/vastsa/PI-Desktop/blob/b6e439437769b7763e9a51b78725a3534a52ab8f/apps/desktop/src/components/workpanel/PluginViewTab.tsx#L68-L100) 可以通过内部 API 打开 tab，但不构成插件可调用合同；reviewed desktop catalog 的 plugin/views 只是读取。
- [preload 元数据](https://github.com/vastsa/PI-Desktop/blob/b6e439437769b7763e9a51b78725a3534a52ab8f/apps/desktop/electron/preload/plugin-panel.ts#L590-L608) 可能在 DOMContentLoaded 才写入 view 属性，因此未识别不得当作 panel。

未发现宿主把 srcdoc 子框架重定向到插件入口的公开实现，也未证实子框架获得桥接；不把这些假设当成截图重复工作台的根因。0.1.2 采取 view-only、绝不弹窗的保守合同。
