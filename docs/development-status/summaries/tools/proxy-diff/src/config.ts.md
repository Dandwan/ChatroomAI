# `tools/proxy-diff/src/config.ts`

## 功能
proxy-diff 配置加载模块。从 JSON 文件读取配置（`proxy-diff.config.json` 或自定义路径），与默认值合并。支持 CLI 覆盖（运行时传入部分配置）。输出目录自动解析为绝对路径。

## 关系
### 调用 / 引用
- `types.ts` — `ProxyDiffConfig`

### 提供
- `loadConfig(configPath?)` — 加载并合并配置文件

### 被依赖
- `index.ts`

## 关键词
### 函数
- `loadConfig`
- `mergeConfig`
