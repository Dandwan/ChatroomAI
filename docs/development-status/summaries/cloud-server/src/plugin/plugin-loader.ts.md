# `cloud-server/src/plugin/plugin-loader.ts`

## 功能
插件加载器。从指定目录（默认为 `cloud-server/plugins`）动态加载所有 `.js`/`.ts`/`.mjs` 文件，要求每个插件文件默认导出 `CloudServerPlugin` 接口对象。支持 `loadPlugins()` 加载、`getPlugins()` 查询已加载列表、`unloadPlugins()` 清理（调用各插件的 `onDestroy` 钩子）。

## 关系
### 调用 / 引用
- `cloud-server/src/plugin/plugin-types.ts` — `CloudServerPlugin`, `PluginModule`
- `cloud-server/src/logger.ts` — `createLogger`
- `node:fs` — `readdirSync`, `existsSync`
- `node:path` — `resolve`, `dirname`
- `node:url` — `fileURLToPath`, `pathToFileURL`

### 提供
- `loadPlugins()` — 从目录加载所有插件
- `getPlugins()` — 获取已加载插件列表
- `unloadPlugins()` — 销毁所有插件

### 被依赖
- （目前未被其他模块静态依赖，由 app.ts 按需调用）

## 关键词
### 函数
- `loadPlugins`
- `getPlugins`
- `unloadPlugins`
