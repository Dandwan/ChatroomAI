---
name: union-search
description: "联网搜索与网页访问工具集。先搜索候选链接，再直连访问 URL 获取 Markdown 页面内容；不要把搜索摘要当成网页正文。"
author: ChatroomAI
version: "0.5.0"
capabilities:
  - id: search
    command: ./union_search
    purpose: 聚合网页与站内搜索，返回候选链接、来源和摘要；搜索结果只用于发现线索
  - id: visit_url
    command: ./visit_url
    purpose: 直连访问单个 URL，返回页面 Markdown、元数据、标题索引、链接索引和图片索引
workflow:
  - 搜索结果只用于发现候选链接
  - 需要网页内容时，必须继续访问候选 URL
  - 优先使用 visit_url；fetch_url 保留为兼容别名
constraints:
  - 页面访问不使用 jina
  - 支持公网 URL、localhost、局域网 IP 和内网域名
  - 仅支持 http 和 https
  - 在原生 app 中，`visit_url` 默认优先走浏览器模式（隐藏 WebView 执行页面 JS、共享 cookie），显式 `--extract html` 才强制走直连 HTML 抓取
---

# Union Search

## Overview

这是一个由 skill 自身实现业务逻辑的联网搜索工具集。宿主应用只负责装载 skill、提供运行时、传递 argv/stdin/env，并执行脚本；搜索、聚合、解析、去重和错误处理都由 skill 内部完成。

本 skill 需要 Node 运行时。内置版只是把 skill 文件随应用分发，不代表搜索逻辑在宿主侧硬编码实现。

默认情况下：

- 搜索页、图片页、RSS 等网络请求继续使用桌面 Chromium Windows 风格的请求头，并在单次脚本执行期间维护 cookie 与 redirect 会话
- 在原生 app 中，`visit_url` / `fetch_url` 默认优先走浏览器模式：宿主会创建隐藏 WebView，真正加载页面、执行 JS、共享 cookie，再把渲染后的 DOM 转成 Markdown
- 如果显式传入 `--extract html` 或 `--extract direct`，才会强制走直连 HTML 抓取

## When To Use

- 需要最新网页信息、搜索来源、站点限定搜索或网页正文
- 需要同时查多个平台并保留每个平台的成功/失败状态
- 需要开发者社区、社交内容平台或中文网站搜索
- 需要图片搜索、RSS 关键词检索或单个网页的 Markdown 内容

## Runtime Requirement

- 需要启用一个可用的 `node` 运行时
- 所有脚本都通过 skill 自己的 Node 代码执行
- 如果没有 Node 运行时，脚本会直接失败，不会回退到宿主内置搜索逻辑

## Scripts

### scripts/union_search

用途：多平台聚合搜索。优先使用这个入口。

常用参数：

- `--query <string>`：必填，搜索词
- `--group <string>`：可选，平台组：`dev`、`social`、`search`、`rss`、`no_api_key`、`preferred`、`all`
- `--platforms <comma-separated>`：可选，直接指定平台列表
- `--providers <comma-separated>`：可选，站点回退时使用的搜索引擎聚合器
- `--limit <number>`：每个平台结果数
- `--preset <small|medium|large|extra|max>`：结果档位
- `--deduplicate`：跨平台去重
- `--list-platforms`：列出可用平台和分组
- `--list-groups`：仅列出平台分组

示例：

```text
scripts/union_search --query "OpenAI agent runtime" --group preferred --preset medium --deduplicate
scripts/union_search --query "AI Agent" --platforms github,reddit,zhihu --limit 5
```

### scripts/web_search

用途：聚合网页搜索引擎，支持站点限定。

常用参数：

- `--query <string>`：必填
- `--site <domain>`：可选，例如 `github.com`
- `--providers <comma-separated>`：可选，例如 `baidu_direct,bing_cn_direct,duckduckgo_html,startpage_direct,brave_direct`
- `--limit <number>`：可选

### scripts/social_search

用途：社交平台搜索。可单平台调用，也可不传 `--platform` 时聚合 `social` 组。

常用平台：

- `xiaohongshu`
- `douyin`
- `bilibili`
- `youtube`
- `twitter`
- `weibo`
- `wechat`
- `toutiao`
- `xiaoyuzhoufm`

### scripts/dev_search

用途：开发者平台搜索。可单平台调用，也可不传 `--platform` 时聚合 `dev` 组。

常用平台：

- `github`
- `reddit`
- `zhihu`

### scripts/image_search

用途：图片搜索。

常用参数：

