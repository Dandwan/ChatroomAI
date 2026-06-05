# `cloud-server/src/email/direct-delivery.ts`

## 功能
MX 直连邮件投递引擎。不依赖任何外部 SMTP 中继，通过 DNS MX 记录查询找到收件人域名的邮件服务器，使用原生 `net` 模块进行 SMTP 握手并投递。包含重试队列（3次指数退避）、并发控制（最多5个）、DKIM 签名生成和投递引擎生命周期管理。

## 关系
### 调用 / 引用
- `node:dns` — `promises.resolveMx`
- `node:net` — `createConnection`
- `node:crypto` — `createHash`、`createSign`
- `cloud-server/src/config.ts` — `DkimConfig`
- `cloud-server/src/logger.ts` — `createLogger`

### 提供
- `deliverEmail(envelope, rawEmail)` — 单次 MX 投递，返回 `DeliveryResult`
- `enqueueDelivery(envelope, rawEmail)` — 入队投递（含重试），返回 `messageId`
- `startDeliveryEngine(dkim?, hostname?)` — 启动投递引擎（启动重试定时器）
- `stopDeliveryEngine()` — 停止投递引擎（等待活跃投递完成）
- `getQueueSize()` — 获取队列中待投递邮件数
- `getActiveDeliveries()` — 获取活跃投递数
- `updateDkimConfig(config)` — 热重载 DKIM 配置
- `updateHeloHostname(hostname)` — 热重载 HELO 主机名
- `DeliveryEnvelope` — 投递信封接口 `{ from, to }`
- `DeliveryResult` — 投递结果接口 `{ success, messageId, error?, mxTried? }`

### 被依赖
- `cloud-server/src/email/smtp-server.ts`

## 关键词
### 函数
- `deliverEmail`
- `enqueueDelivery`
- `startDeliveryEngine`
- `stopDeliveryEngine`
- `getQueueSize`
- `getActiveDeliveries`
- `updateDkimConfig`
- `updateHeloHostname`
- `generateDkimSignature`
- `deliverToMx`
- `handleRetry`
- `processQueue`
- `generateMessageId`
- `extractDomain`

### 接口/类型
- `DeliveryEnvelope`
- `DeliveryResult`
- `QueueItem`

### 常量
- `MAX_RETRIES`
- `MAX_CONCURRENT`
- `DELIVERY_TIMEOUT_MS`
