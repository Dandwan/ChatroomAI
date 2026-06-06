## 功能

配置加载与合并。从 JSON 文件加载配置，支持默认值、用户覆盖、CLI 参数合并。优先级：CLI 参数 > 用户配置文件 > 默认值。

## 关系

### 调用 / 引用

- `types.ts` — `ProxyDiffConfig` 及相关配置接口

### 提供

- `loadConfig(configPath?)` — 加载并合并配置

### 被依赖

- `index.ts`

## 关键词

### 函数

- `loadConfig(configPath?: string): ProxyDiffConfig`

### 内部函数

- `mergeConfig(defaults, overrides)` — 深度合并配置对象
