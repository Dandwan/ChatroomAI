# 071 — App.tsx 模块化重构 阶段 A：导入清理与死代码移除

**日期**：2026-06-11
**任务**：App.tsx 阶段 A — 清理未使用的导入和死模块级代码

## 完成的工作

### 导入清理

移除了 5 个完全未使用的导入块：
- `chat-api` — authHeaders, buildApiUrl, readErrorMessage, requestNonStreamCompletion, requestStreamCompletion, ApiMessage
- `skills/executor` — executeEditAction, executeReadAction, executeRunAction, executeSkillCall, materializeRunAction
- `skills/protocol` — createAgentStreamParser, createSkillActionPlaceholder, buildPromptBlocksText, buildRuntimeCatalogBlock, buildSkillsCatalogBlock, formatStructuredMarkdown, normalizeSkillAgentProtocolResponse, SkillActionStreamEvent
- `skills/action-location` — buildEnvVarPath, InternalActionLocation
- `utils/images` — compressImageDataUrl, createImageAttachments

修剪了部分使用的导入块：
- `chat-transcript` — 移除 buildApiMessagesFromTranscript, createUserMessageTranscriptEvent, HostMessageTranscriptEvent, TranscriptContentPart, UserMessageTranscriptEvent
- `skills/info-system-prompts` — 移除 5 个 builder 函数（已迁移到 useAssistant.ts）
- `skills/types` — 仅保留 RuntimeRecord
- `utils/assistant-flow` — 移除 markAssistantFlowRoundError, upsertAssistantFlowSkillNodeByToken
- `state/types` — 移除 5 个未使用的类型
- `utils/app-debug` — 移除 4 个未使用的调试函数

### 死模块级代码移除（21 个函数）

这些函数是旧版 `executeAssistantTurn` 的辅助函数，已复制到 `useAssistant.ts`：
- createViewportRectSnapshot, rectToSnapshot
- apiMessageToText, estimateUsage, estimateTokens
- serializeReadActionForHost, resolveReadActionDisplayPath, serializeReadResultForHost
- serializeRunActionForHost, serializeEditActionForHost, serializeEditResultForHost
- formatSkillStepResult, buildSkillAgentSystemPrompt, parseActionExecutionPayload
- TRANSCRIPT_REPLAY_SYSTEM_PROMPT
- buildUserTranscriptContent, buildOutgoingImageAttachments
- getUserTranscriptText, createStaticAssistantEvent
- applyPermissionGatesToSkillCall, applyPermissionGatesToRun

### 组件级死代码抑制

20 个旧版 executeAssistantTurn 相关的组件级声明通过 `void` 引用抑制了 TS6133 错误：
- Zustand store setters: setIsFetchingModelsByProviderId, setIsSending, setActiveRequestConversationId
- 状态: abortController, setAbortController, processingTurnQueueRef
- 处理函数: appendSkillRoundLog, copyTextToClipboard, executeAssistantTurn, 
  updateConversationTranscript, resetComposerState, buildTurnHistoryTranscript,
  clearQueuedTurnExecutions, appendConversationTranscriptEvents,
  appendAssistantFlowRoundDivider, clearAssistantFlowRoundState,
  appendAssistantStreamDelta, resetAssistantStreamOutput,
  ensureReadyToRequest, applyAssistantResult

这些 `void` 引用是临时的——在后续阶段提取 hooks/views 时会自然清理。

## 验证

- **App.tsx 行数**：7,576 → 7,228（−348 行，−4.6%）
- **构建**：成功（runtime-shell 缺失是已知预存问题）
- **测试**：39 通过（1 个 E2E 文件失败，预存问题）
- **tsc 错误**：原 70+ → 现在 8 个（全部是预存错误：removePendingImage, updatePendingImageCompression, stopGeneration, fetchProviderModels, testProviderModel, saveAssistantEdit, saveUserEdit, beginEdit）

## 已创建/修改的文件

| 文件 | 操作 | 描述 |
|------|------|------|
| `src/App.tsx` | 修改 | 导入清理 + 死代码移除 |
| `src/hooks/useChatUI.ts` | 修改 | 更新为完整实现（待集成） |
| `src/utils/app-module.ts` | 新建 | 模块级代码提取（已创建，但尚未在 App.tsx 中集成——因组件级死代码与模块代码交织复杂） |

## 已知问题

1. **预存的 tsc 错误**：8 个 TS2304/TS2552 错误在重构前就存在（removePendingImage, fetchProviderModels 等）
2. **useChatUI 尚未集成**：hook 文件已更新但未在 App.tsx 中使用——UI handler 代码分散且与 App 特定逻辑（openSettingsHome, closeSettingsPanel 等）交织
3. **app-module.ts 未集成**：模块代码已提取到文件但 App.tsx 仍保留内联版本——因为某些函数被旧版组件级代码引用
4. **组件级死代码**：20 个声明通过 `void` 引用抑制，需要后续阶段清理

## 后续建议（2026-06-11 更新）

> **状态**：D3/D4/D5/D6 hooks 已通过解构替换成功集成。D1 hook 已创建并导入。
> App.tsx 当前 5,416 行（−28.5%）。剩余方案详见 `074-app-modular-refactor-integration-progress.md`。

1. ~~**阶段 D（优先级最高）**~~ → D3/D4/D5/D6 ✅ 完成
2. **D1 集成**：useConversation effects 需逐块手动移除内联效果 → 预计 −400 行
3. **阶段 E**：提取渲染函数到 views/ → 预计 −1,500 行
4. **阶段 F**：最终精简 + 更新摘要 → 目标 ~400 行
5. **修复预存的 tsc 错误**：removePendingImage 等 8 个函数缺失
