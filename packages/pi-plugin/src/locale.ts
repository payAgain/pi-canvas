// Public host locale only; never infer the user's chat/session identity.
const copy = {
  en: {
    openCommand: 'PI Canvas: Show in right panel',
    viewSelection: 'Canvas selection updated. Choose PI Canvas in the right work-panel view menu; an existing view adopts it when safe. The public host API cannot reveal or focus the sidebar. No detached window will be created.',
    renderEvidence: 'Selection and compilation are not rendering evidence. A fresh ready report is the trusted shell receiving iframe readiness, not a screenshot or a visual-quality check.',
  },
  'zh-CN': {
    openCommand: 'PI Canvas：在右侧查看画布',
    viewSelection: '画布选择已更新。请在右侧工作面板的视图菜单选择 PI Canvas；已打开的视图会在安全点接收新画布。当前公开宿主接口不能自动展开或聚焦侧栏，不会创建独立窗口。',
    renderEvidence: '选择画布与编译成功不代表渲染成功；fresh ready 是可信外壳收到 iframe 就绪消息，不是截图或视觉质量验收。',
  },
} satisfies Record<'en' | 'zh-CN', Record<string, string>>;
type Key = keyof typeof copy.en;
export async function hostText(key: Key): Promise<string> {
  try { const locale = await pi.app?.getLocale(); return copy[locale && !/^zh(?:[-_]|$)/i.test(locale) ? 'en' : 'zh-CN'][key]; }
  catch { return copy['zh-CN'][key]; }
}
