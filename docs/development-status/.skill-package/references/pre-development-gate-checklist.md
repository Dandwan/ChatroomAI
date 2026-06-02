# Pre-Development Gate Checklist

Before implementation starts, present a **thorough, well-reasoned engineering plan** that covers all of the following sections. The plan must be detailed enough that another engineer could implement it without guessing.

## Required Sections

### 1. Proposed Approach (方案设计)

Must be detailed and concrete:

- **Overview**: High-level summary of the approach (2-3 sentences).
- **Files to create / modify / delete**: List every file with its role in the change. For each file, describe what changes and why.
- **Component / module interaction**: How the changed pieces communicate — call graphs, data flow, event flow. Use text diagrams if helpful.
- **API / data contract changes**: Any new or modified interfaces, function signatures, types, schemas, or serialization formats. Include before/after signatures for breaking changes.
- **Error handling strategy**: How errors and edge cases are handled at each layer. What fails loudly vs. silently.
- **Testing approach**: What tests will be added or updated. Which edge cases are covered.
- **Why this approach**: Explicitly compare against at least one alternative and explain why this approach is better (maintainability, simplicity, performance, consistency with existing patterns).

### 2. Constraints & Tradeoffs (约束与权衡)

Must be exhaustive and explicit:

- **What WILL be modified**: Specific files, functions, modules, configs, or data. Be as precise as possible.
- **What will NOT be touched**: Explicitly list areas that are adjacent or related but out of scope. This prevents scope creep and accidental breakage.
- **Backward compatibility**: Whether existing callers, consumers, or persisted data are affected. If yes, how compatibility is preserved or migrated.
- **Known limitations**: What the approach deliberately does NOT handle. Scenarios it won't cover. Future work it defers.
- **Performance implications**: Any runtime, memory, or I/O cost changes. If negligible, say so explicitly.
- **Dependency changes**: New packages, version bumps, or removed dependencies.

### 3. Questions (疑问)

- List every unclear or ambiguous aspect of the request. Be specific — reference the exact part of the request that is unclear.
- For each question, state the implication: "If A, then approach X; if B, then approach Y."
- If there are genuinely no questions, write: **"没有疑问"** — and briefly explain why the request is fully unambiguous (e.g. "需求明确，所有边界条件已在需求中覆盖").

## Minimal Template

```md
## 1. Proposed Approach (方案设计)

### Overview
...

### Files Changed
| File | Action | Description |
|------|--------|-------------|
| `path/to/file.ts` | Modify | ... |
| `path/to/new.ts` | Create | ... |

### Component Interaction
...

### API / Data Contract Changes
...

### Error Handling
...

### Testing Approach
...

### Why This Approach
...

## 2. Constraints & Tradeoffs (约束与权衡)

### Modified Scope
- Will modify: ...
- Will NOT touch: ...

### Backward Compatibility
...

### Known Limitations
...

### Performance
...

### Dependencies
...

## 3. Questions (疑问)
- ...
<!-- OR: 没有疑问 — <brief reason> -->
```

After presenting the plan, **wait for explicit user confirmation** before starting implementation. Do not proceed without it.
