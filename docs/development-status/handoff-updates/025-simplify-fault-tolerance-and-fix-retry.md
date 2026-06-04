# 025 — 简化容错层级 & 修复重试循环

**日期**：2026-06-04

## 范围

1. **修复重试循环失效**：`proxy-routes.ts` 缺少内层 try-catch，`request-forwarder.ts` 错误时 return 而非 throw，导致 forwarder 异常穿透到外层 catch，跳过所有重试/容错逻辑
2. **简化容错配置层级**：从三层（全局 → 上游 → Key）减为两层（全局 → 上游），Key 不再独立配置容错值

## 根因

Docker 镜像使用的是已提交旧代码（commit `9c0af40`），修复代码在本地工作区未部署：

- `request-forwarder.ts`：上游非 2xx 或 JSON 解析失败时 `return` 错误对象，而非 `throw`，导致 SyntaxError 等异常直接穿透
- `proxy-routes.ts`：`forwardStreamRequest`/`forwardNonStreamRequest` 调用无 try-catch 包裹，异常跳到外层 catch → 直接返回 502

## 变更的代码区域

### 修改：`cloud-server/src/types.ts`
- `UpstreamApiKey` 移除 `fault_tolerance` 字段

### 修改：`cloud-server/src/db/repositories/upstream-repo.ts`
- `keyFromRow()` — 不再读取 `fault_tolerance`
- `createKey()` — INSERT 不再包含 `fault_tolerance` 列
- `updateKey()` — 移除 `fault_tolerance` 字段支持

### 修改：`cloud-server/src/admin/admin-routes.ts`
- POST `/api/admin/upstreams` — Key 创建不再接受 `fault_tolerance` 参数
- POST `/api/admin/upstreams/:id/keys` — 同上
- PUT `/api/admin/upstreams/:id/keys/:keyId` — 移除 `fault_tolerance` 更新能力
- 日志字段适配

### 修改：`cloud-server/src/proxy/proxy-routes.ts`
- **新增内层 try-catch**：包裹 forward 调用，捕获异常后转为 error result 进入重试循环
- 容错值改为 `upstream.key_fault_tolerance ?? ctx.config.defaultFaultTolerance`

### 修改：`cloud-server/src/proxy/request-forwarder.ts`（已在工作区，未提交）
- 上游非 2xx：`return { statusCode, ... }` → `throw new Error(...)`
- 异常处理：`return { statusCode: 502 }` → `throw err`（让上游统一捕获）
- 新增 `proxyUrl` 参数透传

### 修改：`cloud-server/admin-ui/src/api.ts`
- `UpstreamData.api_keys[]`、`UpstreamKeyData` 移除 `fault_tolerance`
- `createUpstream`、`addUpstreamKey`、`updateUpstreamKey` 参数移除 `fault_tolerance`

### 修改：`cloud-server/admin-ui/src/pages/UpstreamsPage.tsx`
- 移除 `handleUpdateKeyFt` 函数和导入
- 移除表格中每个 Key 的容错输入框
- 列头 "Keys (容错)" → "Keys"
- 表单 tooltip 更新

### 修改：`cloud-server/admin-ui/src/pages/SettingsPage.tsx`
- 容错说明文字更新为两层继承链

### DB 兼容
- `upstream_api_keys.fault_tolerance` 列保留不动，代码层面停止读写

## 设计决策

1. **容错两层**：Key 不再独立配置容错，同一上游下所有 Key 共享上游的 `key_fault_tolerance`
2. **运行时解析**：`upstream.key_fault_tolerance ?? config.defaultFaultTolerance`
3. **DB 无损保留**：不执行 SQLite DROP COLUMN（兼容性风险），仅代码层面忽略
4. **throw 而非 return**：forwarder 错误统一抛异常，由 proxy-routes 内层 try-catch 统一捕获

## 验证

- `npx tsc --noEmit` — cloud-server：零错误
- `npx tsc --noEmit` — admin-ui：零错误
- `npm run build` — admin-ui：构建成功（389 KB JS, 7.1 KB CSS）

## 决策关卡

- 方案已提出：是
- 用户确认已收到：是

## 下一步

- 部署到云服务器：`./scripts/deploy-cloud-server.sh`
- 部署后通过 Admin UI 为 OpenCode 上游设置 `key_fault_tolerance = 5`（当前为 null）
- 观察生产环境重试日志，验证修复效果
