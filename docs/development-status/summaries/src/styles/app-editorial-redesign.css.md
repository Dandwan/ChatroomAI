# `src/styles/app-editorial-redesign.css`

## 功能
App editorial redesign 的全局样式表。包含主页空白态（cover-empty-state）、首页风景背景、chat chrome 透明层、首页发送过渡动画、底部 composer、以及新增的云服务认证表单（cover-auth-form）样式。所有样式使用 CSS 自定义属性和 editorial 设计语言（Noto Serif SC / Noto Sans SC / Newsreader Italic / Manrope 字体栈）。

## 关系
### 被依赖
- `src/App.tsx` — 通过 `import './styles/app-editorial-redesign.css'`
- `src/components/NewConversationShowcase.tsx` — 使用 `.cover-empty-state` 系列类
- `src/components/CloudAuthForm.tsx` — 使用 `.cover-auth-form` 系列类
- `src/components/settings/ProvidersSettings.tsx` — 使用 `.cloud-provider-login-btn`
