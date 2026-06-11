# `src/hooks/useConversationDrawer.ts`
从 `src/App.tsx` 提取（Phase 2 — 步骤 5）。管理对话抽屉手势交互（长按、滑动删除、指针事件），对话 CRUD（切换/创建/删除）。
## 关系
### 调用 / 引用
- `src/state/ui-store.ts` — UI 状态（swipe、delete mode）
- `src/state/chat-store.ts` — 对话数据
- `src/state/settings-store.ts` — 设置
- `src/services/chat-storage.ts` — 删除存储
- `src/utils/app-module.ts` — 工厂函数
### 提供
- `useConversationDrawer` — 手势 handler + CRUD 函数
### 被依赖
- `src/App.tsx`
