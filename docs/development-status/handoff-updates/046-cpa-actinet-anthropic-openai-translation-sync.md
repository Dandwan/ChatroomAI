# 046 — CPA vs ActiNet Anthropic→OpenAI 翻译行为同步方案（源码对齐版）

**日期**: 2026-06-07
**状态**: 方案确定，以 CPA 源码为准
**参考**: CPA 源码 `github.com/router-for-me/CLIProxyAPI` — `ConvertClaudeRequestToOpenAI()`

---

## 决策

以 **CPA GitHub 源码** (`internal/translator/openai/claude/openai_claude_request.go`) 为权威参考。测试服务器上的部署版 CPA 二进制文件行为与源码不一致（原因：不同版本/构建），不作为参考。

---

## 逐项差异分析（CPA 源码 ↔ ActiNet 源码）

### 1. System 消息处理

**CPA 源码** (`openai_claude_request.go:103-129`):
```go
// 遍历 system 数组，每个 text block 通过 convertClaudeContentPart() 转换
// convertClaudeContentPart() 对 text 类型:
//   - 过滤 billing header (IsClaudeCodeAttributionSystemText)
//   - 创建 {"type":"text","text":"..."}, 不复制 cache_control
// 结果: system content 始终为 content-block 数组, 无 cache_control
```

**ActiNet 当前** (`format-converter.ts:409-433`):
```typescript
// 1. 显式 strip 所有 cache_control ✅ (与 CPA 效果相同)
// 2. 按 isMultiTurn 条件重新添加 cache_control ❌ (CPA 不添加)
// 3. 不过滤 billing header ❌ (CPA 会过滤)
```

**需要修改**:
- 删除 cache_control 重新添加逻辑（lines 420-426）
- 添加 billing header 过滤（`text.startsWith('x-anthropic-billing-header:')` 的 block 跳过）
- 保持 content-block 数组格式（已正确 ✅）

### 2. Assistant 消息 content — 有文本时

**CPA 源码** (`openai_claude_request.go:226-232`):
```go
contentArrayJSON := []byte(`[]`)
for _, contentItem := range contentItems {
    contentArrayJSON, _ = sjson.SetRawBytes(contentArrayJSON, "-1", contentItem)
}
msgJSON, _ = sjson.SetRawBytes(msgJSON, "content", contentArrayJSON)
// → content: [{"type":"text","text":"hello"}]
// 始终是 content-block 数组
```

**ActiNet 当前** (`format-converter.ts:453-454`):
```typescript
openaiMsg.content = textBlocks.map((b) => b.text).join('\n')
// → content: "hello"  (字符串)
```

**需要修改**: content 应为 content-block 数组，非字符串。

### 3. Assistant 消息 content — 无文本时（仅有 tool_use）

**CPA 源码** (`openai_claude_request.go:233-236`):
```go
msgJSON, _ = sjson.SetBytes(msgJSON, "content", "")
// → content: ""
```

**ActiNet 当前** (`format-converter.ts:457,462`):
```typescript
openaiMsg.content = null
// → content: null
```

**需要修改**: 改为 `""`（空字符串）。

### 4. User 消息 content

**CPA 源码** (`openai_claude_request.go:253-263`):
```go
// 非 assistant 消息，有内容时:
contentArrayJSON := []byte(`[]`)
for _, contentItem := range contentItems {
    contentArrayJSON, _ = sjson.SetRawBytes(contentArrayJSON, "-1", contentItem)
}
msgJSON, _ = sjson.SetRawBytes(msgJSON, "content", contentArrayJSON)
// → content: [{"type":"text","text":"user message"}]
// 始终是 content-block 数组
```

**ActiNet 当前** (`format-converter.ts:496-499`):
```typescript
content: textBlocks.map((b) => b.text).join('\n')
// → content: "user message" (字符串)
```

**需要修改**: content 应为 content-block 数组。

### 5. 空 tools 字段

**CPA 源码** (`openai_claude_request.go:287-307`):
```go
if tools := root.Get("tools"); tools.Exists() && tools.IsArray() {
    // ... 只在 tools 非空时才添加
    if parsed := gjson.ParseBytes(toolsJSON); parsed.IsArray() && len(parsed.Array()) > 0 {
        out, _ = sjson.SetRawBytes(out, "tools", toolsJSON)
    }
}
```

**ActiNet 当前** (`format-converter.ts:600`):
```typescript
if (body.tools) {
    // 即使 tools 为空数组也会设置 openaiBody.tools
}
```

**需要修改**: 空 tools 时省略字段。

### 6. anthropicContentToOpenAI fallback 函数

**CPA 源码**: 没有等效的通用 fallback 函数。每个消息按 role 独立处理。

**ActiNet 当前** (`format-converter.ts:639-695`):
```typescript
// 纯文本时简化为字符串
if (imageParts.length === 0) {
    return textParts.join('\n')
}
```

**需要修改**: 不应简化为字符串，应保持 content-block 数组格式。

### 7. stream_options

**CPA 源码** (`openai_compat_executor.go:327`):
```go
translated, _ = sjson.SetBytes(translated, "stream_options.include_usage", true)
```

**ActiNet 当前** (`format-converter.ts:577-579`):
```typescript
if (body.stream) {
    openaiBody.stream_options = { include_usage: true }
}
```

✅ 已对齐，不需要修改。

### 8. metadata 转发

**CPA 源码**: 不转发 `metadata` 字段到上游。

**ActiNet 当前**: 不转发 metadata → 代码中未显式处理，但 `openaiBody` 构建过程不包含 metadata。

✅ 已对齐（但需确认不会被意外透传）。

---

## 精确修改计划

### 文件: `cloud-server/src/proxy/format-converter.ts`

#### 修改 A: System 处理 (lines 409-433)

