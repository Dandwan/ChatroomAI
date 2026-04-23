---
name: union-search
description: "聚合网页搜索、平台站内搜索、图片搜索、URL 抽取和 RSS 检索。当问题需要最新信息、外部来源、跨平台交叉验证或站点限定搜索时使用。改自 https://github.com/runningZ1/union-search-skill。"
author: ChatroomAI
version: "0.2.0"
---

# Union Search

## Overview

这是一个由 skill 自身实现业务逻辑的联网搜索工具集。宿主应用只负责装载 skill、提供运行时、传递 argv/stdin/env，并执行脚本；搜索、聚合、解析、去重和错误处理都由 skill 内部完成。

本 skill 需要 Node 运行时。内置版只是把 skill 文件随应用分发，不代表搜索逻辑在宿主侧硬编码实现。

## When To Use

- 需要最新网页信息、搜索来源或站点限定搜索
- 需要同时查多个平台并保留每个平台的成功/失败状态
- 需要开发者社区、社交内容平台或中文网站搜索
- 需要图片搜索、RSS 关键词检索、URL 正文抽取

## Runtime Requirement

- 需要启用一个可用的 `node` 运行时
- 所有脚本都通过 skill 自己的 Node 代码执行
- 如果没有 Node 运行时，脚本会直接失败，不会回退到宿主内置搜索逻辑

## Scripts

### scripts/union_search.internal

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
scripts/union_search.internal --query "OpenAI agent runtime" --group preferred --preset medium --deduplicate
scripts/union_search.internal --query "AI Agent" --platforms github,reddit,zhihu --limit 5
```

### scripts/web_search.internal

用途：聚合网页搜索引擎，支持站点限定。

常用参数：

- `--query <string>`：必填
- `--site <domain>`：可选，例如 `github.com`
- `--providers <comma-separated>`：可选，例如 `baidu_direct,bing_cn_direct,duckduckgo_html,startpage_direct,brave_direct`
- `--limit <number>`：可选

### scripts/social_search.internal

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

### scripts/dev_search.internal

用途：开发者平台搜索。可单平台调用，也可不传 `--platform` 时聚合 `dev` 组。

常用平台：

- `github`
- `reddit`
- `zhihu`

### scripts/image_search.internal

用途：图片搜索。

常用参数：

- `--query <string>`：必填
- `--providers <comma-separated>`：可选，支持 `bing`、`baidu`、`google`、`i360`、`pixabay`、`unsplash`、`gelbooru`、`safebooru`、`danbooru`、`pexels`、`huaban`、`foodiesfeed`、`volcengine`
- `--limit <number>`：可选，默认 `10`
- `--list-platforms`：列出支持的图片 provider

### scripts/fetch_url.internal

用途：抓取单个 URL 的标题、描述和正文摘要。

常用参数：

- `--url <string>`：必填
- `--extract <string>`：可选，`jina` 或 `html`

### scripts/rss_search.internal

用途：RSS 源关键词检索。

常用参数：

- `--query <string>`：必填
- `--feeds <comma-separated>`：可选，覆盖默认 RSS 列表
- `--limit <number>`：可选

## Platform Notes

- `union_search.internal` 会显式返回每个平台的 `success / error / total / timing_ms / items`
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

默认输出 JSON，也支持 Markdown 与 Text。

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

## Config

通过 `SKILL_CONFIG_JSON` 读取配置。常见配置项：

- `defaultProviders`
- `defaultUnionPlatforms`
- `defaultImageProviders`
- `requestTimeoutMs`
- `rssFeeds`
- `apiKeys`

## Best Practice

- 需要跨平台验证时，优先 `union_search.internal`
- 需要站内结果时，优先 `--platforms` 或 `--site`
- 需要正文时，先搜索，再对候选链接调用 `fetch_url.internal`
- 需要可用性优先时，先用 `preferred` 或 `no_api_key`
