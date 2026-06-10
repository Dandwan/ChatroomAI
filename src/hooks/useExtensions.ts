/**
 * 扩展管理 hook — 提取规划文件
 *
 * 将从 App.tsx 提取 skill/runtime 管理、配置编辑器逻辑（约 200 行）。
 *
 * ## 待提取功能
 * - handleSkillArchiveSelect / handleRuntimeArchiveSelect
 * - handleSetSkillEnabled / handleSetRuntimeEnabled
 * - handleSetDefaultRuntime / handleTestRuntime
 * - openSkillConfigEditor / handleSkillConfigDraftChange
 * - Extensions 加载 useEffect
 */

export const USE_EXTENSIONS_EXTRACTION_PLAN = {
  estimatedLines: 200,
  status: 'planned' as const,
} as const
