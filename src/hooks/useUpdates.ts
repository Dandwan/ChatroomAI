/**
 * 软件更新管理 hook — 提取规划文件
 *
 * 将从 App.tsx 提取更新检查与安装逻辑（约 80 行）。
 *
 * ## 待提取功能
 * - checkForUpdate（启动时）
 * - handleManualUpdateCheck
 * - handleInstallUpdate
 * - pendingUpdate / showUpdateDialog 状态
 */

export const USE_UPDATES_EXTRACTION_PLAN = {
  estimatedLines: 80,
  status: 'planned' as const,
} as const
