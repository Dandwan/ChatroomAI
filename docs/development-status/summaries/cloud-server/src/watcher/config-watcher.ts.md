# `cloud-server/src/watcher/config-watcher.ts`

## 功能
配置文件热重载监听器。使用 Node.js 内置 `fs.watch` 监听 `data/config.json` 变更，通过 500ms 防抖聚合快速连续写入，对比新旧配置后仅应用变更字段（logLevel、defaultFaultTolerance、actiNetModelMapping、proxyUrl、wsAuth、healthCheckIntervalMs、emailCooldownSeconds）。端口、TLS 和 dbPath 变更需重启。

## 关系
### 调用 / 引用
- `node:fs` — `watch`、`existsSync`
- `cloud-server/src/config.ts` — `reloadConfigFromFile`
- `cloud-server/src/app-context.ts` — `AppContext.updateConfig`
- `cloud-server/src/logger.ts`

### 提供
- `startConfigWatcher(ctx)` — 启动配置监听

### 被依赖
- `cloud-server/src/app.ts`
