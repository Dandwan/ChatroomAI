# transformer-cache.ts

## 功能
轻量级 LRU 缓存，追踪 TransformStream 构造配置的使用情况。不缓存 TransformStream 实例（每个请求都需要独立实例，writable 关闭后无法复用），而是通过稳定的缓存 key 避免对相同模型重复进行模型能力查询和正则求值。

## 关系
### 提供
- `getTransformerKey(direction, modelName?)` — 生成稳定的缓存 key
- `touchTransformerKey(key)` — 记录 key 访问，触发 LRU 驱逐
- `hasTransformerKey(key)` — 检查 key 是否在缓存中
- `getTransformerCacheSize()` — 获取缓存大小（用于监控）

### 被依赖
- `proxy-routes.ts`

## 关键词
### 函数
- `getTransformerKey`
- `touchTransformerKey`
- `hasTransformerKey`
- `getTransformerCacheSize`
