/**
 * 设置管理 hook — 提取规划文件
 *
 * 将从 App.tsx 提取设置变更处理、数值标准化、导航逻辑（约 300 行）。
 *
 * ## 待提取功能
 * - handleNumericSettingChange / handleProviderNumericSettingChange
 * - setProviderModelEnabled
 * - handlePermissionToggle
 * - togglePromptEditor / toggleProviderPromptEditor
 * - settings navigation (navigateSettingsView, openProviderDetail, handleSettingsBack)
 * - currentProvider 计算
 * - activeProviderRequestSettings 计算
 * - Model fetching per provider
 */

export const USE_SETTINGS_EXTRACTION_PLAN = {
  estimatedLines: 300,
  status: 'planned' as const,
} as const
