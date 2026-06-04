# `cloud-server/src/config.ts`

## 功能
加载和合并 cloud-server 运行时配置。优先级：环境变量 > `config.json` > 硬编码默认值。启动时检测 JWT Secret 是否为随机生成并警告。**v5: 新增 `defaultFaultTolerance` 全局配置项（环境变量 `CLOUD_SERVER_DEFAULT_FAULT_TOLERANCE` 或 `config.json`，默认 0），作为所有 Key 的全局默认容错值。**

## 关系
### 提供
- `loadConfig()` — 加载合并后的配置
- `ServerConfig` 接口

### 被依赖
- `cloud-server/src/app.ts`
- `cloud-server/src/app-context.ts`
- `cloud-server/src/admin/admin-routes.ts`
