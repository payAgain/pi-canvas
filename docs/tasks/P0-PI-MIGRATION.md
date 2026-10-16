# P0：PI-Desktop 原生插件迁移

状态：0.1.0 实现、构建、插件静态检查与开发安装包已交付；当前宿主 UI 验收仍待完成，不标整个里程碑完成。用户授权在独立 pi_canvas 目录开发，未请求测试套件。

## 实现

- 官方 PluginScaffold/full-demo 骨架；额外根超出工具范围，因此先在原项目的专用 .local 目录生成，再复制任务源码到本项目。暂存产物不是源仓库或用户库。
- 模板首次加载因上层 type:module 与 CommonJS main.js 冲突失败；正式入口改 backend/main.cjs。最初失败不算宿主加载成功证据。
- 迁入 SDK、renderer、store、主题、设计选区与工作台；PI 生命周期、工具、私有 RPC、宿主文件权限和绑定独立实现。
- 默认复制上下文；可选 desktop.control 发送必须经用户明确授权与点击，sessionId 仅来自宿主工具上下文。
- 不在 Node 执行生成 React，不提供自动 HTTP/浏览器回退，不读取或迁移 Codex 库。
- 独立审查发现并修复：排队 RPC/发送冻结点击时令牌和绑定版本；文件读取固定绝对路径且发布前检查项目；显式刷新能恢复绑定并确认未发布输入。修复后重跑完整构建。

## 实际执行的检查

- 固定 npm 依赖、包含 integrity/registry 的锁文件生成，npm ci 与 npm ls --depth=0 通过。
- 最终 npm run build 通过：全 packages/examples 类型检查、自包含声明资产、SDK/renderer bundle、后端 CJS、工作台、设计脚本；后端 external imports 审计只允许 Node 内置模块。
- 构建脚本、stage 脚本、后端 JS 的 node --check 通过。
- 现有 examples/architecture.tsx 在与源码目录脱离的临时资源目录编译，零诊断，结果 hash 与原位置相同；仅生成与语法检查输出，未执行生成代码。
- npm run stage 的白名单复制通过：24 个文件。
- 当前宿主 PluginCheck 通过；官方 PluginPack 生成 24 文件、8,756,573 字节的安装包。SHA-256：`6386d53ae30fff6f532d726d20459021bf3fe6f4a63004c0a979bd5754f48a26`。
- 安装包与校验文件位于 [artifacts](../../artifacts/)。未用 shell 构造 .piplug。
- 测试套件：未新增、未运行。

一次构建曾被 PowerShell 的 npm 包装器将正常 stderr 进度当成异常而中断；改用 npm.cmd 捕获日志并按真实退出码判定，最终退出码 0。

## 静态警告

1. agent.tool.register / agent.prompt.inject 为宿主定义的高风险权限，需要用户明确授予；这是插件功能必需的权限。
2. 检查器称 clipboard.write 未使用，因为只扫描后端入口。实际由可信工作台调用 pluginBridge.invoke('clipboard.writeText',{text})，对应复制上下文，因此保留。

默认包没有 desktop.control、外部文件写权限、聊天读取或 renderer.extension。可选发送代码存在不等于已获权限或已实测。

## 仍未观察的宿主行为

- 从完整目录或安装包成功加载、工具可见与权限确认。
- iframe render-ready、实际布局、主题、状态重开、授权文件跟随/冲突、删除恢复。
- 不同聊天的绑定切换与缺少会话来源时发送禁用。
- 经用户明确授权高权限版本后，点击真实修改请求并确认消息进入目标聊天；接受不等于 Agent 处理完成。

上述项目不能用构建/静态检查替代。当前交付为可安装开发版，不声称已完成原生 UI 或跨平台验收。
