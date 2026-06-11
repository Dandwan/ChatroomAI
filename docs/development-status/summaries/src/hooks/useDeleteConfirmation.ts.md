# `src/hooks/useDeleteConfirmation.ts`
从 `src/App.tsx` 提取（Phase 2 — 步骤 6）。统一删除确认弹窗逻辑（对话/服务商/技能/运行时）。
## 关系
### 调用 / 引用
- `src/state/ui-store.ts` — 删除弹窗状态
- `src/services/skills/types.ts` — SkillRecord/RuntimeRecord
### 提供
- `useDeleteConfirmation` — 确认函数
### 被依赖
- `src/App.tsx`
