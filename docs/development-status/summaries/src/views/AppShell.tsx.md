# `src/views/AppShell.tsx`

## 功能
应用顶层布局壳组件。从 App.tsx 提取（E5 阶段）。封装视口 CSS class、背景层（homepage/chat-active）、过渡动画元素、app-shell-content 布局容器，以及通过 children-as-props 模式接收各子区域（header、summary、notice、content、composer、file inputs、drawer、image viewer、delete confirmation、update dialog、settings）。

## 关系
### 调用 / 引用
- 无外部依赖 — 纯布局组件，通过 ReactNode props 接收子元素

### 提供
- `AppShell` — 顶层布局壳组件
- `AppShellProps` — 组件 props 类型

### 被依赖
- `src/App.tsx` — 替代主 JSX return 语句的外层 div.app-shell
