/**
 * 对话管理 hook — 提取规划文件
 *
 * 将从 App.tsx 提取对话 CRUD、状态计算和水合逻辑（约 400 行）。
 *
 * ## 待提取功能
 * - createNewConversation / switchConversation / deleteConversation
 * - confirmDeleteConversation
 * - renameConversation (begin/cancel/save)
 * - hydrateConversationById + 水合 useEffect
 * - setConversationsState 封装
 * - buildPersistChatState 封装
 * - activeConversation / activeConversationResponseMode 计算
 * - conversationGroups / isHomepageEmptyState / hasActiveMessages 判断
 * - 聊天状态自动保存 useEffect
 * - 图片水合 useEffect
 */

export const USE_CONVERSATION_EXTRACTION_PLAN = {
  estimatedLines: 400,
  status: 'planned' as const,
} as const