- `--query <string>`：必填
- `--providers <comma-separated>`：可选，支持 `bing`、`baidu`、`google`、`i360`、`pixabay`、`unsplash`、`gelbooru`、`safebooru`、`danbooru`、`pexels`、`huaban`、`foodiesfeed`、`volcengine`
- `--limit <number>`：可选，默认 `10`
- `--list-platforms`：列出支持的图片 provider

### scripts/visit_url

用途：访问单个 URL 并返回接近网页结构的 Markdown 内容。原生 app 中默认优先使用浏览器模式。

常用参数：

- `--url <string>`：必填
- `--extract <string>`：可选，支持 `browser`、`html`、`direct`
- `--max-content-chars <number>`：可选，正文最大字符数
- `--max-links <number>`：可选，链接索引最大条数
- `--max-images <number>`：可选，图片索引最大条数
- `--no-links`：可选，不输出链接索引
- `--no-images`：可选，不输出图片索引
- `--no-headings`：可选，不输出标题索引
- `--no-metadata`：可选，不输出页面元数据

示例：

```text
scripts/visit_url --url "https://example.com"
scripts/visit_url --url "http://localhost:3000/docs" --max-content-chars 32000 --max-links 80
```

### scripts/fetch_url

用途：`visit_url` 的兼容别名。推荐新调用统一改用 `visit_url`。

### scripts/rss_search

用途：RSS 源关键词检索。

常用参数：

- `--query <string>`：必填
- `--feeds <comma-separated>`：可选，覆盖默认 RSS 列表
- `--limit <number>`：可选

## Platform Notes

- `union_search` 会显式返回每个平台的 `success / error / total / timing_ms / items`
- 一部分平台有直接 API 适配；另一部分平台通过聚合搜索引擎做站点回退搜索
- `group=no_api_key` 优先走无需 API Key 的搜索来源
- `group=preferred` 是内置默认聚合策略，不会只依赖单一搜索源

## Common Output Options

所有脚本支持以下输出参数：

- `--format <json|markdown|text>`：输出格式（默认 `json`）
- `--markdown`：等价于 `--format markdown`
- `--json`：等价于 `--format json`
- `--pretty`：JSON 使用缩进格式（默认开启）
- `--compact`：JSON 使用紧凑格式
- `--output <path>` 或 `-o <path>`：把输出写入文件（同时仍会打印到 stdout）

## Output Format

默认输出 JSON，也支持 Markdown 与 Text。`visit_url` 在未显式指定格式时默认输出 Markdown。

常见字段：

- `items`: 结果数组
- `title`: 标题
- `url`: 链接
- `snippet`: 摘要
- `source`: 来源或 provider
- `platform`: 平台名（聚合搜索结果中常见）
- `publishedAt`: 时间字段（如果可用）
- `summary`: 聚合搜索摘要
- `results`: 各平台明细
- `content`: 网页正文 Markdown
- `metadata`: 网页元数据
- `headings`: 标题索引
- `links`: 链接索引
- `images`: 图片索引

## Config

通过 `SKILL_CONFIG_JSON` 读取配置。常见配置项：

- `defaultProviders`
- `defaultUnionPlatforms`
- `defaultImageProviders`
- `requestTimeoutMs`
- `rssFeeds`
- `fetchUrl.maxContentChars`
- `fetchUrl.maxLinks`
- `fetchUrl.maxImages`
- `fetchUrl.browserTimeoutMs`
- `fetchUrl.includeMetadata`
- `fetchUrl.includeHeadings`
- `fetchUrl.includeLinkIndex`
- `fetchUrl.includeImageIndex`
- `browserProfile.id`
- `browserProfile.userAgent`
- `browserProfile.acceptLanguage`
- `browserProfile.acceptEncoding`
- `browserProfile.secChUa`
- `browserProfile.secChUaMobile`
- `browserProfile.secChUaPlatform`
- `browserProfile.extraHeaders`
- `apiKeys`

## Best Practice

- 需要跨平台验证时，优先 `union_search`
- 需要站内结果时，优先 `--platforms` 或 `--site`
- 搜索只用于找候选链接，不要把搜索摘要当成网页正文
- 需要正文时，先搜索，再对候选链接调用 `visit_url`
- 在原生 app 中，`visit_url` 默认就是浏览器模式；只有需要排查页面原始响应时，才显式加 `--extract html`
- 如果目标站点对 bot 较敏感，优先保留默认桌面 Chromium 请求画像，不要再覆盖成移动端或极简请求头
- 需要可用性优先时，先用 `preferred` 或 `no_api_key`
