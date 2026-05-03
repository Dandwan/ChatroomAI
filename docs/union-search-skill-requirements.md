# Union Search Skill Requirements

本文档定义 `union-search` 的强制工程要求。后续任何与 `union-search` 相关的设计、重构、集成或发布工作，都必须以本文件为准。

## 1. 目标

`union-search` 必须演进为一个 **Codex 原生、可独立分发、可直接运行、宿主无关** 的 skill，而不是继续维持为 ChatroomAI / ActiChat 私有宿主能力上的一层薄包装。

这里的最低标准不是“脚本能在另一个环境里勉强跑起来”，而是：

- 把同一份 skill 目录原样放进 Codex 的 skill 目录后，可以作为完整等价 skill 直接运行
- 不依赖 ChatroomAI / ActiChat 的宿主 special-case 才能获得核心能力
- 搜索与网页访问都由 skill 自身实现

## 2. 强制要求

### 2.1 正本必须是 Codex skill 包

- `union-search` 的唯一正本必须是一个符合 Codex skill 规范的 skill 目录
- ChatroomAI / ActiChat 内置版只能是这个正本的消费方、镜像或生成产物，不能继续反过来把宿主内置版当作事实正本
- 不允许长期维持“两套并行定义”：一套给 ChatroomAI / ActiChat，一套给 Codex

### 2.2 必须能在 Codex 中原样运行

“原样运行”至少包括以下能力：

- `scripts/union_search` 可直接运行
- `scripts/web_search` 可直接运行
- `scripts/visit_url` 可直接运行
- `visit_url` 默认可用
- `visit_url --extract browser` 可用，不依赖 ChatroomAI / ActiChat 宿主私有能力

如果某一能力只能在 ChatroomAI / ActiChat 中成立，而不能在 Codex skill 环境中成立，则该能力不能被视为 `union-search` 的基础能力。

### 2.3 核心业务逻辑必须留在 skill 内

以下能力必须属于 skill 本体，而不是宿主私有实现：

- 搜索 provider 聚合
- 单页访问
- 浏览器模式页面访问
- 正文提取
- Markdown 转换
- 结果整形
- 站点级降级与错误处理

宿主允许提供的内容仅限于通用执行能力，例如：

- 启动脚本
- 安装或发现运行时
- 注入普通环境变量
- 文件读写与 stdout/stderr 回收

宿主不得承载 `union-search` 专属的网页提取业务逻辑。

### 2.4 浏览器模式必须由 skill 自身提供

`visit_url` 的浏览器模式必须由 skill 本体自带的浏览器驱动实现，例如 Playwright 驱动的 Chromium。

明确禁止以下做法作为基础实现：

- 依赖 ChatroomAI / ActiChat 宿主隐藏 WebView
- 依赖宿主原生插件中的网页提取逻辑
- 依赖宿主资产中的专用提取脚本

如果未来宿主要提供浏览器能力，只能作为可选加速 backend，而不能成为 `union-search` 的默认唯一可靠路径。

### 2.5 必须只有一个正文提取核心

`union-search` 必须只有一个正文提取与 Markdown 转换核心。

当前已经确定的方向是：

- 搜索聚合与 skill 整体形态改自 `runningZ1/union-search-skill`
- 网页正文提取与 Markdown 转换能力改自 `kepano/defuddle`

因此：

- `defuddle` 必须作为统一提取核心
- 不允许长期维持“Node 一套提取逻辑，浏览器模式另一套提取逻辑”
- Node 直连模式与浏览器模式都必须收敛到同一提取核心

### 2.6 对外契约必须稳定

以下外部命令与输出语义必须保持稳定，除非有显式升级决策：

- `visit_url`
- `fetch_url`
- `union_search`
- `web_search`

`visit_url` 输出必须继续稳定提供或等价提供以下字段：

- `content`
- `metadata`
- `headings`
- `links`
- `images`
- `warnings`
- `truncated`

不允许因为替换提取核心，就把对外契约打散重做。

### 2.7 配置不能绑定某一个宿主

