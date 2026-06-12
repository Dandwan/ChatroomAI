# `src/hooks/useAssistantStream.ts`

## 状态：已删除（2026-06-12）

此文件是 `useAssistant` hook 的替代实现（422 行），但整个 `src/` 目录零引用。唯一保留流 delta RAF 清理 effect（原 App.tsx:3976）的位置。

删除后无功能影响：`useAssistant.ts` 是实际生效的流处理实现，RAF 回调在组件卸载时不产生可观测副作用。
