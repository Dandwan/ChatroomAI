# `src/App.css`

## 功能
应用基础样式表（2462 行）。定义 app-shell 布局、header-card、message-card、composer、model popover、settings field、image viewer、reasoning/skill-step 面板等核心 UI 的共享样式与 fade-in / fade-up / pop-in / pulse-dot / icon-bob / icon-tilt / icon-wiggle 等动画应用。通过 `@import './styles/app-overlay-panels.css'` 引入抽屉/弹层样式。焦点态复用 `--focus-ring` token。

无障碍精修（062）：`@media (prefers-reduced-motion: reduce)` 块新增全局兜底规则（`*, *::before, *::after` 将 animation-duration / transition-duration 降为 0.01ms、iteration-count 设为 1、scroll-behavior 设为 auto），统一接管散落在本文件与 [[app-overlay-panels.css]]、[[app-editorial-redesign.css]] 中的所有动画/过渡；保留原有针对 svg 的具体降级规则。

## 关系
### 被依赖
- `src/App.tsx` — 通过 `import './App.css'`（editorial 样式表在其后 import，覆盖部分基线值）
### 依赖
- `src/styles/app-overlay-panels.css` — 通过 `@import`
- `src/styles/foundation.css` — 使用其定义的设计 token（`--focus-ring`、`--accent-2` 等，由 `main.tsx`/全局引入）
