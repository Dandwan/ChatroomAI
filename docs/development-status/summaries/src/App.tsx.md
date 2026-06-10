# `src/App.tsx`

## 功能
ActiChat 应用的主 shell 组件。包含对话管理、设置面板、主页空白态渲染、消息流处理、streaming 协议解析、云服务认证集成、首页发送过渡动画等全部核心 UI 逻辑。

**近期变更（2026-06-10）：模块化重构阶段 1-2**
- 提取 debug 日志工具到 `src/utils/app-debug.ts`（已集成 ✅）
- 提取图片查看器工具到 `src/utils/app-images.ts`（已集成 ✅）
- 创建 `src/utils/app-formatting.ts`（待集成）
- 创建 `src/hooks/useChatUI.ts`（待集成）
- 创建 `src/hooks/useAssistant.ts`（1736行，完整提取，待集成）
- 文件大小：9,584 → 9,398 行（减少 186 行）

## 关系
### 调用 / 引用
- `src/components/` — ChatHeader, ChatInputBox, ChatSummaryBar, AppDrawer, ImageViewer 等
- `src/components/settings/` — 各设置页组件
- `src/services/cloud-auth.ts`、`src/services/chat-api.ts`、`src/services/chat-storage/`、`src/services/chat-transcript/`、`src/services/skills/`
- `src/state/chat-store.ts`、`src/state/ui-store.ts`、`src/state/settings-store.ts`、`src/state/extensions-store.ts`
- `src/hooks/useCloudAuth.ts`
- `src/utils/app-debug.ts` — debug 工具函数 ✅
- `src/utils/app-images.ts` — 图片查看器工具 ✅

### 提供
- `App` — React 根组件（default export）

### 被依赖
- `src/main.tsx` — 入口文件渲染 App 组件

## 关键词
### 函数
- `App`
- `executeAssistantTurn` — 核心 AI 交互逻辑（1068行，已完整提取到 useAssistant.ts，待集成）
- `handleSend`、`handleAppend`、`regenerate`、`copyMessageText`

### 常量
- `SETTINGS_STORAGE_KEY`、`SETTINGS_PERSIST_DEBOUNCE_MS`
- `ACTINET_PROVIDER_ID`、`ACTINET_PROVIDER_NAME`