**删除** cache_control strip/re-add 逻辑，**添加** billing header 过滤：

```typescript
// Before (lines 409-433):
if (system) {
    if (Array.isArray(system)) {
      const cleanBlocks = system
        .filter((s) => s.type === 'text')
        .map((s) => {
          const { cache_control, ...rest } = s as Record<string, unknown>
          return rest
        })

      if (cleanBlocks.length > 0) {
        const isMultiTurn = anthropicMessages.length > 1
        if (isMultiTurn) {
          for (let i = 1; i < Math.min(cleanBlocks.length, 3); i++) {
            cleanBlocks[i] = { ...cleanBlocks[i], cache_control: { type: 'ephemeral' } }
          }
        }
        openaiMessages.push({ role: 'system', content: cleanBlocks })
      }
    } else if (typeof system === 'string' && system.trim()) {
      openaiMessages.push({ role: 'system', content: system })
    }
  }

// After:
if (system) {
    if (Array.isArray(system)) {
      // CPA: convert each text block, skip billing header, no cache_control
      const blocks: Array<Record<string, unknown>> = []
      for (const s of system) {
        if (s.type !== 'text') continue
        const text = s.text as string ?? ''
        // Filter billing header (matches CPA IsClaudeCodeAttributionSystemText)
        if (text.trimStart().startsWith('x-anthropic-billing-header:')) continue
        if (text.trim() === '') continue
        blocks.push({ type: 'text', text })
      }
      if (blocks.length > 0) {
        openaiMessages.push({ role: 'system', content: blocks })
      }
    } else if (typeof system === 'string' && system.trim()) {
      // CPA: skip string system if it's a billing header
      if (!system.trimStart().startsWith('x-anthropic-billing-header:')) {
        openaiMessages.push({ role: 'system', content: system })
      }
    }
  }
```

#### 修改 B: Assistant 消息 content (lines 450-463)

```typescript
// Before:
if (textBlocks.length > 0) {
    openaiMsg.content = textBlocks.map((b) => b.text).join('\n')
} else if (toolUseBlocks.length > 0) {
    openaiMsg.content = null
} else {
    openaiMsg.content = null
}

// After:
if (textBlocks.length > 0) {
    // CPA: content is always array of text blocks
    openaiMsg.content = textBlocks.map((b) => ({ type: 'text', text: b.text }))
} else {
    // CPA: empty string when no text content
    openaiMsg.content = ''
}
```

#### 修改 C: User 消息 content (lines 494-499)

```typescript
// Before:
if (textBlocks.length > 0) {
    openaiMessages.push({
        role: 'user',
        content: textBlocks.map((b) => b.text).join('\n'),
    })
}

// After:
if (textBlocks.length > 0) {
    // CPA: content is always array of content blocks
    openaiMessages.push({
        role: 'user',
        content: textBlocks.map((b) => ({ type: 'text', text: b.text })),
    })
}
```

#### 修改 D: 空 tools 字段 (lines 599-631)

在 `if (body.tools)` 块末尾增加空数组检查：

```typescript
// 在现有 tools 转换逻辑的最后，确保空 tools 不输出:
if (body.tools) {
    const anthropicTools = body.tools as Array<Record<string, unknown>>
    if (anthropicTools.length === 0) {
        // CPA: omit empty tools — do nothing
    } else {
        openaiBody.tools = anthropicTools.map(...)
        // ... existing tool_choice logic ...
    }
}
```

或者更简洁：在现有代码外包裹 `if (anthropicTools.length > 0)`。

#### 修改 E: Fallback 路径 (lines 549-555, 639-695)

`anthropicContentToOpenAI()` 函数不再将纯文本简化为字符串：

```typescript
// Before (lines 681-683):
if (imageParts.length === 0) {
    return textParts.join('\n')
}

// After:
if (imageParts.length === 0) {
    // CPA: always return content-block array, never string
    return textParts.map(t => ({ type: 'text', text: t }))
}
```

同时 `anthropicContentToOpenAI` 的返回类型从 `string | Array<...>` 改为 `Array<...>`。

---

## 不变的部分（已对齐 CPA 源码）

以下 ActiNet 行为已经匹配 CPA 源码，无需修改：

| 项目 | 状态 |
|------|------|
| `stream_options.include_usage` | ✅ |
| `max_tokens` (保留，默认 4096) | ✅ |
| `temperature` / `top_p` | ✅ |
| `stop_sequences` → `stop` | ✅ |
| Anthropic tools → OpenAI tools | ✅ |
| `tool_choice` 映射 | ✅ |
| thinking → reasoning_effort | ✅ |
| redacted_thinking 忽略 | ✅ |
| unsigned thinking 丢弃 | ✅ |
| tool_result 块 → tool role messages | ✅ |
| 不转发 `anthropic-version`/`anthropic-beta`/`x-api-key` 头 | ✅ |

---

## 修改影响评估

1. **Content 格式变数组**: 大部分 OpenAI-compatible 上游（DeepSeek, OpenRouter, OpenAI 等）原生支持 content array，不受影响。
2. **cache_control 移除**: 对上游无影响，因为 OpenAI API 不使用 `cache_control`。之前的添加逻辑是多余的。
3. **Billing header 过滤**: 减少发送给上游的数据量，无负面影响。
4. **空 tools 省略**: OpenAI API 规范允许省略空 tools。
5. **Assistant `null` → `""`**: 部分上游可能对 `null` 敏感，`""` 更安全。

---

## 执行步骤

1. 修改 `format-converter.ts` 中的 5 处代码（修改 A-E）
2. 编译验证 TypeScript
3. 部署到测试容器
4. 重新运行 proxy-diff 测试套件
5. 确认 CPA vs ActiNet upstream 请求一致性
