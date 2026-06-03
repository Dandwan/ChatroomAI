# 018 — ActiNet 登录默认服务器地址配置

**日期**：2026-06-03

## 范围

为 ActiNet 云服务登录添加默认服务器地址常量 `DEFAULT_CLOUD_SERVER_URL = 'https://47.108.210.249:2179/'`，并彻底移除前端服务器地址输入框。用户登录/注册时不再需要手动输入服务器地址，开发者通过修改常量即可适配地址变更。

## 变更的代码区域

### 修改：`src/services/cloud-auth.ts`
- 新增常量 `DEFAULT_CLOUD_SERVER_URL`，值为 `https://47.108.210.249:2179/`
- 修改 `getCloudServerUrl()` 回退逻辑：`localStorage 有值 ? 取已存值 : DEFAULT_CLOUD_SERVER_URL`

### 修改：`src/components/CloudAuthForm.tsx`
- 删除 `savedServerUrl`、`needsServerUrl`、`serverUrl` 本地状态
- 删除服务器地址输入框 JSX 及相关校验（"请输入服务器地址"）
- `handleSubmit` 中 `cloudLogin` / `cloudRegister` 改为传入 `getCloudServerUrl()` 返回值
- 用户名输入框 `autoFocus` 无条件启用

### 更新：代码摘要
- `summaries/src/services/cloud-auth.ts.md` — 新增 `DEFAULT_CLOUD_SERVER_URL` 常量说明，更新 `getCloudServerUrl` 行为描述
- `summaries/src/components/CloudAuthForm.tsx.md` — 移除服务器地址输入描述，更新为"服务器地址由 `getCloudServerUrl()` 自动提供"

## 验证

- `npx tsc --noEmit` — 零错误
- `npm run lint` — 无新增错误（仅 App.tsx 已有警告）

## 决策关卡

- 方案已提出：是（含修订——增加移除地址输入框）
- 用户确认已收到：是

## 已知限制

- 默认地址硬编码在源码中，上线前需手动修改 `DEFAULT_CLOUD_SERVER_URL` 常量
- 已登录用户不受影响（localStorage 中已有保存地址时优先使用）

## 下一步

- 上线时修改 `DEFAULT_CLOUD_SERVER_URL` 为生产地址
- 可考虑后续引入 Vite 环境变量以区分 dev/prod 配置
