<h1 align="center">ChatroomAI</h1>

<p align="center">
  为手机场景重新整理过的 AI 聊天应用。<br />
  支持 GPT 兼容 API、多会话、图片输入、公式渲染、思考过程查看，以及完整的对话编辑能力。
</p>

<p align="center">
  <a href="https://github.com/Dandwan/ChatroomAI/releases/latest">下载最新 Release</a>
  ·
  <a href="#功能亮点">功能亮点</a>
  ·
  <a href="#界面预览">界面预览</a>
  ·
  <a href="#开发者入口">开发者入口</a>
</p>

## 本次更新

- 多会话体验完成重构，支持侧边抽屉切换、新建会话、自动命名和手动改名。
- 输入区更顺手，模型选择下沉到底部，同时补上相册上传和相机拍照入口。
- 对话操作更完整，支持复制、编辑、重新生成，以及按轮次修改后续上下文。
- Markdown 和 LaTeX 渲染进一步补强，思考过程、Token 消耗、首 Token 延迟和总耗时都能直接看到。
- 动画与移动端细节更完整，补全标题编辑过渡、抽屉开合、菜单切换和触感反馈。

## 功能亮点

<table>
  <tr>
    <td width="50%" valign="top">
      <strong>多会话更顺手</strong><br />
      历史对话集中在侧边抽屉里，切换、新建、重命名都更直接，适合长期使用。
    </td>
    <td width="50%" valign="top">
      <strong>聊天过程可控</strong><br />
      支持复制、编辑、重新生成，还能只改某一轮，或者带着后续上下文一起重发。
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <strong>学习和长文阅读更舒服</strong><br />
      Markdown、表格和 LaTeX 公式都能正常显示，适合看推导、笔记和复杂回答。
    </td>
    <td width="50%" valign="top">
      <strong>配置自由但不难用</strong><br />
      自定义 API Base URL / API Key、拉取模型列表、手动加模型、调节常用参数，一页完成。
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <strong>支持图片输入</strong><br />
      既可以从相册选图，也可以直接拍照，把图文对话放进同一条发送链路里。
    </td>
    <td width="50%" valign="top">
      <strong>过程数据看得见</strong><br />
      支持思考过程折叠展示，并统计 Token、首 Token 延迟和总耗时，方便判断模型表现。
    </td>
  </tr>
</table>

## 界面预览

<table>
  <tr>
    <td align="center" width="25%">
      <img src="./README.assets/01-home.jpg" alt="ChatroomAI 主页面截图" width="220" />
      <br />
      <strong>1. 主页面</strong>
    </td>
    <td align="center" width="25%">
      <img src="./README.assets/02-math.jpg" alt="ChatroomAI 公式渲染截图" width="220" />
      <br />
      <strong>2. 公式渲染</strong>
    </td>
  </tr>
  <tr>
    <td align="center" width="25%">
      <img src="./README.assets/03-history.jpg" alt="ChatroomAI 历史对话截图" width="220" />
      <br />
      <strong>3. 历史对话选择</strong>
    </td>
    <td align="center" width="25%">
      <img src="./README.assets/04-settings.jpg" alt="ChatroomAI 设置页面截图" width="220" />
      <br />
      <strong>4. 设置页面</strong>
    </td>
  </tr>
</table>

## 技术栈

- React 19
- Vite
- Capacitor 8 + Android
- Markdown / KaTeX
- GPT 兼容 API 接入

## 开发者入口

```bash
npm install
npm run dev
```

质量检查与 Web 构建：

```bash
npm run lint
npm run build
```

构建 Android Release：

```bash
npm run android:build
```

构建产物位于 `android/app/build/outputs/apk/release/`。
如果本地已配置签名 keystore，生成的是已签名 release APK；仓库不会提交任何真实 API 信息或本地签名文件。
