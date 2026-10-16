# PI Canvas

[English](README.en.md) · 简体中文

把长回答、表格与图表放进可以探索和继续修改的本地画布。基于 Codex Canvas 的 SDK、renderer 与版本化存储，使用 PI-Desktop 的原生插件接口，不依赖 MCP Apps 或 OpenAI UI 扩展。

**状态：0.1.3 预览版，右侧视图专用，中英文界面。** 0.1.2 已完成真实 view 就绪/错误/恢复复验并由用户确认侧栏布局；0.1.3 的检查和官方市场审核状态见[发布任务](docs/tasks/P3-MARKET-RELEASE.md)。已移除独立窗口入口和权限，绝不以弹窗回退。公开宿主 SDK 尚无自动展开/聚焦插件视图的接口，首次需从工作面板视图菜单选择 PI Canvas；已打开的视图接收工具的新选择。实现、验证与限制见[侧栏修复记录](docs/tasks/P1-RIGHT-VIEW.md)及[路线图](docs/ROADMAP.md)。

## 安装开发版

在 PI-Desktop 插件页选择「从文件安装」，导入 [local.pi-canvas-0.1.3.piplug](https://github.com/payAgain/pi-canvas/releases/download/v0.1.3/local.pi-canvas-0.1.3.piplug)，确认 Agent 工具、Skill、`ui.view`、TSX/JSX 读取和剪贴板权限。升级后重新加载插件，关闭旧版已打开的独立窗口，再从**右侧工作面板的视图菜单选择 PI Canvas**。必要时新建聊天刷新工具；`canvas_list` 应返回 0.1.3。新版不申请 `ui.panel`。

安装包与 [SHA-256 校验文件](artifacts/SHA256SUMS.txt) 随 GitHub Release 提供。默认版不包含桌面控制权限，直接消息发送保持关闭。0.1.2 已完成真实侧栏接收、类型错误保留、运行错误上报与修复、授权文件切换及返回验证，并取得用户界面确认。模拟浏览器、构建和打包均不替代这些原生证据；真实剪贴板、交互写入与跨平台仍未在本轮验收。

## 开发

源码与问题反馈：[payAgain/pi-canvas](https://github.com/payAgain/pi-canvas)。正式包经官方 PluginCheck / PluginPack 生成，不使用通用 ZIP 工具。官方插件中心审核与 GitHub Release 是独立步骤；尚未通过审核时不要将 GitHub 发布称为已上架。发布步骤见[发布指南](docs/PUBLISHING.md)。

需要 Node.js 22+、npm 和 PI-Desktop。开发目标为 PI-Desktop 0.20.1+；不同接口的最低可用版本仍需实际宿主确认。

```powershell
npm ci
npm run build
npm test          # 在 PI 会话中运行，临时数据写入 PI_SCRATCH_DIR
```

`plugin/` 是可加载的插件目录，`plugin/manifest.json` 的后端指向 `backend/main.cjs`，`contributes.views` 的 `canvas` 视图指向 `ui/index.html`，不声明独立 Panel。首次构建后，在 **PI-Desktop → 插件 → 从目录加载** 中选择此目录，确认声明的权限。模板首次加载的 CommonJS/ESM 问题已通过 `.cjs` 入口规避。

开发源码位于 `packages/`；构建时预打包 SDK、React 和渲染器，随包携带编译所需资源。运行时不安装 npm 依赖，不从原 Codex 仓库读取源码，不在 Node 执行生成的 React。

当前聊天的内置插件工具只允许访问当前打开的项目。如果 PI Canvas 位于额外项目根，可将构建产物暂存到当前项目内的专用目录，再使用 `PluginCheck` / `PluginPack`。暂存目录不是源码目录，不应存用户画布。

## 使用

1. 从右侧工作面板视图菜单选择 **PI Canvas**，再让 Agent 调用 `canvas_publish` / `canvas_open_file`。命令 **PI Canvas：在右侧查看画布** 只更新选择并提示打开菜单，不另建窗口。
2. 点击示例，或在「源码」中粘贴单文件 TSX。组件只从 `@codex-canvas/sdk` 导入；这个兼容名暂不改名。
3. 成功构建后显示隔离画布；新编译或新视图失败时保留最近成功画面。
4. 使用 Design mode 点选元素、选父层、填写要求，并复制选区到目标聊天。

示例请求：

> 用 PI Canvas 展示这个项目的关键模块关系。请先阅读源码，标明证据和省略部分；不要打开浏览器。

> 用 PI Canvas 打开当前项目里的 `examples/report.tsx`，并跟随我保存文件后的修改。

**只在右侧视图呈现，绝不创建独立弹窗。** 由于公开接口不能自动展开/聚焦视图，工具返回 `presentation.opened:false`、`reason:HOST_VIEW_REVEAL_UNAVAILABLE`，不代表源码保存或编译失败。首次需手动选择右侧 PI Canvas；视图已经打开且可见时，在安全点接收新画布，保留未发布输入。隐藏视图需重新显示后采纳。后续以 `canvas_status` 确认渲染，不把选中意图当作打开/聚焦成功。草稿附件暂不接入；工具名称由宿主添加命名空间。

## 查看实际渲染状态

打开后调用 `canvas_status({canvasId})`，查看各界面的连接、`loading / ready / error`、最近心跳、可见性和 `matchesPublished`。报告超过 20 秒或不是当前版本时不能算当前成功证据；`fresh ready` 是可信外壳收到 iframe 就绪消息，不代表截图或内容正确性。工具打开成功、编译成功与实际渲染分别记录。

0.1.3 的核心 12 项、协议 12 个子场景与 3 项外观时序回归均通过；官方 i18n 门槛为 0 失败。模拟浏览器验证了双语切换保留未发布输入与 iframe；最终包仍待原生安装复验。检查详情见[发布记录](docs/tasks/P3-MARKET-RELEASE.md)。历史模拟交互及 0.1.1 原生结果见[安装验证记录](docs/tasks/P1-INSTALLED-VERIFICATION.md)，本次结果见[侧栏修复记录](docs/tasks/P1-RIGHT-VIEW.md)。没有发送真实聊天消息或删除已有库。

## 文件与数据

- 外部文件读取走 PI 的 `fs.stat/readRange` 和 `manifest.fs` 范围；目前只支持当前 PI 项目内的 TSX/JSX。其他文件可用选择器明确导入快照。
- 文件跟随只对本次进程中明确打开过的输入生效。插件重启或项目切换后需重新打开授权，不凭持久路径静默恢复访问。
- 修改画布内部源码后，外部文件变化可能产生 `FILE_CONFLICT`，不会盲目覆盖。
- 画布库使用宿主 `pi.plugin.getDataPath()`，具体路径在「打开文件」中可复制。不会自动读取或迁移 Codex 数据目录。
- 源码、成功构建、状态和反馈分开保存。回收站可恢复；永久删除需要完整标题，外部源文件始终保留。
- 卸载前备份整个画布库。不要假设所有宿主版本都保留卸载数据。

## 可选：显式发送修改请求

默认包**不申请** `desktop.control`，不读取聊天历史，不改变草稿，不发送消息。复制上下文已经可以完成编辑闭环。

需要直接发送时，在开发源码根执行：

```powershell
node scripts/configure-sending.mjs --enable
npm run build
```

重新加载插件并明确授予新增的高风险权限，在插件设置中开启 `enableSending`。此权限比“仅向绑定聊天发送”更宽；不接受该风险时不要启用。关闭可执行 `node scripts/configure-sending.mjs --disable` 并重载。

发送仅来自可信面板的明确按钮。目标 sessionId 必须来自 `canvas_open/publish/update/open_file` 工具执行上下文；手动打开或在面板内换画布不会推测当前聊天。后端核对令牌、画布和版本；发送结果未知时不自动重试。宿主接受请求不代表 Agent 已完成修改。

## 项目结构

| 路径 | 职责 |
|---|---|
| `packages/runtime` | 编译策略、类型检查、版本与状态存储 |
| `packages/sdk`、`packages/renderer` | 兼容 SDK、组件、主题和隔离视图 |
| `packages/canvas-service` | 与传输无关的画布操作 |
| `packages/pi-plugin` | 生命周期、Agent 工具、授权文件输入、会话绑定 |
| `packages/host-bridge` | 可信面板使用的 PI 桥接 |
| `packages/shell` | 画布工作台与 sandbox iframe |
| `plugin` | 官方模板派生的安装目录和构建资源 |

更多：[SDK](docs/SDK.md) · [架构](docs/ARCHITECTURE.md) · [安全边界](SECURITY.md) · [来源](docs/PROVENANCE.md)。

MIT；保留 [原始许可证](LICENSE) 和 [第三方声明](THIRD_PARTY_NOTICES.md)。本项目不是 PI-Desktop 或 OpenAI 官方产品。
