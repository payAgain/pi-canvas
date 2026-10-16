# P1：已安装调用验证与多界面完善

状态：0.1.1 历史记录，已完成安装后原生工具及 ready/error 报告复验（见末节）。以下实现与回归描述保留为当时行为；0.1.2 已撤销独立窗口，当前工作见[侧栏修复](P1-RIGHT-VIEW.md)。

## 已安装 0.1.0 的真实结果

- canvas_list 成功，runtimeVersion=0.1.0，初始库为空，workspaceId 由插件返回。
- canvas_publish 成功：专用「PI Canvas · 安装验证」零诊断，presentation.opened=true。
- canvas_read 成功。对专用画布提交明确类型错误后 sourceRevision=2，publishedRevision=1，buildHash 不变；修复后 sourceRevision/publishedRevision=3、零诊断。
- canvas_open_file 成功：通过宿主文件权限读取当前项目 examples/report.tsx，watch=false，未修改外部文件。
- 真实 canvas_update 用过期 baseRevision=1 修改 r3 时返回 REVISION_CONFLICT，没有写入；canvas_open 随后重新打开 r3 成功。未向真实聊天发送修改请求，未删除或清空真实库。两张专用验证画布保留。
- 独立窗口不能由当前 Browser 检查工具访问，初次返回 browser guest is not available。opened=true 不替代截图/实际渲染证据。

## 本轮实现

- 增加 contributes.views + ui.view 的右侧工作面板入口，沿用同一 HTML；自动工具打开仍使用确定可用的独立 Panel，不猜测内部 openView 接口。
- 每个界面实例独立令牌、画布和来源聊天授权。工具打开生成新意图，旧写请求被拒绝；面板内导航不影响另一界面，也不借用其聊天。
- canvas_status 只读工具：显示可信外壳连接、iframe loading/ready/error、主题、心跳时间和新鲜度；不暴露令牌、会话 ID、实例 ID。心跳不是截图或视觉质量证明。
- 多界面 readState 同步，状态冲突后合并值回送 iframe，不重建视图或触发 Agent。
- 源码切换/关闭前确认未发布输入；新工具意图延后至安全点或显式刷新采纳。渲染失败/超时上报，仍保留旧画面。
- 显式发送默认关闭；模拟验证绑定目标、去重、结果未知不重放；前端在未知结果后禁止再次发送直到核对并重载。

## 回归与浏览器验证

- 核心 12 项：独立资源编译、策略与类型诊断、缺少默认导出、失败保留、乐观版本锁、状态恢复与限制、宿主文件权限、项目切换竞态、文件冲突、重启不自动授权。全部通过。
- 后端协议：独立窗口/视图令牌、状态共享、渲染报告输入限制与不泄露授权、旧绑定拒绝、无权限禁发、模拟发送身份与去重、结果未知不重试。全部通过；消息进入内存 mock，不是真实宿主发送。
- Chromium 运行正式工作台和真实编译产物，宿主桥由测试页模拟：
  - iframe sandbox=allow-scripts，父页不可读取 iframe DOM；收到实际 render-ready。
  - 鼠标点击计数保存为 s1，工作台刷新后截图仍为 1。
  - 石墨黑主题保存后，工作台与画布同色，计数保留。
  - Design mode 实际选择文本；复制内容带 canvasId/源码与发布版本/DOM路径/请求，发送按钮禁用。测试剪贴板为内存记录。
  - 未发布源码取消切换，编辑器与输入保留。
  - 故意注入候选视图运行错误：r2 被移除，r1 iframe 仍保留，报告为 error；恢复后 ready。
- 测试页明确标为「模拟宿主」，不提供真实数据或聊天入口；它不是原生交付回退。测试生成器曾因字符串替换符破坏注入脚本，已修复并重跑，不是正式构建缺陷。
- 最终 npm run build、npm test 通过：12 个核心测试 + 8 个协议子场景（Node 含父项统计为 9），全部无失败/跳过。PluginCheck 通过；官方 PluginPack 输出 24 文件、8,768,181 字节，SHA-256：`7b484e5f14ed640ec9fea224ae1472eecfab568bbfd4f1bdc41d076e1128903d`。校验文件保留旧包与新包两行。

## 当时待观察项（后续结果见末节）

1. 安装 0.1.1 后，工具列表是否出现 canvas_status；权限新增 ui.view 需用户确认。
2. 从右侧视图菜单打开 PI Canvas，并与独立窗口共同使用；查询 fresh ready 后仍需观察真实布局。
3. 跨平台原生 UI、异常退出、真实剪贴板、真实授权文件跟随、删除恢复体验。
4. 草稿附件、细粒度发送授权没有通用公开 Panel 接口，仍不接入。真实发送需要用户另行授权高风险版本并主动点击，不能作为无授权自动验收动作。

不把这些未观察项标为完成，也不将测试 mock 的 sessionId 当作真实宿主证据。


## 已安装 0.1.1 的原生复验

用户安装 0.1.1 后直接调用已安装插件，未用模拟桥接：

- runtimeVersion=0.1.1，canvas_status 可调用。新库为空且 workspaceId 与前轮不同，旧验证对象 NOT_FOUND；只记录事实，未推断原因、未恢复或迁移库。
- 专用验证画布 `98d7af73-30d3-49da-be7c-14aa3ff4b555`：r1 零诊断，原生报告 connected/ready/fresh/matchesPublished，曾 visible=true。
- 类型错误保存 r2、保留发布 r1/hash；原生继续报告 r1 ready。主动抛错的 r3 编译成功，原生准确报告 error；修复 r4 后恢复 fresh ready。过期 baseRevision=1 返回 REVISION_CONFLICT，无写入。
- 宿主授权读取 examples/report.tsx，专用文件画布 `2bc21149-a0a8-4f6f-8ade-fb6d5dcf152b` 零诊断、watch=false、原生 ready，不改外部源文件。
- 原验证画布 stateRevision=1、verification.count=1；切换画布再返回仍保留。最终源码/发布为 r4，buildHash=`41949c69bfad23c781eba954931dd2a79a6f1442111d84bf314479c0f3be3610`。两实例报告 ready，但旧代码都标 panel，不能由此推断真实 placement。
- 用户随后提供真实右侧 PI Canvas 截图，同时指出工具会另开窗口。截图可见重复工作台，不将旧心跳当作布局正确证据。只读复查 r4 源码仅含正文和计数，没有第二层工具栏。重复外壳尚未复现，根因未知。

未发送真实消息、未删除画布/库或改写外部源文件。0.1.2 的 view-only 包仍需升级后原生观察，不能套用 0.1.1 的证据。
