# 032 — 其它服务商默认关闭开关

**日期**：2026-06-05

## 范围

在账号管理中新增「启用其它服务商」toggle 开关，**默认关闭**。只有打开该开关后，其它服务商的设置入口和模型才在账号管理页和聊天模型选择器中可见。

## 改动

### 修改文件

- `src/state/types.ts` — `AppSettings` 新增 `otherProvidersEnabled: boolean`
- `src/App.tsx` — 6 处变更：
  - `DEFAULT_SETTINGS` 新增 `otherProvidersEnabled: false`
  - `loadSettings` 向后兼容加载（旧版无此字段 → 默认 false）
  - `getEnabledModelOptions` 新增 `otherProvidersEnabled` 参数，关闭时跳过其它服务商模型
  - `enabledModelsByProvider` 依赖新增 `settings.otherProvidersEnabled`，关闭时 `groups` 为空
  - `ensureValidCurrentModelSelection` 关闭时将非 ActiNet 选中视为无效，自动回退
  - `renderAccountsSettings` 传递 `otherProvidersEnabled` 和 `onToggleOtherProviders` props
  - 主设置页账号管理入口卡片：关闭时简化 meta 文案，不显示服务商/模型统计
- `src/components/settings/AccountsSettings.tsx` — 新增 toggle 开关（`.toggle-row` + `.toggle-switch`）和条件渲染；新增 `otherProvidersEnabled`、`onToggleOtherProviders` props

### 更新：代码摘要
- `summaries/src/state/types.ts.md` — `AppSettings` 新增字段说明
- `summaries/src/App.tsx.md` — 新增近期变更记录
- `summaries/src/components/settings/AccountsSettings.tsx.md` — 更新功能和 props 描述

## 设计决策

1. **toggle 位置**：放在 `AccountsSettings` 中间页，紧邻受影响的「其它服务商」入口，用户直接看到因果关系
2. **默认关闭**：所有用户（无论之前是否添加过服务商）默认关闭，需手动开启
3. **数据保留**：关闭时不清除已配置的服务商数据，重新打开后恢复可见
4. **选中回退**：当前选中其它服务商模型时关闭开关 → 自动回退到 ActiNet 模型（如已登录）或空选择
5. **样式复用**：使用已有的 `.toggle-row` + `.toggle-switch` CSS，无新增样式
6. **向后兼容**：旧版 settings 无此字段 → `typeof parsed.otherProvidersEnabled === 'boolean' ? parsed.otherProvidersEnabled : false`

## 验证

- `npx tsc --noEmit` — 零错误
- `npm run lint` — 无新增问题（6 errors / 50 warnings 均为已有）
- `npm run build` — 构建成功（749.73 KB JS）

## 决策关卡

- 方案已提出：是
- 用户确认已收到：是
- 确认内容：
  1. 开关关闭时，当前选中回退到 ActiNet 模型（如已登录）或清空
  2. 主设置页入口卡片关闭时不显示其它服务商的统计信息

## 已知限制

- 无

## 下一步

- 在 Android 设备上验证完整流程：默认关闭 → 打开开关 → 添加服务商 → 关闭开关 → 验证隐藏/回退
- 可选：后续将「其它服务商」入口从 `AccountsSettings` 移至主设置页（根据用户反馈决定）
