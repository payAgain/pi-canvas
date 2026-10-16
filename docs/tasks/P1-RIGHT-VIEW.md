# P1：只在右侧呈现，不创建弹窗

状态：0.1.2 代码、构建、回归、官方检查/打包和安装后的真实侧栏复验通过；用户确认只在右侧且只有一套工具栏。用户要求默认直接放在右侧，绝不创建独立弹窗。**不弹窗已实现；首次自动展开/聚焦右侧仍受宿主公开接口缺口阻塞。**

## 已实现

- present 与打开命令均不再调用 openPanel；命令只更新选择并以公开 showToast 提示菜单位置。
- manifest 删除 ui.panel 入口和权限，仅保留 contributes.views 的 canvas + ui.view；构建与暂存脚本校验此不变量。版本与 lock 为 0.1.2。
- 发布/更新/打开/文件打开仅保存并更新右侧选择；presentation 返回 mode=pi-view、opened=false、selectionUpdated=true、reason=HOST_VIEW_REVEAL_UNAVAILABLE、render=unobserved。不把保存、编译或选中意图当作已展开/聚焦。
- 已打开且可见的视图沿现有轮询在安全点采纳新选择；未发布输入、选区或隐藏状态不会被强制覆盖。首次请从工作面板视图菜单选择 PI Canvas，无弹窗/浏览器/localhost 回退。
- 界面类型等 DOM ready 后读取；缺失时标 unknown，后续可升级为 view。保留 legacy panel/widget 类型只是诊断兼容，不提供其打开入口。
- sandbox 仍只有 allow-scripts、无同源权限；生成代码不进入 Node/可信工作台/宿主 DOM。不扩大权限、不迁移或删除用户库。

## 已验证

- npm run build：TypeScript 检查与自包含生产构建通过。
- npm test：核心 12 项 + 协议 11 个子场景（Node 协议统计含父项为 12），全部通过、无跳过。覆盖无 panel 声明/权限、发布/更新/open/probe/命令的弹窗 trap、unknown 转 view、状态、令牌、版本与显式发送边界。真实聊天不参与。

## 接口证据与剩余限制

最新正式版 v0.20.1 与公开 main b6e439437769b7763e9a51b78725a3534a52ab8f 的 public UI SDK 只有 openPanel/closePanel/showToast 等，没有 reveal/focus/open contributed view。openPanel 明确创建 BrowserWindow；内部 pluginViewOpen 不是插件合同，不调用它或猜测 desktop operation。来源见[接口来源](../PROVENANCE.md)。

需要宿主提供受 ui.view、声明 viewId、项目范围校验的公开展开/激活/聚焦能力，才能完成首次自动展开需求。本次没有修改宿主。此前截图中重复工作台的根因未确认；0.1.2 安装后已取得真实 view 就绪/错误/恢复报告，且用户确认右侧只有一套工具栏，不再出现独立窗口。这是当前安装的功能和用户视觉确认，不推定历史根因或跨平台行为。真实剪贴板、交互状态写入与消息发送本轮未验证。

## 最终交付与模拟侧栏补录

- 官方 PluginCheck / PluginPack 通过，24 文件、8,769,647 bytes；安装包为 `local.pi-canvas-0.1.2.piplug`（本地历史开发包），SHA-256：`4c96546aa16002da5e94d078da5fc6f9849cd45f0958f6cf9b5b6407a78c0916`。旧包及校验行保留。
- 警告仅为既有 agent.tool.register / agent.prompt.inject 高风险授权，以及 clipboard.write 的后端静态未用提示（实际由前端 pluginBridge 调用）。没有 ui.panel 或 desktop.control。
- Chromium 运行正式 0.1.2 工作台及真实编译 bundle，但桥接、数据、可见性均为模拟：DOM ready 才提供 view 属性，首次 connect 正确为 view；单套 toolbar、单个 sandbox=allow-scripts iframe、父页无法读取 child DOM、srcdoc 不含工作台标题节点、真实 render-ready；无 console 错误。
- 自动化 Browser 报页面 hidden：先观察新选择没有被强制采纳，再只在模拟页覆写 hidden=false；随后现有视图从 A 切换 B 并收到匹配 B 的 ready，仍无嵌套工具栏。不能把这个模拟可见性当作真实展示/聚焦证据。
- 打包当轮尚未加载 0.1.2 到真实插件进程，未修改真实库、外部源文件或发送消息；安装后的真实结果见下一节。

## 0.1.2 已安装原生侧栏复验

用户明确要求重新测试后，本轮直接调用已安装插件；没有使用模拟桥接、浏览器回退或内部 IPC。

- canvas_list 返回 runtimeVersion=0.1.2。初始库为空，workspaceId=`eb3c4153-c02b-43e7-a889-f3c994588f7a`，与前轮不同；旧测试对象返回 NOT_FOUND。只记录此现象，未推断升级清库原因、未查找其他库或自动迁移/恢复数据。
- 新建专用画布 `a8d4626a-4841-43fa-b461-075918b19c31`（侧栏安装复验）：r1 零诊断，buildHash=`eb65c76b2236e6ece9886d4790e74ed95c7e35d53d6eabd9969f750384f0c7d8`。原生报告单条 surface=view、connected=true、pendingOpen=false、phase=ready、fresh=true、matchesPublished=true、visible=true。
- 明确类型错误保存源码 r2，publishedRevision 仍 r1、buildHash 不变；侧栏继续报告可见的 r1 fresh ready，符合编译失败保留发布版本。
- 故意运行错误 r3 编译成功、零诊断，但原生准确报告 phase=error，消息为 PI Canvas 0.1.2 verification: intentional render failure，没有误报 ready。未直接截取原生屏幕，因此不把错误心跳当作旧视图仍可见的证明。
- 修复 r4 后恢复零诊断、可见的 view fresh ready，源码/发布均为 r4，buildHash=`2a7e22401a525bce427ec1c35d57180726fe46d46a03b194b46324b707c7072a`。
- canvas_open_file 通过宿主授权读取项目 examples/report.tsx，创建文件切换专用画布 `2bd72338-7f5f-47c5-b85f-638c2fc251c1`：r1、watch=false、零诊断，原生 view 可见且匹配版本的 fresh ready。随后外部文件 SHA-256 与导入时一致：`5112b066ba96523a6a292dab27708b99cdb92f69ac82e0b031b102119e536a67`。未改写源文件。
- canvas_open 返回主测试画布 r4；最终在 2026-10-16T03:26:47.869Z 观察到单条 view、connected=true、visible=true、phase=ready、fresh=true、matchesPublished=true，最新报告年龄约 2.9 秒。
- publish/update/open_file/open 全部返回 mode=pi-view、opened=false、selectionUpdated=true、HOST_VIEW_REVEAL_UNAVAILABLE；这与不程序化展开侧栏的合同一致。原生报告证明已经打开的 view 接收了这些选择，不证明首次自动展开能力。
- 用户对当前真实界面明确确认：**「正常：只在右侧，只有一套工具栏」**。这补足当前版本不弹窗/不重复工具栏的用户视觉确认；并非自动化原生截图或 DOM 检查。

最终保留本轮两张专用测试画布，主画布停在可用 r4。stateRevision=0、values={}，没有伪造计数或声称测试了交互持久化。本轮不发送真实消息、不删除画布或库、不重跑自动化测试、不修改生产代码或重新打包；仅补录文档。首次自动展开/聚焦仍依赖宿主增加公开接口，真实剪贴板、交互写入、关闭重开宿主及跨平台不在本轮证据范围。