`union-search` 不能要求某个特定宿主必须注入 `SKILL_CONFIG_JSON` 才能运行。

允许支持宿主注入配置，但必须同时支持独立 skill 场景下的配置来源，例如：

- CLI 参数
- skill 目录内配置文件
- 通用环境变量
- 内置默认值

### 2.8 必须符合 Codex skill 规范

`union-search` 的正本 skill 必须满足 Codex skill 要求：

- skill 目录必须包含 `SKILL.md`
- `SKILL.md` frontmatter 只保留：
  - `name`
  - `description`
- 需要补充 `agents/openai.yaml`
- 可按需包含 `scripts/`、`references/`、`assets/`
- skill 必须能通过 Codex skill 校验流程

不允许把 ChatroomAI / ActiChat 私有 frontmatter 结构继续当作未来标准。

## 3. 明确禁止的实现方式

以下做法后续一律视为不合规：

- 把 ChatroomAI / ActiChat 宿主 special-case 当成 `union-search` 的基础能力
- 把原生插件私有 API 当成 `visit_url` 浏览器模式的必要条件
- 继续手工维护宿主私有 `browser-page-extractor.js` 作为唯一真相源
- 在 Node 路径和浏览器路径分别维护两套正文提取算法
- 让 ChatroomAI / ActiChat 内置版与 Codex 版长期分叉
- 让 `union-search` 的正常运行依赖某个 app 内部路径、私有目录结构或私有 bridge

## 4. 允许的宿主增强

以下宿主增强是允许的，但只能是可选增强，不能改变 skill 的独立性要求：

- 为 skill 自动安装运行时
- 为 skill 预置配置文件
- 为 skill 提供本地缓存目录
- 为 skill 提供更快的系统浏览器二进制或系统 Node
- 在不改变对外契约的前提下，把 skill 打包进 App 内

这些增强不能改变一个前提：**把 skill 目录单独拿出来，仍然必须可以在 Codex 中作为完整等价 skill 直接运行。**

## 5. 迁移方案

### 阶段 1：确立正本与规则

- 建立 Codex 原生 `union-search` 正本 skill 目录
- 收敛 `SKILL.md` 到 Codex skill 规范
- 写清楚来源说明与约束边界

### 阶段 2：迁移网页访问能力

- 把浏览器模式从宿主私有 WebView 路径迁出
- 在 skill 内实现浏览器驱动
- 把 `defuddle` 裁剪并适配为统一提取核心

### 阶段 3：统一 Node 与浏览器模式

- 让 Node 直连模式与浏览器模式共用同一提取核心
- 保留现有输出契约
- 把站点级降级规则放在 skill 适配层，而不是宿主层

### 阶段 4：让 ChatroomAI / ActiChat 改为消费方

- ChatroomAI / ActiChat 改为消费 Codex skill 正本或其生成产物
- 宿主不再继续承载 `union-search` 专属网页提取逻辑
- 原有宿主耦合实现逐步下线

## 6. 验收标准

只有同时满足以下条件，才可视为满足本文件要求：

- 把 `union-search` skill 目录原样放入 Codex skill 目录后可被正确触发
- `scripts/union_search` 可直接运行
- `scripts/visit_url --url "https://example.com"` 可直接运行
- `scripts/visit_url --url "https://example.com" --extract browser` 可直接运行
- 不依赖 ChatroomAI / ActiChat 私有宿主 API 才能完成上述能力
- skill 校验通过
- 输出契约与现有 `visit_url` 主要语义保持兼容
- 失败站点继续返回诚实、结构化的降级结果，而不是伪正文

## 7. 来源说明要求

后续 `union-search` 的 skill 文档与项目文档，必须使用更准确的来源表述：

- `union-search` 的搜索聚合与 skill 整体形态改自 `runningZ1/union-search-skill`
- `union-search` 的网页正文提取与 Markdown 转换能力改自 `kepano/defuddle`

不得再用含糊说法把两者混成“整个项目同时改自两个项目”。
