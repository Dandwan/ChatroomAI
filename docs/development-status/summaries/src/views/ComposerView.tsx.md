# `src/views/ComposerView.tsx`

## 功能
聊天输入区组件。从 App.tsx 提取（E3 阶段），合并了原来的 `renderComposerTools` + `renderComposerFooter` 两个渲染函数。包含模型选择器 popover、图片/拍照按钮、pending image strip（压缩率控制）、ChatInputBox、发送/停止/追加按钮、滚动到底部按钮。

## 关系
### 调用 / 引用
- `src/state/ui-store.ts` — useUIStore（modelMenuVisible, modelMenuMounted, isSending）
- `src/state/settings-store.ts` — useSettingsStore（settings.currentModel, settings.permissionToggles）
- `src/state/types.ts` — AppSettings, Conversation, ConversationResponseMode, EnabledModelOption 等类型
- `src/utils/app-formatting.ts` — buildHomepageModelTriggerLabel
- `src/utils/model-utils.ts` — createProviderModelKey
- `src/utils/app-images.ts` — buildPendingImageViewerKey
- `src/components/ChatInputBox.tsx` — 文本输入框

### 提供
- `ComposerView` — 聊天输入区主组件
- `ComposerViewProps` — 组件 props 类型
- `ComposerModelControls` — 模型选择器操作接口
- `ComposerActions` — 发送/交互操作接口
- `ComposerRefs` — 相关 refs 接口
- `EnabledModelsByProvider` — 按服务商分组的启用模型列表类型

### 被依赖
- `src/App.tsx` — 替代 renderComposerFooter() 调用

## 关键词
### 函数
- `ComposerView` — 主组件
- `renderComposerTools` — 内部渲染函数，模型选择器 + 图片/拍照按钮
