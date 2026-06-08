# `src/styles/app-editorial-redesign.css`

## 功能
App editorial redesign 的全局样式表。包含主页空白态（cover-empty-state）、首页风景背景、chat chrome 透明层、首页发送过渡动画、底部 composer、以及新增的云服务认证表单（cover-auth-form）样式。所有样式使用 CSS 自定义属性和 editorial 设计语言（Noto Serif SC / Noto Sans SC / Newsreader Italic / Manrope 字体栈）。

无障碍精修（062）：
- 首页 composer 控件（textarea / send button / icon-button / model-trigger）、model popover option、mode button 均补充 `:focus-visible` 焦点环，复用 `--focus-ring` token（随主题切换）。
- 登录/认证表单（叠在深色封面图上、颜色写死浅色）的 `.cover-auth-input` 与 `.cover-auth-btn` 使用显式浅色焦点环；同时提升 `.cover-auth-label`（0.52→0.66）与 input placeholder（0.28→0.42）透明度以满足对比度。
- assistant 正文行宽 `max-width` 由 38ch 放宽至 46ch（缓解英文/代码/长 URL 横向溢出）。

## 关系
### 被依赖
- `src/App.tsx` — 通过 `import './styles/app-editorial-redesign.css'`
- `src/components/NewConversationShowcase.tsx` — 使用 `.cover-empty-state` 系列类
- `src/components/CloudAuthForm.tsx` — 使用 `.cover-auth-form` 系列类
- `src/components/settings/ProvidersSettings.tsx` — 使用 `.cloud-provider-login-btn`
