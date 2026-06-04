# 026 — 修复 ActiNet 登录后模型选择器不显示预设模型

**日期**：2026-06-05

## 范围

修复 bug：用户登录 ActiNet 后打开模型选择器，看不到预设的"快速""专家"等默认模型，显示"暂无模型"。

## 根因

`getEnabledModelOptions` 函数通过检查 `settings.actiNetModels.length > 0` 来推断登录状态，但该字段默认为空数组 `[]`。登录后该字段不变，条件永远为 false，ActiNet 模型永远不会被纳入 `enabledModelOptions`。模型选择器 UI 以 `enabledModelOptions.length === 0` 作为空状态判断条件，短路了 `enabledModelsByProvider`（后者本来能正确获取默认模型）的渲染。

另外，`enabledModelsByProvider` 的 useMemo 内部调用 `isCloudLoggedIn()` 但依赖数组不含登录状态，登录后可能返回旧缓存值。

## 变更的代码区域

### 修改：`src/App.tsx`

1. **`getEnabledModelOptions` 函数签名和逻辑（第 1047 行）**
   - 签名：移除 `actiNetModels` 参数（该参数仅用于推断登录状态），新增 `isActiNetLoggedIn: boolean` 参数
   - 逻辑：`if (actiNetModels && actiNetModels.length > 0)` → `if (isActiNetLoggedIn)`
   - 条件块内始终使用 `getEffectiveActiNetModels()` 获取模型列表

2. **`enabledModelOptions` useMemo（第 2584 行）**
   - 调用：传入 `cloudLoggedIn` 替代 `settings.actiNetModels`
   - 依赖：`[settings.providers, settings.actiNetModels]` → `[settings.providers, cloudLoggedIn]`

3. **`enabledModelsByProvider` useMemo（第 2613 行）**
   - 依赖：`[settings.providers, settings.actiNetModels]` → `[settings.providers, settings.actiNetModels, cloudLoggedIn]`

4. **`ensureValidCurrentModelSelection` 内部调用（第 1094 行）**
   - 适配新签名：`getEnabledModelOptions(settings.providers, isCloudLoggedIn())`

## 验证

- `npx tsc --noEmit` — 零错误
- `npm run lint` — 4 errors / 50 warnings，全部为已有问题，无新增
- `npm run build` — 构建成功（748.56 KB JS）

## 决策关卡

- 方案已提出：是（完整工程方案含根因分析、替代方案对比）
- 用户确认已收到：是

## 设计决策

1. **显式传入登录状态**：不入 `isCloudLoggedIn()` 在 `getEnabledModelOptions` 内部隐式调用，保持函数纯净，调用方已有 `cloudLoggedIn` 变量可直接传入
2. **移除 `actiNetModels` 参数**：该参数原本仅用于 `length > 0` 判断，实际模型列表始终来自 `getEffectiveActiNetModels()`（读取独立 localStorage key），参数冗余且误导
3. **`enabledModelsByProvider` 保留 `settings.actiNetModels` 依赖**：虽然 useMemo 内部通过 `getEffectiveActiNetModels()` 读取模型，但 `settings.actiNetModels` 的变化（用户通过 ActiNetSettings 保存）与 localStorage 写入同步发生，作为重计算信号仍有价值

## 已知限制

- 无

## 下一步

- 在 Android 设备上验证：清除数据 → 登录 → 模型选择器应显示 ActiNet 分组及"快速""专家"
- 已登录状态下刷新页面 → 模型选择器应直接显示 ActiNet 模型
