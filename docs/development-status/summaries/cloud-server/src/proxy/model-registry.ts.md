# model-registry.ts

## 功能
中央模型注册表，为已知 AI 模型提供结构化的能力元数据。主要存储 thinking 支持信息（adaptive/budget_only/level_only/hybrid/none）、API 类型、流式支持和上下文窗口大小。供 `thinking.ts` 和 `signatures.ts` 查询模型能力，替代原来基于正则的临时字符串匹配。

## 关系
### 调用 / 引用
- `../types.js` — `ModelInfo`, `ThinkingCapability`

### 提供
- `lookupModelInfo(modelName)` — 按名称精确匹配注册表，未命中时回退到启发式名称模式匹配
- `registerModelInfo(info)` — 运行时注册用户定义模型
- `getAllModelNames()` — 返回所有注册模型名
- `modelSupportsAdaptiveThinking(modelName)` — 已弃用，兼容旧代码的委托函数

### 被依赖
- `thinking.ts`
- `signatures.ts`
- `format-converter.ts`

## 关键词
### 函数
- `lookupModelInfo`
- `registerModelInfo`
- `getAllModelNames`
- `modelSupportsAdaptiveThinking`
- `heuristicLookup`
