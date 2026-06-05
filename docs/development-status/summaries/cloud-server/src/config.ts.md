# `cloud-server/src/config.ts`

## 功能
加载和合并 cloud-server 运行时配置。优先级：环境变量 > `data/config.json` > 硬编码默认值。启动时检测 JWT Secret 是否为随机生成并警告。配置文件存储在 `data/` 目录（Docker volume 持久化），确保容器重建后配置不丢失。**v5: 新增 `defaultFaultTolerance`。v6: 新增 `actiNetModelMapping`。v7: 新增 `tls.enable/cert/key`（HTTPS 支持）、`proxyUrl`（全局代理）、`wsAuth`（WebSocket 认证开关），以及 `reloadConfigFromFile()` 供配置热重载使用。v8: 新增 `emailCooldownSeconds`（邮箱发送冷却时间，默认 120 秒），支持环境变量 `CLOUD_SERVER_EMAIL_COOLDOWN_SECONDS` 和热重载。**

## 关系
### 提供
- `loadConfig()` — 加载合并后的配置
- `reloadConfigFromFile()` — 重新读取 config.json 并返回变更 delta
- `ServerConfig` 接口

### 被依赖
- `cloud-server/src/app.ts`
- `cloud-server/src/app-context.ts`
- `cloud-server/src/admin/admin-routes.ts`
- `cloud-server/src/watcher/config-watcher.ts`
- `cloud-server/src/index.ts`
