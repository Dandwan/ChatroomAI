# `src/views/HomepageView.tsx`

## 功能
主页空白态渲染组件。从 App.tsx 提取（E4 阶段）。处理三种状态：对话加载失败（含重试按钮）、对话加载中、空消息主页（CloudAuthForm 或 NewConversationShowcase）。

## 关系
### 调用 / 引用
- `src/components/CloudAuthForm.tsx` — 云服务认证表单
- `src/components/NewConversationShowcase.tsx` — 新对话展示
- `src/state/types.ts` — Conversation, ConversationResponseMode, HomepageHighlightStat 类型
- `src/services/daily-cover.ts` — ResolvedDailyCover 类型

### 提供
- `HomepageView` — 主页空白态渲染组件
- `HomepageViewProps` — 组件 props 类型

### 被依赖
- `src/App.tsx` — 在主 message-list 中替代内联三元条件渲染

## 关键词
### 函数
- `HomepageView` — 主组件，根据状态渲染不同内容
