## 功能

proxy-diff 测试套件的 npm 包配置。ESM 模块（`"type": "module"`），CLI 入口为 `dist/index.js`。

## 关系

### 引用

- `commander` ^12.1.0 — CLI 框架
- `diff` ^7.0.0 — 文本/JSON 差异对比
- `express` ^5.1.0 — HTTP 服务器（upstream simulator）
- `undici` ^7.2.0 — HTTP 客户端（含 ProxyAgent）

### 被依赖

- npm / Node.js 运行时
