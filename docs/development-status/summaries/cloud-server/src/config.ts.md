# `cloud-server/src/config.ts`

## 功能
加载和合并 cloud-server 的运行时配置。优先级：环境变量 > `config.json` > 硬编码默认值。在启动时检测 JWT Secret 是否为随机生成并在生产环境中发出警告。

## 关系
### 提供
- `loadConfig()` — 加载并返回 `ServerConfig` 对象
- `ServerConfig` — 服务配置的 TypeScript 接口

### 被依赖
- `cloud-server/src/index.ts`

## 关键词
### 函数
- `loadConfig`
- `loadJsonConfig`

### 接口
- `ServerConfig`
