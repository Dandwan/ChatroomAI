# ChatroomAI

移动端优先的 AI 聊天应用，基于 **React + Vite + Capacitor(Android)**，兼容 GPT 格式 API，支持多会话、图片输入、LaTeX 渲染、思考过程展示与完整对话编辑能力。

## 本次更新总结

1. **多会话重构完成**：新增左侧会话抽屉、会话自动命名与手动改名，顶部标题居中展示当前会话。
2. **输入区能力增强**：模型选择下沉到底部，新增图库上传 + 相机拍照按钮，支持同区域上弹模型菜单。
3. **聊天交互完善**：支持复制、编辑、重新生成、按轮次修改（仅修改 / 修改并重发），并优化消息操作区与统计区密度。
4. **渲染与数据能力增强**：补强 Markdown + LaTeX 兼容渲染，支持思考过程显示在正文上方，统计首 token 延迟、总耗时与 token 消耗。
5. **稳定性与动画修复**：修复图片发送导致界面异常问题（避免本地存储超限），补全抽屉/菜单/页面切换/展开收起的开启动画与关闭动画。
6. **文案本地化**：关键统计与顶部信息改为中文全称，提升可读性。

## 核心功能

- GPT 兼容 API 配置：自定义 Base URL / API Key
- 模型管理：拉取模型列表、手动添加模型、逐个检测模型
- 参数设置：System Prompt（可空）、Temperature、Top P、Max Tokens、Presence/Frequency Penalty
- 多轮对话与多会话管理
- 消息复制、编辑、重新生成、上下文截断重发
- 图片输入：相册选择 + 相机拍照
- Markdown + LaTeX（KaTeX）渲染
- 思考过程折叠展示
- 指标统计：token 消耗、首 token 延迟、总耗时

## 本地开发

```bash
npm install
npm run dev
```

## 代码质量与构建

```bash
npm run lint
npm run build
```

## API 深度联调

先设置环境变量（示例）：

```bash
set API_BASE_URL=https://your-openai-compatible-endpoint/v1
set API_KEY=your-api-key
npm run test:api
```

可选指定模型：

```bash
set TEST_MODEL=your-model-id
npm run test:api
```

## Android 打包与安装

首次接入 Android：

```bash
npm run android:add
```

构建 Release APK（非 Debug）：

```bash
npm run android:build
```

APK 路径：

- `android\app\build\outputs\apk\release\app-release-unsigned.apk`

安装到设备：

```bash
adb install -r android\app\build\outputs\apk\release\app-release-unsigned.apk
```
