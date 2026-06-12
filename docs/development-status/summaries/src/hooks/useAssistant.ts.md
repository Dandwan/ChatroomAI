# `src/hooks/useAssistant.ts`

## 功能
聊天发送与助手交互核心 hook。管理消息发送、流式处理、Antigravity 上传、turn 队列执行、调试命令、编辑器提示词注入和 workspace 文件捕获。

提取自 `src/App.tsx` 的 `executeAssistantTurn`、`handleSend`、`handleAppend` 等核心函数（Phase 1 重构）。

**近期变更（2026-06-12）**：
- 修复 `stopGeneration` 无法中止请求的 Bug（P0），在 `processQueuedTurnExecutions` 中存储 `AbortController` 到 store，`stopGeneration` 中调用 `abort()`
- **去重**：删除本地重复的 `getEnabledModelOptions` 函数和 `ACTINET_PROVIDER_ID`/`ACTINET_PROVIDER_NAME` 常量，改为从 `src/utils/app-module.ts` 导入共享版本

## 关系
### 调用 / 引用
- `src/state/chat-store.ts` — `useChatStore`（对话状态、abortController）
- `src/state/ui-store.ts` — `useUIStore`（UI 状态）
- `src/state/settings-store.ts` — `useSettingsStore`（设置状态）
- `src/services/chat-api.ts` — `requestNonStreamCompletion`, `requestStreamCompletion`
- `src/services/chat-transcript.ts` — `buildApiMessagesFromTranscript`, `createConversationFromTranscript`, `projectConversationMessages` 等
- `src/services/skills/` — executor, protocol, action-location, info-system-prompts, types
- `src/services/actinet-models.ts` — `getEffectiveActiNetModels`
- `src/services/cloud-auth.ts` — `isCloudLoggedIn`, `getStoredCloudAuth`, `getCloudServerUrl`
- `src/utils/app-module.ts` — `getEnabledModelOptions`, `ACTINET_PROVIDER_ID`, `ACTINET_PROVIDER_NAME`
- `src/utils/assistant-flow.ts` — 助手流管理
- `src/utils/images.ts` — 图片附件创建
- `src/utils/app-debug.ts` — 调试日志存储
- `src/state/extensions-store.ts` — `useExtensionsStore`

### 提供
- `useAssistant` — 返回 `executeAssistantTurn`, `handleSend`, `handleAppend`, `handlePaste`, `stopGeneration`, `beginEdit`, `saveUserEdit`, `saveAssistantEdit`, `cancelEdit`, `regenerate`, `getCanSend`, `getActiveConversationResponseMode`, `getActiveProviderRequestSettings`, `isSending`, `isComposerLocked`

### 被依赖
- `src/App.tsx` — 解构使用所有助手交互函数

## 关键词
### 函数
- `useAssistant` — hook 主函数
- `executeAssistantTurn` — 执行单轮助手推理（含流式解析、技能执行循环、tool use 翻译）
- `handleSend` — 发送消息入口
- `handleAppend` — 追加工具执行到运行中的 turn
- `handlePaste` — 粘贴图片/文本到输入区
- `stopGeneration` — 停止生成（清空队列 + abort 请求）
- `beginEdit` / `saveUserEdit` / `saveAssistantEdit` / `cancelEdit` — 消息编辑
- `regenerate` — 重新生成上一个助手回复
- `getCanSend` / `getActiveConversationResponseMode` / `getActiveProviderRequestSettings` — 状态查询
- `isSending` / `isComposerLocked` — 发送状态标记
