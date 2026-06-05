# 037 — 云服务品牌名称统一为 ActiNet

**日期**：2026-06-06

## 范围

将项目中所有不一致的云服务品牌名称统一为 **ActiNet**（ActiNet 云服务）。此前客户端的 ActiNet 相关 UI 已基本使用 ActiNet，但邮件模板、管理后台标题、以及部分登录界面的文案仍使用 "ActiChat 云服务器" / "ActiChat 云服务" / "ActiChat 管理后台"，本次全部统一。

## 决策关卡

- 方案已提出：是
- 用户确认已收到：是
- 用户选择：
  - 邮件主题：使用纯 "ActiNet" 前缀（不含"动话"）
  - 管理后台：确认改为 "ActiNet 管理后台"

## 变更的代码区域

### 前端（客户端）
- `src/components/CloudAuthForm.tsx:457` — "登录 ActiChat 云服务器" → "登录 ActiNet 云服务"
- `src/components/CloudLoginPage.tsx:38` — "登录 ActiChat 云服务器" → "登录 ActiNet 云服务"

### 云服务器后端
- `cloud-server/src/email/email-templates.ts` — 全部品牌文本：注释、4 个邮件主题、正文引用、签名统一改为 ActiNet
- `cloud-server/src/index.ts:19` — 启动日志 "ActiChat Cloud Server" → "ActiNet Cloud Server"

### 管理后台 (Admin UI)
- `cloud-server/admin-ui/index.html:6` — `<title>ActiChat 管理后台</title>` → `ActiNet 管理后台`
- `cloud-server/admin-ui/src/pages/LoginPage.tsx:27` — `<h1>ActiChat 管理后台</h1>` → `ActiNet 管理后台`
- `cloud-server/admin-ui/src/components/Layout.tsx:20` — 导航栏 "ActiChat 管理后台" → "ActiNet 管理后台"
- `cloud-server/admin-ui/src/styles/admin.css:1` — CSS 注释 `ActiChat Admin UI` → `ActiNet Admin UI`

### 代码摘要
- 更新：`CloudAuthForm.tsx.md` — 无需变更（摘要不包含品牌文本）
- 更新：`email-templates.ts.md` — 描述文字 "ActiChat" → "ActiNet"
- 更新：`index.ts.md` — 描述文字追加 "(ActiNet)"
- 新建：`CloudLoginPage.tsx.md`、`admin-ui/index.html.md`、`LoginPage.tsx.md`
- 无需更新：`Layout.tsx.md`、`admin.css.md`（摘要内容不包含品牌文本）

## 不变更

- npm 包名 (`actichat-cloud-server`, `actichat-admin-ui`) — 技术标识符
- Docker 镜像名 — 基础设施标识符
- 客户端 App 名称 "ActiChat" / "动话" — 客户端与云服务是不同的品牌概念
- Android 包名 `com.dandwan.chatroomai`
- DKIM selector、localStorage key 等内部标识符

## 验证

- `npx tsc --noEmit` — 主项目、cloud-server、admin-ui：**全部零错误**
- 邮件模板文本完整性检查通过

## 已知限制

无。

## 下一步

- 部署云服务器后验证邮件模板中的新品牌名称
- 如有其他遗漏的 "ActiChat 云服务器" 引用，后续发现后修正
