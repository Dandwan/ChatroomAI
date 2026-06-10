# 068 — 测试基础设施扩展与组件测试

**日期**: 2026-06-10
**类型**: 新增功能

## 完成的工作

扩展了 ActiChat 的测试基础设施：
- 添加测试脚本到 package.json
- 新增 React Testing Library 组件测试（MarkdownMessage）
- 扩展工具函数测试覆盖
- 建立 Playwright E2E 测试框架

### 新增/修改文件

| 文件 | 操作 | 描述 |
|------|------|------|
| `package.json` | 修改 | 添加 test/test:watch/test:coverage/test:e2e 脚本，新增 @playwright/test/@vitest/coverage-v8 |
| `src/utils/__tests__/validation.test.ts` | 新建 | 7 个测试：邮箱/URL/API 密钥验证、版本比较 |
| `src/components/__tests__/MarkdownMessage.test.tsx` | 新建 | 9 个测试：Markdown 渲染（文本/加粗/代码/链接/标题/列表/代码块） |
| `playwright.config.ts` | 新建 | Playwright 配置（Chromium，Vite dev server） |
| `e2e/homepage.spec.ts` | 新建 | 2 个测试：首页加载、品牌渲染 |
| `.gitea/workflows/test.yml` | 新建 | CI 流水线（单元测试 + E2E 分阶段） |

### 测试统计

- **已有**: 23 个测试（5 个文件）
- **新增**: 16 个测试（2 个文件）+ 2 个 E2E 测试
- **总计**: 39 个单元/组件测试 + 2 个 E2E 测试
- **运行时间**: <1s（单元），~3s（E2E）

## 运行方式

```bash
npm test              # 运行单元/组件测试
npm run test:watch    # 监听模式
npm run test:coverage # 覆盖率报告
npm run test:e2e      # Playwright E2E 测试
```

## 覆盖范围

- ✅ MarkdownMessage 组件渲染
- ✅ 工具函数（验证、版本比较、API 密钥处理）
- ✅ 首页 E2E（页面加载、品牌渲染）

## 已知限制

- App.tsx 核心组件未直接测试（规模大，需 setUp 复杂）
- 需要 Capacitor mock 的组件未测试
- Android WebView 测试未包含
- E2E 测试首阶段数量少（2 个），待扩展
