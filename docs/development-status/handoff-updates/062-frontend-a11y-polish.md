# 062 — Frontend Accessibility & Polish

**Period**: 2026-06-08

## Scope

对 ActiChat 前端做一轮无障碍与精修，源于一次 editorial 前端设计评审。改动严格限定为样式层，不触碰任何 React 组件逻辑或 JS。属于 `30-current-state` 中 "Continue front-end redesign polish" 待办项的延续。

四项改动（A 焦点可见性 / B 登录表单对比度 / C reduced-motion 全局兜底 / D 正文行宽）。

## Changes

### A — 焦点可见性（⚡）
`src/styles/app-editorial-redesign.css`：
- 首页 composer 控件（`textarea.chat-input-box` / `.composer-send-button` / `.icon-button` / `.composer-model-trigger`）补 `:focus-visible`，复用 `--focus-ring` token + `--accent-2` 边框色（随主题切换，与 App.css 既有 4 处用法一致）。
- model popover `.model-option` 与 `.homepage-model-mode-button` 补 `:focus-visible { box-shadow: var(--focus-ring); }`。
- 登录/认证表单元素叠在深色封面图上、颜色写死浅色，故用显式浅色焦点环：`.cover-auth-input:focus-visible`（底边加亮 + 1px 下投影）、`.cover-auth-btn:focus-visible`（2px 浅色环）。

背景：`--focus-ring` token 在 `foundation.css` 早已定义（light/dark 双值），此前仅 App.css 用了 4 处、editorial 表面几乎未用；全局 reset 的 `outline: none` 抹掉了默认焦点环，键盘用户缺乏可见焦点。

### B — 登录表单对比度（⚡）
`.cover-auth-label` 透明度 0.52→0.66；`.cover-auth-input::placeholder` 0.28→0.42。输入文本本身已是 0.92，未动。
> 经验值调整。封面图为动态四图轮换，精确 WCAG 比值需在真机 + 真实封面图上用对比度工具复核 —— 当前未做真机取色验证。

### C — reduced-motion 全局兜底（💡）
`src/App.css` 现有 `@media (prefers-reduced-motion: reduce)` 块内新增 `*, *::before, *::after` 全局规则（animation-duration / transition-duration → 0.01ms，iteration-count → 1，scroll-behavior → auto，均 `!important`）。统一接管散落在 App.css（fade-in/fade-up/pop-in/pulse-dot/icon-bob/tilt/wiggle 共 20+ 处）、app-overlay-panels.css（delete-ready-wiggle 等）、app-editorial-redesign.css（920ms 首页转场）的所有动画。保留原有针对 svg 的具体降级规则，未删除。

### D — 正文行宽（💡）
`.message-card.assistant > .markdown-content`（及 `.assistant-inline-flow >`）`max-width` 38ch→46ch，缓解英文/代码/长 URL 横向溢出。仅影响阅读态（active-chat），与首页 hero 原型对齐无关。

## Files Touched

- `src/styles/app-editorial-redesign.css` — A / B / D
- `src/App.css` — C
- `docs/development-status/summaries/src/styles/app-editorial-redesign.css.md` — 更新摘要
- `docs/development-status/summaries/src/App.css.md` — 新建摘要（此前缺失）

## Validation

- `npm run build` — ✅ 通过（仅既存的 chunk 大小警告，与本次无关）
- `npm run lint` — 残留 27 errors 全部来自 `tools/proxy-diff/`、cloud-server 等无关文件；CSS 文件不受 ESLint 检查，本次无新增 lint 问题。`App.tsx:1099` 的 `react-hooks/set-state-in-effect` 既存问题不在本次范围。
- ⚠️ **未做**：真机/模拟器视觉验证与登录表单封面图对比度取色。纯 CSS 改动，但 Android WebView 上 `:focus-visible` 与对比度仍建议真机复核。

## Open Follow-Up

- 真机复核登录表单在四张封面图亮部下的实际对比度（WCAG AA 4.5:1）。
- 真机验证键盘焦点环在 Android WebView 的呈现（部分 WebView 对 `:focus-visible` 支持差异）。
- reduced-motion 全局兜底建议在开启系统「减弱动态效果」的真机上确认无副作用（如必要的状态过渡是否仍可感知）。
