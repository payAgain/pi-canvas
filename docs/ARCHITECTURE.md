# 架构

```text
PI Agent / Canvas Skill → 注册工具 → 可信 Node 后端
  ├─ CanvasService：校验、界面会话与操作白名单
  ├─ CanvasStore：源码/发布/状态独立版本、锁与持久化
  ├─ HostFiles：PI 文件权限、明确文件授权与冲突检测
  ├─ UiBindings：打开意图、每个界面独立令牌和来源会话授权
  └─ 可选 desktop.control → agent/prompt（只允许显式发送）
        ↕ pluginBridge / onPanelInvoke
可信工作台（仅右侧 View，无独立 Panel 入口/权限）
        ↕ 窗口来源 + 随机 channel
sandbox iframe（allow-scripts，不允许同源）
  → 生成 React + 兼容 SDK + renderer
```

## 身份与生命周期

- canvasId/workspaceId 由 CanvasStore 生成，不等于宿主 sessionId。宿主 sessionId 只接受工具执行上下文。
- 每个可信页面启动生成 instanceId，connect 后取得独立短期令牌；面板与视图本地导航互不影响。令牌不进入模型工具结果或生成 iframe。
- 明确工具打开更新全局意图版本。旧写操作立即拒绝；界面在无未发布输入/选区等安全点采纳意图并更新令牌。手动刷新需确认放弃输入。不自动重放旧写请求。
- 面板内新建/换画布清除该界面的聊天授权；手动命令也不推测当前活跃聊天。发送捕获用户点击时的绑定，变化则拒绝。
- onUnload 清理计时器、工具、命令和会话；数据写入时立即持久化，不依赖退出 hook。

## 编译、渲染与状态证据

SDK/renderer 构建时预打包，真实声明闭包存入只读资源。用户源码经策略与 TypeScript 类型检查，输出浏览器脚本；Node 不执行生成模块。

可信外壳创建候选 iframe，render-ready 后才替换旧视图；运行失败或超时保留旧视图。iframe 自带 CSP：禁止网络、表单和嵌套 frame，图片只允许 data URI。宿主 Panel 的 sandbox 不替代 Canvas 自身的隔离。

状态按画布独立版本保存。两个界面通过 readState 同步；冲突时重新读取并合并当前键，将结果回送 iframe，不触发 Agent。

canvas_status 展示可信外壳报告和宿主接收时间。报告包含画布/发布版本、phase、主题与可见性，无令牌/会话 ID；版本不符会拒绝。超过 20 秒的心跳不算 fresh，新工具意图未采纳也不算当前连接。ready 表示外壳收到了 iframe 的就绪消息，不是截图、内容正确性或视觉质量保证。

## 资源与可选宿主能力

画布库使用 getDataPath，不读写 Codex 库。raw Node fs 仅用于私有库和随包资源；外部文件通过宿主 fs gate，进程重启不自动恢复授权。

右侧视图使用 manifest contributes.views + ui.view；0.1.2 移除 ui.panel entry/permission 以及全部 openPanel 调用。公开 SDK 暂无展开/聚焦 view 的接口，因此 present 只更新全局画布意图并返回 opened=false 和明确原因；首次需要用户选择工作面板菜单，已有可见 view 在安全点接收意图。没有弹窗/浏览器回退，不调用内部 Electron IPC。界面类型在 DOM ready 后读取，缺少元数据时保留 unknown，可在后续 connect 升级为 view，不再误报 panel。普通视图不直接修改聊天草稿；renderer.extension 不作为基础依赖。来源和证据见[接口来源](PROVENANCE.md)与[当前任务](tasks/P1-RIGHT-VIEW.md)。
