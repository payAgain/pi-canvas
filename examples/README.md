# 示例

这些示例沿用兼容 SDK，只从 `@codex-canvas/sdk` 导入。文件跟随要求它位于当前 PI 项目内；或者在面板中显式选择文件导入快照。

- [分析报告](report.tsx)：统计与筛选。
- [架构](architecture.tsx)：上游 Codex Canvas 的系统结构示例，不是 PI 宿主内部结构。
- [审查](review.tsx)：发现列表与交互状态。
- [函数调用](call-graph.tsx)、[时序](sequence.tsx)、[UML 类图](class-diagram.tsx)、[模块依赖](dependencies.tsx)、[状态转换](state-machine.tsx)：以迁移前 Canvas 代码为素材的图表示例，注明简化与行为模型边界。

加载插件后可要求 Agent：

> 用 PI Canvas 打开 `examples/report.tsx`，并跟随源码保存。请检查编译诊断，不要打开浏览器。

编译成功不代表已观察真实布局。需要验证时，应在原生面板查看窄宽布局、点选和状态恢复；普通交互不会发送 Agent 请求。
