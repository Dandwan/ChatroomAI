# `src/components/ThinkingPhrase.tsx`

## 功能
助手消息加载等待期间的趣味短语指示器。根据 `createdAt` 时间戳计算已过秒数，在不同时间区间显示不同的随机短语，文字颜色随时间从灰色→黄色→橙色渐变，替代旧的三点脉冲动画。

## 关系
### 提供
- `ThinkingPhrase` — React 组件（default export），接收 `{ createdAt: number }` props

### 调用 / 引用
- React `useState` / `useEffect` / `useMemo` / `useRef` hooks

### 被依赖
- `src/App.tsx` — 在 `isAssistantLoading` 条件成立时渲染

## 关键词
### 函数
- `ThinkingPhrase`
- `lerpHsl` — HSL 色彩空间线性插值
- `hslToCss` — HSL 对象转 CSS 字符串
- `pickNext` — 从池中随机选取与当前不同的短语
- `pickRandom` — 从池中随机选取短语

### 常量
- `SHORT_PHRASES` — 10–25 秒区间短语（3 条）
- `LONG_PHRASES` — 25 秒以上短语（9 条）
- `GRAY_HSL` / `YELLOW_HSL` / `ORANGE_HSL` — 颜色锚点
