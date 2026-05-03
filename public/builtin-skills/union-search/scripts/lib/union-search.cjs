const fs = require('node:fs')
const path = require('node:path')
const { URL, URLSearchParams } = require('node:url')
const { createRequestClient } = require('./request-client.cjs')
const { fetchRenderedHtmlWithBrowser } = require('./browser-fetch.cjs')
const { extractPageContentWithDefuddle } = require('./defuddle-extract.cjs')

const DEFAULT_TIMEOUT_MS = 15000
const MAX_RESULTS = 20
const OUTPUT_FORMATS = new Set(['json', 'markdown', 'text'])
const MARKDOWN_PREVIEW_LIMIT = 12
const SUPPORTED_REQUEST_PROTOCOLS = new Set(['http:', 'https:'])
const DISABLED_SEARCH_PROVIDERS = new Set(['jina'])
const DEFAULT_WEB_PROVIDERS = [
  'baidu_direct',
  'bing_cn_direct',
  'duckduckgo_html',
  'startpage_direct',
  'brave_direct',
]
const DEFAULT_IMAGE_PROVIDERS = ['bing_images', 'baidu_images', 'so360_images']

const SITE_MAP = {
  annasarchive: 'annas-archive.org',
  bilibili: 'bilibili.com',
  douyin: 'douyin.com',
  github: 'github.com',
  jisilu: 'jisilu.cn',
  reddit: 'reddit.com',
  toutiao: 'toutiao.com',
  twitter: 'x.com',
  wechat: 'mp.weixin.qq.com',
  weibo: 'weibo.com',
  xiaohongshu: 'xiaohongshu.com',
  xiaoyuzhoufm: 'xiaoyuzhou.fm',
  youtube: 'youtube.com',
  zhihu: 'zhihu.com',
}

const PLATFORM_GROUPS = {
  dev: ['github', 'reddit', 'zhihu'],
  social: ['xiaohongshu', 'douyin', 'bilibili', 'youtube', 'twitter', 'weibo', 'wechat', 'toutiao', 'xiaoyuzhoufm'],
  search: ['google', 'tavily', 'duckduckgo', 'brave', 'yahoo', 'yandex', 'bing', 'wikipedia', 'metaso', 'volcengine', 'baidu', 'exa', 'serper'],
  rss: ['rss'],
  no_api_key: [
    'baidu_direct',
    'bing_cn_direct',
    'bing_int_direct',
    'so360_direct',
    'sogou_direct',
    'toutiao_direct',
    'jisilu_direct',
    'google_direct',
    'google_hk_direct',
    'duckduckgo_html',
    'startpage_direct',
    'brave_direct',
    'yahoo_direct',
    'ecosia_direct',
    'qwant_direct',
    'wolfram_direct',
    'mojeek',
    'duckduckgo_instant',
  ],
  preferred: ['baidu_direct', 'bing_cn_direct', 'duckduckgo_html', 'startpage_direct', 'brave_direct', 'github', 'reddit', 'zhihu'],
}

PLATFORM_GROUPS.all = Array.from(new Set(Object.values(PLATFORM_GROUPS).flatMap((items) => items)))

const PLATFORM_LABELS = {
  annasarchive: 'Anna\'s Archive',
  baidu: 'Baidu API',
  baidu_direct: 'Baidu',
  bilibili: 'Bilibili',
  bing: 'Bing API',
  bing_cn_direct: 'Bing China',
  bing_int_direct: 'Bing',
  brave: 'Brave API',
  brave_direct: 'Brave',
  dev: 'Developer Group',
  douyin: 'Douyin',
  duckduckgo: 'DuckDuckGo',
  duckduckgo_html: 'DuckDuckGo HTML',
  duckduckgo_instant: 'DuckDuckGo Instant Answer',
  ecosia_direct: 'Ecosia',
  exa: 'Exa',
  github: 'GitHub',
  google: 'Google API',
  google_direct: 'Google',
  google_hk_direct: 'Google Hong Kong',
  jina: 'Jina Search',
  jisilu_direct: 'Jisilu',
  metaso: 'Metaso',
  mojeek: 'Mojeek',
  qwant_direct: 'Qwant',
  reddit: 'Reddit',
  rss: 'RSS',
  search: 'Search Group',
  serper: 'Serper',
  social: 'Social Group',
  so360_direct: '360 Search',
  sogou_direct: 'Sogou',
  startpage_direct: 'Startpage',
  tavily: 'Tavily',
  toutiao: 'Toutiao',
  toutiao_direct: 'Toutiao',
  twitter: 'Twitter / X',
  volcengine: 'Volcengine',
  wechat: 'WeChat Articles',
  weibo: 'Weibo',
  wikipedia: 'Wikipedia',
  wolfram_direct: 'Wolfram Alpha',
  xiaohongshu: 'Xiaohongshu',
  xiaoyuzhoufm: 'Xiaoyuzhou FM',
  yahoo: 'Yahoo API',
  yahoo_direct: 'Yahoo',
  yandex: 'Yandex',
  youtube: 'YouTube',
  zhihu: 'Zhihu',
}

const PLATFORM_ALIASES = {
  bing_cn: 'bing_cn_direct',
  bing_int: 'bing_int_direct',
  brave_no_api: 'brave_direct',
  ddg: 'duckduckgo_html',
  duckduckgo_no_api: 'duckduckgo_html',
  i360: 'so360_direct',
  so360: 'so360_direct',
  x: 'twitter',
}

const IMAGE_PROVIDER_ALIASES = {
  baidu: 'baidu_images',
  bing: 'bing_images',
  danbooru: 'danbooru_images',
  gelbooru: 'gelbooru_images',
  google: 'google_images',
  huaban: 'huaban_images',
  i360: 'so360_images',
  pexels: 'pexels_images',
  pixabay: 'pixabay_images',
  safebooru: 'safebooru_images',
  sogou: 'sogou_images',
  so360: 'so360_images',
  unsplash: 'unsplash_images',
  volcengine: 'volcengine_images',
  yahoo: 'yahoo_images',
  yandex: 'yandex_images',
}

const IMAGE_SITE_MAP = {
  foodiesfeed_images: 'foodiesfeed.com',
  huaban_images: 'huaban.com',
  pexels_images: 'pexels.com',
  pixabay_images: 'pixabay.com',
  unsplash_images: 'unsplash.com',
  yahoo_images: 'images.search.yahoo.com',
  yandex_images: 'yandex.com/images',
}

const IMAGE_PROVIDER_LABELS = {
  baidu_images: 'Baidu Images',
  bing_images: 'Bing Images',
  danbooru_images: 'Danbooru',
  foodiesfeed_images: 'Foodiesfeed',
  gelbooru_images: 'Gelbooru',
  google_images: 'Google Images',
  huaban_images: 'Huaban',
  pexels_images: 'Pexels',
  pixabay_images: 'Pixabay',
  safebooru_images: 'Safebooru',
  sogou_images: 'Sogou Images',
  so360_images: '360 Images',
  unsplash_images: 'Unsplash',
  volcengine_images: 'Volcengine Images',
  yahoo_images: 'Yahoo Images',
  yandex_images: 'Yandex Images',
}

const ENTITY_MAP = {
  amp: '&',
  apos: '\'',
  gt: '>',
  lt: '<',
  nbsp: ' ',
  quot: '"',
}

let activeRequestClient = createRequestClient({})

function readConfig() {
  try {
    return JSON.parse(process.env.SKILL_CONFIG_JSON || '{}')
  } catch {
    return {}
  }
}

function parseArgv(argv) {
  const values = {}
  const flags = new Set()
  const positionals = []

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index]
    if (!current.startsWith('--')) {
      positionals.push(current)
      continue
    }

    const key = current.slice(2)
    const next = argv[index + 1]
    if (!next || next.startsWith('--')) {
      flags.add(key)
      continue
    }

    values[key] = next
    index += 1
  }

  return { values, flags, positionals }
}

function parseOutputOptions(argv) {
  const passthrough = []
  let format = 'json'
  let formatExplicit = false
  let pretty = true
  let outputPath = ''

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index]

    if (current === '--format') {
      const next = argv[index + 1]
      if (!next || next.startsWith('-')) {
        throw new Error('--format requires a value: json, markdown, or text')
      }
      const normalized = normalizeWhitespace(next).toLowerCase()
      if (!OUTPUT_FORMATS.has(normalized)) {
        throw new Error(`Unsupported --format value: ${next}`)
      }
      format = normalized
      formatExplicit = true
      index += 1
      continue
    }

    if (current === '--markdown') {
      format = 'markdown'
      formatExplicit = true
      continue
    }
    if (current === '--json') {
      format = 'json'
      formatExplicit = true
      continue
    }
    if (current === '--text') {
      format = 'text'
      formatExplicit = true
      continue
    }
    if (current === '--pretty') {
      pretty = true
      continue
    }
    if (current === '--compact') {
      pretty = false
      continue
    }

    if (current === '--output' || current === '-o') {
      const next = argv[index + 1]
      if (!next || next.startsWith('-')) {
        throw new Error(`${current} requires a file path`)
      }
      outputPath = next
      index += 1
      continue
    }

    passthrough.push(current)
  }

  return {
    argv: passthrough,
    format,
    formatExplicit,
    pretty,
    outputPath,
  }
}

function normalizeWhitespace(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
}

function truncateText(value, maxLength) {
  const normalized = normalizeWhitespace(value)
  if (!normalized) {
    return ''
  }
  if (normalized.length <= maxLength) {
    return normalized
  }
  return `${normalized.slice(0, Math.max(1, maxLength - 1))}…`
}

function markdownEscapeInline(value) {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/\|/g, '\\|')
    .replace(/`/g, '\\`')
}

function getObjectString(input, keys) {
  if (!input || typeof input !== 'object') {
    return ''
  }
  for (const key of keys) {
    const raw = input[key]
    if (typeof raw === 'string' && normalizeWhitespace(raw)) {
      return normalizeWhitespace(raw)
    }
  }
  return ''
}

function getObjectCount(input, key) {
  if (!input || typeof input !== 'object') {
    return 0
  }
  const value = Number.parseInt(String(input[key] ?? ''), 10)
  return Number.isFinite(value) ? value : 0
}

function formatMarkdownItem(item, index) {
  const title =
    getObjectString(item, ['title', 'name']) ||
    getObjectString(item, ['url', 'link', 'imageUrl', 'thumbnailUrl']) ||
    `结果 ${index}`
  const url = getObjectString(item, ['url', 'link', 'imageUrl', 'thumbnailUrl', 'permalink'])
  const source = getObjectString(item, ['platform', 'source', 'provider', 'engine'])
  const snippet = truncateText(getObjectString(item, ['snippet', 'description', 'content', 'summary']), 180)
  const publishedAt = getObjectString(item, ['publishedAt', 'published', 'time'])

  const lines = [
    url
      ? `${index}. [${markdownEscapeInline(truncateText(title, 100))}](${url})`
      : `${index}. ${markdownEscapeInline(truncateText(title, 100))}`,
  ]
  if (source) {
    lines.push(`   - 来源: ${markdownEscapeInline(source)}`)
  }
  if (snippet) {
    lines.push(`   - 摘要: ${markdownEscapeInline(snippet)}`)
  }
  if (publishedAt) {
    lines.push(`   - 时间: ${markdownEscapeInline(publishedAt)}`)
  }
  return lines
}

function renderFetchUrlMarkdown(payload) {
  const title = getObjectString(payload, ['title']) || 'URL 抽取结果'
  const url = getObjectString(payload, ['url'])
  const finalUrl = getObjectString(payload, ['finalUrl'])
  const description = getObjectString(payload, ['description'])
  const engine = getObjectString(payload, ['engine'])
  const content = String(payload && typeof payload === 'object' ? payload.content || '' : '').trim()
  const truncated = Boolean(payload && typeof payload === 'object' ? payload.truncated : false)
  const metadata = payload && typeof payload === 'object' && payload.metadata && typeof payload.metadata === 'object'
    ? payload.metadata
    : null
  const headings = Array.isArray(payload && payload.headings) ? payload.headings : []
  const links = Array.isArray(payload && payload.links) ? payload.links : []
  const images = Array.isArray(payload && payload.images) ? payload.images : []
  const warnings = Array.isArray(payload && payload.warnings) ? payload.warnings : []
  const lines = [`# ${markdownEscapeInline(title)}`, '']

  if (url) {
    lines.push(`- **URL**: ${url}`)
  }
  if (finalUrl && finalUrl !== url) {
    lines.push(`- **最终 URL**: ${finalUrl}`)
  }
  if (engine) {
    lines.push(`- **引擎**: ${markdownEscapeInline(engine)}`)
  }
  if (metadata) {
    const contentType = getObjectString(metadata, ['contentType'])
    const lang = getObjectString(metadata, ['lang'])
    const canonicalUrl = getObjectString(metadata, ['canonicalUrl'])
    const siteName = getObjectString(metadata, ['siteName'])
    const author = getObjectString(metadata, ['author'])
    const publishedAt = getObjectString(metadata, ['publishedAt'])
    const modifiedAt = getObjectString(metadata, ['modifiedAt'])
    const keywords = getObjectString(metadata, ['keywords'])
    const status = getObjectCount(metadata, 'status')
    if (status > 0) {
      lines.push(`- **状态码**: ${status}`)
    }
    if (contentType) {
      lines.push(`- **内容类型**: ${markdownEscapeInline(contentType)}`)
    }
    if (lang) {
      lines.push(`- **语言**: ${markdownEscapeInline(lang)}`)
    }
    if (siteName) {
      lines.push(`- **站点**: ${markdownEscapeInline(siteName)}`)
    }
    if (author) {
      lines.push(`- **作者**: ${markdownEscapeInline(author)}`)
    }
    if (publishedAt) {
      lines.push(`- **发布时间**: ${markdownEscapeInline(publishedAt)}`)
    }
    if (modifiedAt) {
      lines.push(`- **修改时间**: ${markdownEscapeInline(modifiedAt)}`)
    }
    if (canonicalUrl) {
      lines.push(`- **Canonical**: ${canonicalUrl}`)
    }
    if (keywords) {
      lines.push(`- **关键词**: ${markdownEscapeInline(keywords)}`)
    }
  }
  if (description) {
    lines.push(`- **描述**: ${markdownEscapeInline(description)}`)
  }
  if (content) {
    lines.push('', '## 正文', '', content)
  }
  if (truncated) {
    lines.push('', '> 页面内容已按长度限制截断。')
  }
  if (warnings.length > 0) {
    lines.push('', '## 提示')
    for (const warning of warnings) {
      lines.push(`- ${markdownEscapeInline(String(warning || ''))}`)
    }
  }
  if (headings.length > 0) {
    lines.push('', '## 标题索引')
    for (const heading of headings) {
      const level = getObjectCount(heading, 'level')
      const text = getObjectString(heading, ['text']) || '-'
      lines.push(`- H${Math.max(1, Math.min(level || 1, 6))}: ${markdownEscapeInline(text)}`)
    }
  }
  if (links.length > 0) {
    lines.push('', '## 链接索引')
    for (let index = 0; index < links.length; index += 1) {
      const link = links[index]
      const href = getObjectString(link, ['url'])
      const text = getObjectString(link, ['text']) || href || `link-${index + 1}`
      lines.push(
        href
          ? `${index + 1}. [${markdownEscapeInline(text)}](${href})`
          : `${index + 1}. ${markdownEscapeInline(text)}`,
      )
    }
  }
  if (images.length > 0) {
    lines.push('', '## 图片索引')
    for (let index = 0; index < images.length; index += 1) {
      const image = images[index]
      const href = getObjectString(image, ['url'])
      const alt = getObjectString(image, ['alt']) || `image-${index + 1}`
      lines.push(
        href
          ? `${index + 1}. ![${markdownEscapeInline(alt)}](${href})`
          : `${index + 1}. ${markdownEscapeInline(alt)}`,
      )
    }
  }
  return lines.join('\n')
}

function renderUnionSearchMarkdown(payload) {
  const query = getObjectString(payload, ['query'])
  const platforms = Array.isArray(payload && payload.platforms) ? payload.platforms : []
  const summary = payload && typeof payload === 'object' ? payload.summary : null
  const results = payload && typeof payload === 'object' ? payload.results : null
  const groups = payload && typeof payload === 'object' ? payload.groups : null
  const items = Array.isArray(payload && payload.items) ? payload.items : []

  const hasPlatformMetadata =
    platforms.length > 0 && platforms.some((item) => item && typeof item === 'object')
  const hasSearchPayload = Boolean(query || summary || results || items.length > 0)
  if (!hasSearchPayload && (hasPlatformMetadata || (groups && typeof groups === 'object'))) {
    const lines = ['# Union Search 平台信息', '']
    if (platforms.length > 0) {
      lines.push('## 平台')
      for (const platform of platforms) {
        if (platform && typeof platform === 'object') {
          const id = getObjectString(platform, ['id']) || '-'
          const label = getObjectString(platform, ['label']) || id
          const site = getObjectString(platform, ['site'])
          lines.push(
            site
              ? `- **${markdownEscapeInline(id)}**: ${markdownEscapeInline(label)} (${markdownEscapeInline(site)})`
              : `- **${markdownEscapeInline(id)}**: ${markdownEscapeInline(label)}`,
          )
          continue
        }
        lines.push(`- ${markdownEscapeInline(String(platform || ''))}`)
      }
    }
    if (groups && typeof groups === 'object') {
      lines.push('', '## 分组')
      for (const [groupName, groupPlatforms] of Object.entries(groups)) {
        const values = Array.isArray(groupPlatforms)
          ? groupPlatforms.map((item) => markdownEscapeInline(String(item || ''))).join(', ')
          : '-'
        lines.push(`- **${markdownEscapeInline(groupName)}**: ${values}`)
      }
    }
    return lines.join('\n')
  }

  const platformNames = platforms
    .map((platform) => {
      if (typeof platform === 'string') {
        return normalizeWhitespace(platform)
      }
      if (platform && typeof platform === 'object') {
        return getObjectString(platform, ['id', 'label'])
      }
      return ''
    })
    .filter(Boolean)

  const lines = ['# Union Search 结果', '']

  if (query) {
    lines.push(`- **查询**: ${markdownEscapeInline(query)}`)
  }
  if (platformNames.length > 0) {
    lines.push(`- **平台**: ${platformNames.map((item) => markdownEscapeInline(item)).join(', ')}`)
  }
  if (summary && typeof summary === 'object') {
    lines.push(`- **成功/失败**: ${getObjectCount(summary, 'successful')} / ${getObjectCount(summary, 'failed')}`)
    lines.push(`- **结果数**: ${getObjectCount(summary, 'total_items')}`)
    if (Object.prototype.hasOwnProperty.call(summary, 'deduplicated_items')) {
      lines.push(`- **去重后结果数**: ${getObjectCount(summary, 'deduplicated_items')}`)
    }
  }

  if (results && typeof results === 'object') {
    lines.push('', '## 平台状态')
    for (const [platform, detail] of Object.entries(results)) {
      const success = Boolean(detail && typeof detail === 'object' ? detail.success : false)
      const total = getObjectCount(detail, 'total')
      const timing = getObjectCount(detail, 'timing_ms')
      const mode = getObjectString(detail, ['mode']) || '-'
      const error = getObjectString(detail, ['error'])
      let line = `- **${markdownEscapeInline(platform)}**: ${success ? '✅' : '❌'} ${total} 条，${timing}ms，mode=${markdownEscapeInline(mode)}`
      if (error) {
        line += `，error=${markdownEscapeInline(truncateText(error, 140))}`
      }
      lines.push(line)
    }
  }

  if (items.length > 0) {
    lines.push('', '## 结果预览')
    const preview = items.slice(0, MARKDOWN_PREVIEW_LIMIT)
    for (let index = 0; index < preview.length; index += 1) {
      lines.push(...formatMarkdownItem(preview[index], index + 1))
    }
    if (items.length > preview.length) {
      lines.push(`- ... 还有 ${items.length - preview.length} 条结果`)
    }
  }

  return lines.join('\n')
}

function renderGenericMarkdown(scriptName, payload) {
  const heading = scriptName.replace(/\.internal$/i, '')
  const query = getObjectString(payload, ['query'])
  const items = Array.isArray(payload && payload.items) ? payload.items : []
  const providers = Array.isArray(payload && payload.providers) ? payload.providers : []
  const feeds = Array.isArray(payload && payload.feeds) ? payload.feeds : []
  const errors = Array.isArray(payload && payload.errors) ? payload.errors : []
  const lines = [`# ${markdownEscapeInline(heading)} 结果`, '']

  if (query) {
    lines.push(`- **查询**: ${markdownEscapeInline(query)}`)
  }
  if (providers.length > 0) {
    lines.push(`- **Providers**: ${providers.map((item) => markdownEscapeInline(item)).join(', ')}`)
  }
  if (feeds.length > 0) {
    lines.push(`- **RSS Feeds**: ${feeds.map((item) => markdownEscapeInline(item)).join(', ')}`)
  }
  lines.push(`- **结果数**: ${items.length}`)
  if (errors.length > 0) {
    lines.push(`- **错误数**: ${errors.length}`)
  }

  if (items.length > 0) {
    lines.push('', '## 结果预览')
    const preview = items.slice(0, MARKDOWN_PREVIEW_LIMIT)
    for (let index = 0; index < preview.length; index += 1) {
      lines.push(...formatMarkdownItem(preview[index], index + 1))
    }
    if (items.length > preview.length) {
      lines.push(`- ... 还有 ${items.length - preview.length} 条结果`)
    }
  }

  if (errors.length > 0) {
    lines.push('', '## 错误')
    for (const error of errors) {
      lines.push(`- ${markdownEscapeInline(truncateText(String(error || ''), 200))}`)
    }
  }

  return lines.join('\n')
}

function renderTextOutput(scriptName, payload) {
  const lines = [`script=${scriptName}`]
  const query = getObjectString(payload, ['query'])
  if (query) {
    lines.push(`query=${query}`)
  }
  const itemCount = Array.isArray(payload && payload.items) ? payload.items.length : 0
  lines.push(`items=${itemCount}`)
  const summary = payload && typeof payload === 'object' ? payload.summary : null
  if (summary && typeof summary === 'object') {
    lines.push(`platforms=${getObjectCount(summary, 'total_platforms')}`)
    lines.push(`successful=${getObjectCount(summary, 'successful')}`)
    lines.push(`failed=${getObjectCount(summary, 'failed')}`)
  }
  return lines.join('\n')
}

function renderOutput(scriptName, payload, format, pretty) {
  if (format === 'markdown') {
    if (scriptName === 'fetch_url.internal' || scriptName === 'visit_url.internal') {
      return renderFetchUrlMarkdown(payload)
    }
    if (scriptName === 'union_search.internal') {
      return renderUnionSearchMarkdown(payload)
    }
    return renderGenericMarkdown(scriptName, payload)
  }
  if (format === 'text') {
    return renderTextOutput(scriptName, payload)
  }
  return pretty ? JSON.stringify(payload, null, 2) : JSON.stringify(payload)
}

function writeOutputFile(outputPath, content) {
  if (!outputPath) {
    return
  }
  const target = path.isAbsolute(outputPath)
    ? outputPath
    : path.resolve(process.cwd(), outputPath)
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.writeFileSync(target, `${content}\n`, 'utf8')
}

function decodeHtmlEntities(value) {
  return String(value || '').replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, token) => {
    const lower = token.toLowerCase()
    if (lower.startsWith('#')) {
      const codePoint =
        lower[1] === 'x'
          ? Number.parseInt(lower.slice(2), 16)
          : Number.parseInt(lower.slice(1), 10)
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match
    }
    return ENTITY_MAP[lower] || match
  })
}

function stripTags(value) {
  return decodeHtmlEntities(String(value || '').replace(/<[^>]+>/g, ' '))
}

function normalizeText(value) {
  return normalizeWhitespace(stripTags(value))
}

function parseCommaList(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function uniqueStrings(items) {
  return Array.from(new Set(items.filter(Boolean)))
}

function clampLimit(value, fallback) {
  const parsed = Number.parseInt(String(value ?? fallback), 10)
  if (!Number.isFinite(parsed)) {
    return fallback
  }
  return Math.max(1, Math.min(MAX_RESULTS, parsed))
}

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value ?? fallback), 10)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback
  }
  return parsed
}

function getNested(source, path, fallback) {
  let current = source
  for (const segment of path) {
    if (!current || typeof current !== 'object' || !(segment in current)) {
      return fallback
    }
    current = current[segment]
  }
  return current === undefined ? fallback : current
}

function getApiKey(config, key) {
  const direct = getNested(config, ['apiKeys', key], '') || getNested(config, ['credentials', key], '')
  if (typeof direct === 'string' && direct.trim()) {
    return direct.trim()
  }
  const envKey = String(key || '')
    .replace(/[A-Z]/g, (char) => `_${char}`)
    .replace(/-/g, '_')
    .toUpperCase()
    .replace(/^_+/, '')
  return process.env[envKey] || ''
}

function normalizePlatformName(value) {
  const normalized = normalizeWhitespace(value).toLowerCase()
  return PLATFORM_ALIASES[normalized] || normalized
}

function normalizeProviderName(value) {
  const normalized = normalizeWhitespace(value).toLowerCase()
  return PLATFORM_ALIASES[normalized] || normalized
}

function normalizeImageProviderName(value) {
  const normalized = normalizeWhitespace(value).toLowerCase()
  return IMAGE_PROVIDER_ALIASES[normalized] || normalized
}

function assertSearchProviderEnabled(provider) {
  if (DISABLED_SEARCH_PROVIDERS.has(provider)) {
    throw new Error(`Provider disabled in this build: ${provider}`)
  }
}

function sanitizeUrl(value) {
  return normalizeWhitespace(decodeHtmlEntities(value || ''))
}

function looksLikeIpv4Host(hostname) {
  return /^(?:\d{1,3}\.){3}\d{1,3}$/.test(String(hostname || ''))
}

function isPrivateIpv4Host(hostname) {
  if (!looksLikeIpv4Host(hostname)) {
    return false
  }
  const segments = String(hostname || '')
    .split('.')
    .map((segment) => Number.parseInt(segment, 10))
  if (segments.some((segment) => !Number.isFinite(segment) || segment < 0 || segment > 255)) {
    return false
  }
  const [first, second] = segments
  return (
    first === 10 ||
    first === 127 ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168)
  )
}

function looksLikeIpv6Host(hostname) {
  const normalized = String(hostname || '').replace(/^\[|\]$/g, '')
  return normalized.includes(':') && /^[0-9a-f:]+$/i.test(normalized)
}

function looksLikeLocalHost(hostname) {
  const normalized = String(hostname || '').trim().toLowerCase()
  if (!normalized) {
    return false
  }
  if (normalized === 'localhost' || normalized === '::1' || normalized === '[::1]') {
    return true
  }
  if (normalized.endsWith('.local') || normalized.endsWith('.internal') || normalized.endsWith('.lan')) {
    return true
  }
  if (isPrivateIpv4Host(normalized) || looksLikeIpv6Host(normalized)) {
    return true
  }
  return !normalized.includes('.')
}

function inferUrlScheme(candidate) {
  const authority = String(candidate || '')
    .split(/[/?#]/, 1)[0]
    .replace(/^[^@]+@/, '')
  const hostname = authority.replace(/:\d+$/, '')
  return looksLikeLocalHost(hostname) ? 'http' : 'https'
}

function normalizeRequestedUrlInput(value) {
  const normalized = sanitizeUrl(value)
  if (!normalized) {
    return ''
  }
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(normalized)) {
    return normalized
  }
  if (normalized.startsWith('//')) {
    return `https:${normalized}`
  }
  return `${inferUrlScheme(normalized)}://${normalized}`
}

function assertSupportedRequestUrl(url, contextLabel) {
  const parsed = new URL(url)
  if (!SUPPORTED_REQUEST_PROTOCOLS.has(parsed.protocol)) {
    throw new Error(`${contextLabel} only supports http/https URLs`)
  }
}

function unwrapSearchRedirect(rawUrl, baseUrl) {
  if (!rawUrl) {
    return ''
  }
  try {
    const resolved = new URL(decodeHtmlEntities(rawUrl), baseUrl)
    const host = resolved.hostname.toLowerCase()
    const path = resolved.pathname
    if (
      host.includes('duckduckgo.com') ||
      host.includes('google.') ||
      host.includes('startpage.com') ||
      host.includes('search.yahoo.com')
    ) {
      for (const key of ['uddg', 'q', 'url']) {
        const candidate = resolved.searchParams.get(key)
        if (candidate && /^https?:/i.test(candidate)) {
          return candidate
        }
      }
    }
    return resolved.toString()
  } catch {
    return sanitizeUrl(rawUrl)
  }
}

function toAbsoluteUrl(rawUrl, baseUrl) {
  const unwrapped = unwrapSearchRedirect(rawUrl, baseUrl)
  if (!unwrapped) {
    return ''
  }
  try {
    return new URL(unwrapped, baseUrl).toString()
  } catch {
    return sanitizeUrl(unwrapped)
  }
}

function looksLikeWebUrl(value) {
  return /^https?:\/\//i.test(value || '')
}

function configureRequestClient(config) {
  activeRequestClient = createRequestClient(config)
}

function request(url, options) {
  return activeRequestClient.request(url, options)
}

async function requestText(url, options) {
  return activeRequestClient.requestText(url, options)
}

async function requestJson(url, options) {
  return activeRequestClient.requestJson(url, options)
}

async function postJson(url, body, options) {
  return activeRequestClient.postJson(url, body, options)
}

function makeItem(title, url, snippet, source, extra) {
  return {
    title: normalizeWhitespace(title),
    url: sanitizeUrl(url),
    snippet: normalizeWhitespace(snippet),
    source,
    ...(extra || {}),
  }
}

function dedupeItems(items) {
  const seen = new Set()
  const results = []
  for (const item of items) {
    const key = `${String(item.title || '').toLowerCase()}|${String(item.url || '').toLowerCase()}`
    if (!item || !item.title || !item.url || seen.has(key)) {
      continue
    }
    seen.add(key)
    results.push(item)
  }
  return results
}

function markPlatform(items, platform) {
  return items.map((item) => ({
    ...item,
    platform: item.platform || platform,
  }))
}

function buildSiteQuery(query, site) {
  return site ? `site:${site} ${query}` : query
}

function createItemsFromMatches(html, pattern, mapper, limit) {
  const results = []
  for (const match of html.matchAll(pattern)) {
    const item = mapper(match)
    if (!item || !item.title || !item.url || !looksLikeWebUrl(item.url)) {
      continue
    }
    results.push(item)
    if (results.length >= limit) {
      break
    }
  }
  return dedupeItems(results).slice(0, limit)
}

function resolvePresetLimit(preset, fallback) {
  switch (preset) {
    case 'small':
      return 3
    case 'medium':
      return 5
    case 'large':
      return 10
    case 'extra':
    case 'max':
      return 20
    default:
      return fallback
  }
}

async function searchBing(query, limit, host, config) {
  const base = host === 'cn' ? 'https://cn.bing.com' : 'https://www.bing.com'
  const html = await requestText(`${base}/search?q=${encodeURIComponent(query)}`, {
    timeoutMs: getNested(config, ['requestTimeoutMs'], DEFAULT_TIMEOUT_MS),
  })
  const blocks = html.match(/<li class="b_algo\b[\s\S]*?<\/li>/g) || []
  const items = []

  for (const block of blocks) {
    const headerMatch =
      block.match(/<div class="b_algoheader"[\s\S]*?<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i) ||
      block.match(/<h2[^>]*>\s*<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>\s*<\/h2>/i)

    if (!headerMatch) {
      continue
    }

    const snippetMatch =
      block.match(/<div class="b_caption"[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/i) ||
      block.match(/<p[^>]*>([\s\S]*?)<\/p>/i)
    const title = normalizeText(headerMatch[2])
    const url = toAbsoluteUrl(headerMatch[1], base)
    if (!title || !url) {
      continue
    }

    items.push(
      makeItem(
        title,
        url,
        snippetMatch ? normalizeText(snippetMatch[1]) : '',
        host === 'cn' ? 'bing_cn_direct' : 'bing_int_direct',
      ),
    )
    if (items.length >= limit) {
      break
    }
  }

  return items
}

async function searchDuckDuckGoHtml(query, limit, config) {
  const base = 'https://html.duckduckgo.com'
  const html = await requestText(`${base}/html/?q=${encodeURIComponent(query)}`, {
    timeoutMs: getNested(config, ['requestTimeoutMs'], DEFAULT_TIMEOUT_MS),
  })

  return createItemsFromMatches(
    html,
    /<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?(?:<a[^>]+class="[^"]*result__snippet[^"]*"[^>]*>|<div[^>]+class="[^"]*result__snippet[^"]*"[^>]*>)([\s\S]*?)<\/(?:a|div)>/gi,
    (match) =>
      makeItem(
        normalizeText(match[2]),
        toAbsoluteUrl(match[1], base),
        normalizeText(match[3]),
        'duckduckgo_html',
      ),
    limit,
  )
}

async function searchDuckDuckGoInstant(query, limit) {
  const payload = await requestJson(
    `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_redirect=1&no_html=1`,
  )
  const items = []

  if (payload.AbstractText && payload.AbstractURL) {
    items.push(
      makeItem(payload.Heading || payload.AbstractSource || query, payload.AbstractURL, payload.AbstractText, 'duckduckgo_instant', {
        answerType: 'abstract',
      }),
    )
  }

  for (const result of payload.Results || []) {
    if (!result.Text || !result.FirstURL) {
      continue
    }
    items.push(
      makeItem(
        normalizeText(result.Text.split(' - ')[0]),
        result.FirstURL,
        result.Text,
        'duckduckgo_instant',
        { answerType: 'result' },
      ),
    )
  }

  const collectTopics = (topics, depth = 0) => {
    for (const topic of topics || []) {
      if (topic.Topics && depth < 2) {
        collectTopics(topic.Topics, depth + 1)
        continue
      }
      if (topic.Text && topic.FirstURL) {
        items.push(
          makeItem(
            normalizeText(topic.Text.split(' - ')[0]),
            topic.FirstURL,
            topic.Text,
            'duckduckgo_instant',
            { answerType: 'related' },
          ),
        )
      }
    }
  }

  collectTopics(payload.RelatedTopics || [])
  return dedupeItems(items).slice(0, limit)
}

async function searchBraveHtml(query, limit, config) {
  const base = 'https://search.brave.com'
  const html = await requestText(`${base}/search?q=${encodeURIComponent(query)}&source=web`, {
    timeoutMs: getNested(config, ['requestTimeoutMs'], DEFAULT_TIMEOUT_MS),
  })
  const blocks = html.match(/<div[^>]+data-type="web"[\s\S]*?<\/div>\s*<\/div>/g) || []
  const items = []

  for (const block of blocks) {
    const headerMatch =
      block.match(/<a[^>]+href="([^"]+)"[^>]*>[\s\S]*?<div[^>]+class="[^"]*title[^"]*"[^>]*>([\s\S]*?)<\/div>/i) ||
      block.match(/<a[^>]+href="([^"]+)"[^>]+class="[^"]*snippet-title[^"]*"[^>]*>([\s\S]*?)<\/a>/i)
    if (!headerMatch) {
      continue
    }
    const snippetMatch =
      block.match(/<div[^>]+class="[^"]*snippet[^"]*"[\s\S]*?<div[^>]+class="[^"]*content[^"]*"[^>]*>([\s\S]*?)<\/div>/i) ||
      block.match(/<p[^>]+class="[^"]*snippet[^"]*"[^>]*>([\s\S]*?)<\/p>/i)

    items.push(
      makeItem(
        normalizeText(headerMatch[2]),
        toAbsoluteUrl(headerMatch[1], base),
        snippetMatch ? normalizeText(snippetMatch[1]) : '',
        'brave_direct',
      ),
    )
    if (items.length >= limit) {
      break
    }
  }

  return dedupeItems(items).slice(0, limit)
}

async function searchBaidu(query, limit, config) {
  const base = 'https://www.baidu.com'
  const html = await requestText(`${base}/s?wd=${encodeURIComponent(query)}`, {
    timeoutMs: getNested(config, ['requestTimeoutMs'], DEFAULT_TIMEOUT_MS),
  })
  const blocks = html.match(/<div[^>]+class="[^"]*(?:result|c-container)[^"]*"[\s\S]*?<\/div>\s*<\/div>?/g) || []
  const items = []

  for (const block of blocks) {
    const headerMatch = block.match(/<h3[^>]*>\s*<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>\s*<\/h3>/i)
    if (!headerMatch) {
      continue
    }
    const snippetMatch = block.match(/<div[^>]+class="[^"]*(?:c-abstract|content-right_.*?abstract)[^"]*"[^>]*>([\s\S]*?)<\/div>/i)
    items.push(
      makeItem(
        normalizeText(headerMatch[2]),
        toAbsoluteUrl(headerMatch[1], base),
        snippetMatch ? normalizeText(snippetMatch[1]) : '',
        'baidu_direct',
      ),
    )
    if (items.length >= limit) {
      break
    }
  }

  return dedupeItems(items).slice(0, limit)
}

async function searchGoogleHtml(query, limit, config, host) {
  const domain = host || 'www.google.com'
  const base = `https://${domain}`
  const html = await requestText(
    `${base}/search?hl=zh-CN&num=${Math.min(limit, 10)}&q=${encodeURIComponent(query)}`,
    {
      timeoutMs: getNested(config, ['requestTimeoutMs'], DEFAULT_TIMEOUT_MS),
    },
  )

  return createItemsFromMatches(
    html,
    /<a[^>]+href="\/url\?q=([^"&]+)[^"]*"[^>]*>([\s\S]*?)<\/a>/gi,
    (match) =>
      makeItem(
        normalizeText(match[2]),
        decodeURIComponent(match[1]),
        '',
        domain.includes('.hk') ? 'google_hk_direct' : 'google_direct',
      ),
    limit,
  )
}

async function searchStartpageHtml(query, limit, config) {
  const base = 'https://www.startpage.com'
  const html = await requestText(`${base}/sp/search?query=${encodeURIComponent(query)}`, {
    timeoutMs: getNested(config, ['requestTimeoutMs'], DEFAULT_TIMEOUT_MS),
  })
  return createItemsFromMatches(
    html,
    /<a[^>]+href="([^"]+)"[^>]+(?:class="[^"]*(?:result-link|w-gl__result-title)[^"]*"|data-testid="result-title-a")[^>]*>([\s\S]*?)<\/a>/gi,
    (match) =>
      makeItem(normalizeText(match[2]), toAbsoluteUrl(match[1], base), '', 'startpage_direct'),
    limit,
  )
}

async function searchYahooHtml(query, limit, config) {
  const base = 'https://search.yahoo.com'
  const html = await requestText(`${base}/search?p=${encodeURIComponent(query)}`, {
    timeoutMs: getNested(config, ['requestTimeoutMs'], DEFAULT_TIMEOUT_MS),
  })
  return createItemsFromMatches(
    html,
    /<a[^>]+href="([^"]+)"[^>]+(?:class="[^"]*(?:d-ib|title)[^"]*"|data-matarget="rh")[^>]*>([\s\S]*?)<\/a>/gi,
    (match) =>
      makeItem(normalizeText(match[2]), toAbsoluteUrl(match[1], base), '', 'yahoo_direct'),
    limit,
  )
}

async function searchEcosiaHtml(query, limit, config) {
  const base = 'https://www.ecosia.org'
  const html = await requestText(`${base}/search?q=${encodeURIComponent(query)}`, {
    timeoutMs: getNested(config, ['requestTimeoutMs'], DEFAULT_TIMEOUT_MS),
  })
  return createItemsFromMatches(
    html,
    /<a[^>]+href="([^"]+)"[^>]+(?:data-test="result-title"|class="[^"]*result-title[^"]*")[^>]*>([\s\S]*?)<\/a>/gi,
    (match) =>
      makeItem(normalizeText(match[2]), toAbsoluteUrl(match[1], base), '', 'ecosia_direct'),
    limit,
  )
}

async function searchQwantHtml(query, limit, config) {
  const base = 'https://www.qwant.com'
  const html = await requestText(`${base}/?q=${encodeURIComponent(query)}&t=web`, {
    timeoutMs: getNested(config, ['requestTimeoutMs'], DEFAULT_TIMEOUT_MS),
  })
  return createItemsFromMatches(
    html,
    /<a[^>]+href="([^"]+)"[^>]+(?:class="[^"]*(?:result|title|webResult)[^"]*"|data-testid="web-result-title")[^>]*>([\s\S]*?)<\/a>/gi,
    (match) =>
      makeItem(normalizeText(match[2]), toAbsoluteUrl(match[1], base), '', 'qwant_direct'),
    limit,
  )
}

async function searchSo360Html(query, limit, config) {
  const base = 'https://www.so.com'
  const html = await requestText(`${base}/s?q=${encodeURIComponent(query)}`, {
    timeoutMs: getNested(config, ['requestTimeoutMs'], DEFAULT_TIMEOUT_MS),
  })
  return createItemsFromMatches(
    html,
    /<a[^>]+href="([^"]+)"[^>]+(?:data-mdurl="[^"]*"|class="[^"]*res-title[^"]*")[^>]*>([\s\S]*?)<\/a>/gi,
    (match) =>
      makeItem(normalizeText(match[2]), toAbsoluteUrl(match[1], base), '', 'so360_direct'),
    limit,
  )
}

async function searchSogouHtml(query, limit, config) {
  const base = 'https://www.sogou.com'
  const html = await requestText(`${base}/web?query=${encodeURIComponent(query)}`, {
    timeoutMs: getNested(config, ['requestTimeoutMs'], DEFAULT_TIMEOUT_MS),
  })
  return createItemsFromMatches(
    html,
    /<a[^>]+href="([^"]+)"[^>]+(?:id="uigs_result_title"|\bhref=[^>]+data-rank="[^"]+"|class="[^"]*vr-title[^"]*")[^>]*>([\s\S]*?)<\/a>/gi,
    (match) =>
      makeItem(normalizeText(match[2]), toAbsoluteUrl(match[1], base), '', 'sogou_direct'),
    limit,
  )
}

async function searchMojeekHtml(query, limit, config) {
  const base = 'https://www.mojeek.com'
  const html = await requestText(`${base}/search?q=${encodeURIComponent(query)}`, {
    timeoutMs: getNested(config, ['requestTimeoutMs'], DEFAULT_TIMEOUT_MS),
  })
  return createItemsFromMatches(
    html,
    /<a[^>]+href="([^"]+)"[^>]+class="[^"]*title[^"]*"[^>]*>([\s\S]*?)<\/a>/gi,
    (match) =>
      makeItem(normalizeText(match[2]), toAbsoluteUrl(match[1], base), '', 'mojeek'),
    limit,
  )
}

async function searchYandexHtml(query, limit, config) {
  const base = 'https://yandex.com'
  const html = await requestText(`${base}/search/?text=${encodeURIComponent(query)}`, {
    timeoutMs: getNested(config, ['requestTimeoutMs'], DEFAULT_TIMEOUT_MS),
  })
  return createItemsFromMatches(
    html,
    /<a[^>]+href="([^"]+)"[^>]+(?:class="[^"]*(?:OrganicTitle-Link|link_theme_outer)[^"]*"|aria-label="[^"]+")[^>]*>([\s\S]*?)<\/a>/gi,
    (match) =>
      makeItem(normalizeText(match[2]), toAbsoluteUrl(match[1], base), '', 'yandex'),
    limit,
  )
}

async function searchWikipedia(query, limit) {
  const payload = await requestJson(
    `https://zh.wikipedia.org/w/api.php?action=query&list=search&format=json&origin=*&srsearch=${encodeURIComponent(query)}&srlimit=${limit}`,
  )
  return (payload.query && payload.query.search ? payload.query.search : []).map((item) =>
    makeItem(item.title, `https://zh.wikipedia.org/?curid=${item.pageid}`, item.snippet || '', 'wikipedia', {
      publishedAt: item.timestamp,
    }),
  )
}

async function searchGithub(query, limit, config) {
  const token = getApiKey(config, 'github')
  const payload = await requestJson(
    `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&per_page=${Math.min(limit, 10)}`,
    {
      headers: {
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        accept: 'application/vnd.github+json',
      },
    },
  )
  return (payload.items || []).map((item) =>
    makeItem(item.full_name, item.html_url, item.description || '', 'github', {
      publishedAt: item.updated_at,
    }),
  )
}

async function searchReddit(query, limit) {
  const payload = await requestJson(
    `https://www.reddit.com/search.json?q=${encodeURIComponent(query)}&limit=${limit}`,
    {},
  )
  const children = payload.data && Array.isArray(payload.data.children) ? payload.data.children : []
  return children
    .map((entry) => (entry && entry.data ? entry.data : null))
    .filter(Boolean)
    .map((item) =>
      makeItem(item.title || '', `https://www.reddit.com${item.permalink || ''}`, item.selftext || '', 'reddit', {
        publishedAt: item.created_utc ? new Date(item.created_utc * 1000).toISOString() : undefined,
      }),
    )
}

async function searchJina(query, limit, config) {
  const apiKey = getApiKey(config, 'jina')
  if (!apiKey) {
    throw new Error('Jina API key is missing')
  }
  const payload = await requestJson(`https://s.jina.ai/?q=${encodeURIComponent(query)}`, {
    headers: {
      authorization: `Bearer ${apiKey}`,
      'x-respond-with': 'no-content',
      accept: 'application/json',
    },
  })
  return (payload.data || []).slice(0, limit).map((item) =>
    makeItem(item.title || item.url || query, item.url || '', item.description || item.content || '', 'jina'),
  )
}

async function searchTavily(query, limit, config) {
  const apiKey = getApiKey(config, 'tavily')
  if (!apiKey) {
    throw new Error('Tavily API key is missing')
  }
  const payload = await postJson('https://api.tavily.com/search', {
    api_key: apiKey,
    query,
    max_results: limit,
    include_answer: false,
  })
  return (payload.results || []).map((item) =>
    makeItem(item.title || item.url, item.url || '', item.content || '', 'tavily'),
  )
}

async function searchExa(query, limit, config) {
  const apiKey = getApiKey(config, 'exa')
  if (!apiKey) {
    throw new Error('Exa API key is missing')
  }
  const payload = await postJson(
    'https://api.exa.ai/search',
    {
      query,
      numResults: limit,
      type: 'auto',
      contents: { text: { maxCharacters: 500 } },
    },
    {
      headers: { 'x-api-key': apiKey },
    },
  )
  return (payload.results || []).map((item) =>
    makeItem(item.title || item.url, item.url || '', getNested(item, ['contents', 'text'], item.text || ''), 'exa'),
  )
}

async function searchSerper(query, limit, config) {
  const apiKey = getApiKey(config, 'serper')
  if (!apiKey) {
    throw new Error('Serper API key is missing')
  }
  const payload = await postJson(
    'https://google.serper.dev/search',
    {
      q: query,
      num: limit,
    },
    {
      headers: { 'x-api-key': apiKey },
    },
  )
  return (payload.organic || []).map((item) =>
    makeItem(item.title || item.link, item.link || '', item.snippet || '', 'serper'),
  )
}

async function searchGoogleCustomSearch(query, limit, config, image) {
  const apiKey = getApiKey(config, 'googleSearch')
  const searchEngineId = getApiKey(config, 'googleSearchEngineId')
  if (!apiKey || !searchEngineId) {
    throw new Error('Google Custom Search credentials are missing')
  }
  const params = new URLSearchParams({
    key: apiKey,
    cx: searchEngineId,
    q: query,
    num: String(Math.max(1, Math.min(10, limit))),
  })
  if (image) {
    params.set('searchType', 'image')
  }
  const payload = await requestJson(`https://www.googleapis.com/customsearch/v1?${params.toString()}`)
  return (payload.items || []).map((item) =>
    makeItem(item.title || item.link, item.link || '', item.snippet || '', image ? 'google_images' : 'google', image && item.image
      ? {
          imageUrl: item.link,
          thumbnailUrl: item.image.thumbnailLink,
        }
      : undefined),
  )
}

async function searchGoogle(query, limit, config) {
  if (getApiKey(config, 'googleSearch') && getApiKey(config, 'googleSearchEngineId')) {
    return searchGoogleCustomSearch(query, limit, config, false)
  }
  return searchGoogleHtml(query, limit, config, 'www.google.com')
}

async function searchYouTubeApi(query, limit, config) {
  const apiKey = getApiKey(config, 'youtube')
  if (!apiKey) {
    throw new Error('YouTube API key is missing')
  }
  const params = new URLSearchParams({
    key: apiKey,
    part: 'snippet',
    type: 'video',
    q: query,
    maxResults: String(Math.max(1, Math.min(50, limit))),
  })
  const payload = await requestJson(`https://www.googleapis.com/youtube/v3/search?${params.toString()}`)
  return (payload.items || []).map((item) =>
    makeItem(
      getNested(item, ['snippet', 'title'], ''),
      `https://www.youtube.com/watch?v=${getNested(item, ['id', 'videoId'], '')}`,
      getNested(item, ['snippet', 'description'], ''),
      'youtube',
      {
        publishedAt: getNested(item, ['snippet', 'publishedAt'], undefined),
      },
    ),
  )
}

async function searchMetaso(query, limit, config) {
  const apiKey = getApiKey(config, 'metaso')
  if (!apiKey) {
    throw new Error('Metaso API key is missing')
  }
  const payload = await postJson(
    'https://metaso.cn/api/v1/search',
    {
      q: query,
      scope: 'webpage',
      includeSummary: true,
      size: String(limit),
      includeRawContent: false,
      conciseSnippet: true,
    },
    {
      headers: { authorization: `Bearer ${apiKey}` },
    },
  )
  return (payload.webpages || []).map((item) =>
    makeItem(item.title || item.link, item.link || '', item.summary || item.snippet || '', 'metaso', {
      publishedAt: item.date,
    }),
  )
}

async function searchVolcengine(query, limit, config) {
  const apiKey = getApiKey(config, 'volcengine')
  if (!apiKey) {
    throw new Error('Volcengine API key is missing')
  }
  const payload = await postJson(
    'https://open.feedcoopapi.com/search_api/web_search',
    {
      Query: query,
      SearchType: 'web',
      Count: limit,
      Filter: {
        NeedContent: false,
        NeedUrl: true,
        AuthInfoLevel: 0,
      },
      NeedSummary: false,
      QueryControl: {
        QueryRewrite: false,
      },
    },
    {
      headers: { authorization: `Bearer ${apiKey}` },
    },
  )

  const webResults =
    getNested(payload, ['Result', 'WebResults'], []) ||
    getNested(payload, ['Result', 'WebResults', 'Items'], []) ||
    payload.WebResults ||
    payload.web_results ||
    []

  return (Array.isArray(webResults) ? webResults : []).map((item) =>
    makeItem(
      item.Title || item.title || item.SiteName || item.site_name || item.Url || item.url || '',
      item.Url || item.url || '',
      item.Summary || item.summary || item.Snippet || item.snippet || '',
      'volcengine',
      {
        publishedAt: item.PublishTime || item.publish_time,
      },
    ),
  )
}

async function searchBingImages(query, limit, config) {
  const html = await requestText(`https://www.bing.com/images/search?q=${encodeURIComponent(query)}`, {
    timeoutMs: getNested(config, ['requestTimeoutMs'], DEFAULT_TIMEOUT_MS),
  })
  const items = []
  const matches = html.matchAll(/<a[^>]+class="[^"]*\biusc\b[^"]*"[^>]+m="([^"]+)"[^>]*>/g)
  for (const match of matches) {
    let metadata
    try {
      metadata = JSON.parse(decodeHtmlEntities(match[1]))
    } catch {
      continue
    }
    if (!metadata || !metadata.murl) {
      continue
    }
    items.push(
      makeItem(metadata.t || query, metadata.murl, '', 'bing_images', {
        imageUrl: metadata.murl,
        thumbnailUrl: metadata.turl || metadata.murl,
      }),
    )
    if (items.length >= limit) {
      break
    }
  }
  return dedupeItems(items).slice(0, limit)
}

async function searchBaiduImages(query, limit, config) {
  const payload = await requestJson(
    `https://image.baidu.com/search/acjson?tn=resultjson_com&word=${encodeURIComponent(query)}&pn=0&rn=${limit}`,
    {
      timeoutMs: getNested(config, ['requestTimeoutMs'], DEFAULT_TIMEOUT_MS),
      referer: 'https://image.baidu.com/',
    },
  )
  return dedupeItems(
    (payload.data || [])
      .filter((item) => item && (item.middleURL || item.hoverURL || item.thumbURL))
      .map((item) =>
        makeItem(
          item.fromPageTitleEnc || item.fromPageTitle || query,
          item.fromURL || item.pageUrl || item.replaceUrl?.[0]?.ObjURL || item.middleURL,
          item.fromPageTitle || '',
          'baidu_images',
          {
            imageUrl: item.middleURL || item.hoverURL || item.thumbURL,
            thumbnailUrl: item.thumbURL || item.middleURL || item.hoverURL,
          },
        ),
      ),
  ).slice(0, limit)
}

async function searchSo360Images(query, limit, config) {
  const payload = await requestJson(
    `https://image.so.com/j?q=${encodeURIComponent(query)}&src=srp&sn=0&pn=${limit}`,
    {
      timeoutMs: getNested(config, ['requestTimeoutMs'], DEFAULT_TIMEOUT_MS),
      referer: 'https://image.so.com/',
    },
  )
  return dedupeItems(
    (payload.list || []).map((item) =>
      makeItem(item.title || query, item.link || item.url || item.img, item.desc || '', 'so360_images', {
        imageUrl: item.img || item.imgurl || item.thumb_bak || item.thumb,
        thumbnailUrl: item.thumb_bak || item.thumb || item.img,
      }),
    ),
  ).slice(0, limit)
}

async function searchGelbooruImages(query, limit) {
  const payload = await requestJson(
    `https://gelbooru.com/index.php?page=dapi&s=post&q=index&json=1&tags=${encodeURIComponent(query)}&limit=${limit}`,
  )
  const posts = Array.isArray(payload.post) ? payload.post : Array.isArray(payload) ? payload : []
  return posts.map((item) =>
    makeItem(item.tags || query, item.source || item.file_url || '', '', 'gelbooru_images', {
      imageUrl: item.file_url || '',
      thumbnailUrl: item.preview_url || item.sample_url || item.file_url || '',
    }),
  )
}

async function searchSafebooruImages(query, limit) {
  const payload = await requestJson(
    `https://safebooru.org/index.php?page=dapi&s=post&q=index&json=1&tags=${encodeURIComponent(query)}&limit=${limit}`,
  )
  const posts = Array.isArray(payload.post) ? payload.post : Array.isArray(payload) ? payload : []
  return posts.map((item) =>
    makeItem(item.tags || query, item.source || item.file_url || '', '', 'safebooru_images', {
      imageUrl: item.file_url || '',
      thumbnailUrl: item.preview_url || item.sample_url || item.file_url || '',
    }),
  )
}

async function searchDanbooruImages(query, limit) {
  const payload = await requestJson(
    `https://danbooru.donmai.us/posts.json?tags=${encodeURIComponent(query)}&limit=${limit}`,
  )
  return (payload || []).map((item) =>
    makeItem(item.tag_string || query, item.source || item.file_url || '', '', 'danbooru_images', {
      imageUrl: item.file_url || '',
      thumbnailUrl: item.preview_file_url || item.large_file_url || item.file_url || '',
    }),
  )
}

async function searchPixabayImages(query, limit, config) {
  const apiKey = getApiKey(config, 'pixabay')
  if (apiKey) {
    const payload = await requestJson(
      `https://pixabay.com/api/?key=${encodeURIComponent(apiKey)}&q=${encodeURIComponent(query)}&per_page=${limit}`,
    )
    return (payload.hits || []).map((item) =>
      makeItem(item.tags || query, item.pageURL || item.largeImageURL || '', '', 'pixabay_images', {
        imageUrl: item.largeImageURL || item.webformatURL || item.previewURL || '',
        thumbnailUrl: item.previewURL || item.webformatURL || item.largeImageURL || '',
      }),
    )
  }
  return searchPreviewImagesBySiteSearch(query, 'pixabay.com', limit, config)
}

async function searchPexelsImages(query, limit, config) {
  const apiKey = getApiKey(config, 'pexels')
  if (apiKey) {
    const payload = await requestJson(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${limit}`,
      {
        headers: { authorization: apiKey },
      },
    )
    return (payload.photos || []).map((item) =>
      makeItem(item.alt || query, item.url || item.src?.original || '', '', 'pexels_images', {
        imageUrl: getNested(item, ['src', 'large2x'], getNested(item, ['src', 'original'], '')),
        thumbnailUrl: getNested(item, ['src', 'medium'], getNested(item, ['src', 'small'], '')),
      }),
    )
  }
  return searchPreviewImagesBySiteSearch(query, 'pexels.com', limit, config)
}

async function searchUnsplashImages(query, limit, config) {
  const apiKey = getApiKey(config, 'unsplash')
  if (apiKey) {
    const payload = await requestJson(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=${limit}`,
      {
        headers: { authorization: `Client-ID ${apiKey}` },
      },
    )
    return (payload.results || []).map((item) =>
      makeItem(item.alt_description || item.description || query, item.links?.html || item.urls?.full || '', '', 'unsplash_images', {
        imageUrl: item.urls?.full || item.urls?.regular || '',
        thumbnailUrl: item.urls?.small || item.urls?.thumb || '',
      }),
    )
  }
  return searchPreviewImagesBySiteSearch(query, 'unsplash.com', limit, config)
}

async function searchVolcengineImages(query, limit, config) {
  const apiKey = getApiKey(config, 'volcengine')
  if (!apiKey) {
    throw new Error('Volcengine API key is missing')
  }
  const payload = await postJson(
    'https://open.feedcoopapi.com/search_api/web_search',
    {
      Query: query,
      SearchType: 'image',
      Count: Math.min(limit, 5),
      Filter: {},
      QueryControl: {
        QueryRewrite: false,
      },
    },
    {
      headers: { authorization: `Bearer ${apiKey}` },
    },
  )
  const images = getNested(payload, ['Result', 'ImageResults'], [])
  return (Array.isArray(images) ? images : []).map((item) =>
    makeItem(item.Title || query, item.Url || item.Image?.Url || '', item.SiteName || '', 'volcengine_images', {
      imageUrl: item.Image?.Url || '',
      thumbnailUrl: item.Image?.Url || '',
      publishedAt: item.PublishTime || undefined,
    }),
  )
}

async function fetchPagePreviewImage(url, config) {
  const html = await requestText(url, {
    timeoutMs: getNested(config, ['requestTimeoutMs'], DEFAULT_TIMEOUT_MS),
  })
  const imageMatch =
    html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i) ||
    html.match(/<meta[^>]+name="twitter:image"[^>]+content="([^"]+)"/i) ||
    html.match(/<img[^>]+src="([^"]+)"[^>]*>/i)
  if (!imageMatch) {
    return null
  }
  return toAbsoluteUrl(imageMatch[1], url)
}

async function searchPreviewImagesBySiteSearch(query, site, limit, config) {
  const providerList = getNested(config, ['defaultProviders'], DEFAULT_WEB_PROVIDERS)
    .map((provider) => normalizeProviderName(provider))
    .filter(Boolean)
  const searchResult = await runProviders(query, providerList, Math.min(limit * 2, MAX_RESULTS), site, config)
  const items = []

  for (const item of searchResult.items) {
    try {
      const previewUrl = await fetchPagePreviewImage(item.url, config)
      if (!previewUrl) {
        continue
      }
      items.push({
        ...item,
        source: `${site}_preview`,
        imageUrl: previewUrl,
        thumbnailUrl: previewUrl,
      })
      if (items.length >= limit) {
        break
      }
    } catch {
      // Ignore preview fetch failures and continue with the next result.
    }
  }

  return dedupeItems(items).slice(0, limit)
}

async function readFeedItems(feedUrl, config) {
  const xml = await requestText(feedUrl, {
    purpose: 'feed',
    timeoutMs: getNested(config, ['requestTimeoutMs'], DEFAULT_TIMEOUT_MS),
  })
  const itemBlocks = xml.match(/<(?:item|entry)\b[\s\S]*?<\/(?:item|entry)>/g) || []
  return itemBlocks.map((block) => ({
    title: normalizeText((block.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || ''),
    link: decodeHtmlEntities(
      (block.match(/<link[^>]+href="([^"]+)"/i) || [])[1] ||
        (block.match(/<link[^>]*>([\s\S]*?)<\/link>/i) || [])[1] ||
        '',
    ),
    description: normalizeText(
      (block.match(/<(?:description|summary|content)[^>]*>([\s\S]*?)<\/(?:description|summary|content)>/i) || [])[1] || '',
    ),
    publishedAt: normalizeWhitespace(
      (block.match(/<(?:pubDate|updated|published)[^>]*>([\s\S]*?)<\/(?:pubDate|updated|published)>/i) || [])[1] || '',
    ),
  }))
}

async function searchRss(query, feeds, limit, config) {
  const lowered = String(query || '').toLowerCase()
  const results = []
  for (const feed of feeds) {
    const items = await readFeedItems(feed, config)
    for (const item of items) {
      const haystack = `${item.title}\n${item.description}`.toLowerCase()
      if (lowered && !haystack.includes(lowered)) {
        continue
      }
      if (!item.link) {
        continue
      }
      results.push(
        makeItem(item.title, item.link, item.description, feed, {
          publishedAt: item.publishedAt || undefined,
        }),
      )
      if (results.length >= limit) {
        return results
      }
    }
  }
  return results
}

function resolveFetchUrlBooleanOption(parsed, enabledFlag, disabledFlag, fallback) {
  if (parsed.flags.has(disabledFlag)) {
    return false
  }
  if (parsed.flags.has(enabledFlag)) {
    return true
  }
  return fallback
}

function resolveFetchUrlOptions(parsed, config) {
  return {
    maxContentChars: parsePositiveInt(
      parsed.values['max-content-chars'],
      getNested(config, ['fetchUrl', 'maxContentChars'], 24000),
    ),
    maxLinks: parsePositiveInt(parsed.values['max-links'], getNested(config, ['fetchUrl', 'maxLinks'], 40)),
    maxImages: parsePositiveInt(parsed.values['max-images'], getNested(config, ['fetchUrl', 'maxImages'], 20)),
    maxHeadings: parsePositiveInt(parsed.values['max-headings'], getNested(config, ['fetchUrl', 'maxHeadings'], 32)),
    includeMetadata: resolveFetchUrlBooleanOption(
      parsed,
      'include-metadata',
      'no-metadata',
      getNested(config, ['fetchUrl', 'includeMetadata'], true),
    ),
    includeHeadings: resolveFetchUrlBooleanOption(
      parsed,
      'include-headings',
      'no-headings',
      getNested(config, ['fetchUrl', 'includeHeadings'], true),
    ),
    includeLinkIndex: resolveFetchUrlBooleanOption(
      parsed,
      'include-links',
      'no-links',
      getNested(config, ['fetchUrl', 'includeLinkIndex'], true),
    ),
    includeImageIndex: resolveFetchUrlBooleanOption(
      parsed,
      'include-images',
      'no-images',
      getNested(config, ['fetchUrl', 'includeImageIndex'], true),
    ),
    browserExecutable: normalizeWhitespace(parsed.values['browser-executable']),
    browserVirtualTimeBudgetMs: parsePositiveInt(
      parsed.values['browser-virtual-time-budget-ms'],
      getNested(config, ['fetchUrl', 'browserVirtualTimeBudgetMs'], 8000),
    ),
  }
}

function resolveFetchUrlExtractor(config, extract) {
  const raw = normalizeWhitespace(extract || getNested(config, ['fetchUrl', 'preferredEngine'], 'html')).toLowerCase()
  if (!raw || raw === 'html' || raw === 'direct' || raw === 'jina') {
    return 'html'
  }
  if (raw === 'browser' || raw === 'webview' || raw === 'native') {
    return 'browser'
  }
  return 'html'
}

function parseJsonObject(text) {
  try {
    const parsed = JSON.parse(text)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

function resolveZhihuQuestionInfo(url) {
  try {
    const parsed = new URL(url)
    if (!/\.?zhihu\.com$/i.test(parsed.hostname)) {
      return null
    }
    const match = parsed.pathname.match(/^\/question\/(\d+)(?:\/|$)/i)
    if (!match) {
      return null
    }
    return {
      questionId: match[1],
      hostname: parsed.hostname,
      pathname: parsed.pathname,
    }
  } catch {
    return null
  }
}

function extractZhihuChallengeDetails(text, finalUrl) {
  const challengeScriptMatch = text.match(/<script[^>]+src="([^"]*zse-ck[^"]+)"/i)
  const challengeScriptUrl = challengeScriptMatch ? toAbsoluteUrl(challengeScriptMatch[1], finalUrl) : ''
  const jsonError = parseJsonObject(text)
  const jsonMessage =
    jsonError &&
    jsonError.error &&
    typeof jsonError.error === 'object' &&
    jsonError.error !== null &&
    typeof jsonError.error.message === 'string'
      ? normalizeWhitespace(jsonError.error.message)
      : ''
  return {
    challengeScriptUrl,
    jsonMessage,
  }
}

function createAccessLimitedMarkdown(payload) {
  const lines = ['# 访问受限', '']

  if (payload.siteLabel) {
    lines.push(`- **站点**: ${markdownEscapeInline(payload.siteLabel)}`)
  }
  if (payload.url) {
    lines.push(`- **URL**: ${payload.url}`)
  }
  if (payload.finalUrl && payload.finalUrl !== payload.url) {
    lines.push(`- **最终 URL**: ${payload.finalUrl}`)
  }
  if (payload.status) {
    lines.push(`- **状态码**: ${payload.status}`)
  }
  if (payload.questionId) {
    lines.push(`- **问题 ID**: ${markdownEscapeInline(payload.questionId)}`)
  }
  if (payload.reason) {
    lines.push(`- **原因**: ${markdownEscapeInline(payload.reason)}`)
  }

  if (payload.message) {
    lines.push('', '## 说明', '', payload.message)
  }

  if (payload.challengeScriptUrl) {
    lines.push('', '## 挑战页线索', '', `- [知乎 zse-ck challenge 脚本](${payload.challengeScriptUrl})`)
  }

  lines.push(
    '',
    '## 当前结论',
    '',
    '目标页面返回了站点风控/验证页面，当前运行时没有可复用的登录态，也无法稳定通过该站点的反爬挑战，因此不能把这个响应当成正文内容。',
  )

  return lines.join('\n')
}

function buildZhihuAccessLimitedPayload(requestedUrl, response) {
  const question = resolveZhihuQuestionInfo(requestedUrl)
  if (!question || response.status !== 403) {
    return null
  }

  const body = String(response.text || '')
  const isChallengePage = body.includes('zh-zse-ck') || body.includes('40362') || body.includes('__zse_ck')
  if (!isChallengePage) {
    return null
  }

  const details = extractZhihuChallengeDetails(body, response.url || requestedUrl)
  const message =
    details.jsonMessage ||
    '知乎当前返回了 zse-ck 风控/验证页面，直接 HTML 抓取被拦截。'

  const content = createAccessLimitedMarkdown({
    siteLabel: '知乎',
    url: requestedUrl,
    finalUrl: response.url || requestedUrl,
    status: response.status,
    questionId: question.questionId,
    reason: '知乎风控 / zse-ck challenge',
    message,
    challengeScriptUrl: details.challengeScriptUrl,
  })

  return {
    title: `知乎问题 ${question.questionId}（访问受限）`,
    url: requestedUrl,
    finalUrl: response.url || requestedUrl,
    description: message,
    content,
    contentFormat: 'markdown',
    contentText: truncateText(`${message} ${content}`, 4000),
    engine: 'html_blocked',
    headings: [],
    links: [
      {
        text: '原始问题链接',
        url: requestedUrl,
      },
      ...(details.challengeScriptUrl
        ? [
            {
              text: '知乎 challenge 脚本',
              url: details.challengeScriptUrl,
            },
          ]
        : []),
    ],
    images: [],
    metadata: {
      status: response.status,
      siteName: '知乎',
      contentType: Array.isArray(response.headers['content-type'])
        ? response.headers['content-type'].join(', ')
        : response.headers['content-type'] || undefined,
      blockedBy: 'zhihu_zse_ck',
      questionId: question.questionId,
      challengeScriptUrl: details.challengeScriptUrl || undefined,
    },
    warnings: [
      'direct fetch was blocked by Zhihu challenge page; returned an access-limited summary instead of question正文',
    ],
    truncated: false,
  }
}

function buildZhihuBrowserAccessLimitedPayload(requestedUrl, html, finalUrl, sourceLabel) {
  const question = resolveZhihuQuestionInfo(requestedUrl)
  if (!question) {
    return null
  }

  const body = String(html || '')
  const isChallengePage = body.includes('zh-zse-ck') || body.includes('40362') || body.includes('__zse_ck')
  if (!isChallengePage) {
    return null
  }

  const details = extractZhihuChallengeDetails(body, finalUrl || requestedUrl)
  const message = details.jsonMessage || '知乎当前返回了 zse-ck 风控/验证页面，浏览器模式也未获得可用正文。'
  const content = createAccessLimitedMarkdown({
    siteLabel: '知乎',
    url: requestedUrl,
    finalUrl: finalUrl || requestedUrl,
    questionId: question.questionId,
    reason: '知乎风控 / zse-ck challenge',
    message,
    challengeScriptUrl: details.challengeScriptUrl,
  })

  return {
    title: `知乎问题 ${question.questionId}（访问受限）`,
    url: requestedUrl,
    finalUrl: finalUrl || requestedUrl,
    description: message,
    content,
    contentFormat: 'markdown',
    contentText: truncateText(`${message} ${content}`, 4000),
    engine: sourceLabel,
    headings: [],
    links: [
      {
        text: '原始问题链接',
        url: requestedUrl,
      },
      ...(details.challengeScriptUrl
        ? [
            {
              text: '知乎 challenge 脚本',
              url: details.challengeScriptUrl,
            },
          ]
        : []),
    ],
    images: [],
    metadata: {
      siteName: '知乎',
      blockedBy: 'zhihu_zse_ck',
      questionId: question.questionId,
      challengeScriptUrl: details.challengeScriptUrl || undefined,
    },
    warnings: [
      `${sourceLabel} reached a Zhihu challenge page and returned an access-limited summary instead of question正文`,
    ],
    truncated: false,
  }
}

async function fetchUrlViaHtml(url, config, options) {
  const response = await request(url, {
    timeoutMs: getNested(config, ['requestTimeoutMs'], DEFAULT_TIMEOUT_MS),
  })
  if (response.status < 200 || response.status >= 300) {
    const blockedPayload = buildZhihuAccessLimitedPayload(url, response)
    if (blockedPayload) {
      return blockedPayload
    }
    throw new Error(`Request failed: ${response.status} ${url}`)
  }
  return extractPageContentWithDefuddle({
    html: response.text,
    requestedUrl: url,
    finalUrl: response.url || url,
    responseMetadata: {
      contentType: Array.isArray(response.headers['content-type'])
        ? response.headers['content-type'].join(', ')
        : response.headers['content-type'] || '',
      lastModified: Array.isArray(response.headers['last-modified'])
        ? response.headers['last-modified'].join(', ')
        : response.headers['last-modified'] || '',
      status: response.status,
    },
    options,
    engine: 'defuddle_html',
    warnings: [],
  })
}

async function fetchUrlViaBrowser(url, config, options) {
  const rendered = await fetchRenderedHtmlWithBrowser(url, config, options)
  const blockedPayload = buildZhihuBrowserAccessLimitedPayload(
    url,
    rendered.html,
    rendered.finalUrl || url,
    'defuddle_browser',
  )
  if (blockedPayload) {
    return blockedPayload
  }

  return extractPageContentWithDefuddle({
    html: rendered.html,
    requestedUrl: url,
    finalUrl: rendered.finalUrl || url,
    responseMetadata: {
      contentType: 'text/html',
      status: 200,
    },
    options,
    engine: 'defuddle_browser',
    warnings: rendered.warnings,
  })
}

async function fetchUrl(url, config, extract, options, scriptLabel) {
  const label = normalizeWhitespace(scriptLabel || 'fetch_url')
  const normalizedUrl = normalizeRequestedUrlInput(url)
  if (!normalizedUrl) {
    throw new Error(`${label} requires a non-empty URL`)
  }
  assertSupportedRequestUrl(normalizedUrl, label)
  const extractor = resolveFetchUrlExtractor(config, extract)
  if (extractor === 'browser') {
    return fetchUrlViaBrowser(normalizedUrl, config, options)
  }
  return fetchUrlViaHtml(normalizedUrl, config, options)
}

async function runProviders(query, providers, limit, site, config) {
  const effectiveQuery = buildSiteQuery(query, site)
  const normalizedProviders = uniqueStrings(providers.map((provider) => normalizeProviderName(provider)))
  const tasks = normalizedProviders.map(async (provider) => {
    assertSearchProviderEnabled(provider)
    switch (provider) {
      case 'baidu':
      case 'baidu_direct':
        return searchBaidu(effectiveQuery, limit, config)
      case 'bing':
      case 'bing_int':
      case 'bing_int_direct':
        return searchBing(effectiveQuery, limit, 'www', config)
      case 'bing_cn':
      case 'bing_cn_direct':
        return searchBing(effectiveQuery, limit, 'cn', config)
      case 'brave':
      case 'brave_direct':
        return searchBraveHtml(effectiveQuery, limit, config)
      case 'duckduckgo':
      case 'duckduckgo_html':
        return searchDuckDuckGoHtml(effectiveQuery, limit, config)
      case 'duckduckgo_instant':
        return searchDuckDuckGoInstant(effectiveQuery, limit)
      case 'ecosia_direct':
        return searchEcosiaHtml(effectiveQuery, limit, config)
      case 'exa':
        return searchExa(query, limit, config)
      case 'github':
        return searchGithub(query, limit, config)
      case 'google':
        return searchGoogle(query, limit, config)
      case 'google_direct':
        return searchGoogleHtml(effectiveQuery, limit, config, 'www.google.com')
      case 'google_hk_direct':
        return searchGoogleHtml(effectiveQuery, limit, config, 'www.google.com.hk')
      case 'metaso':
        return searchMetaso(query, limit, config)
      case 'mojeek':
        return searchMojeekHtml(effectiveQuery, limit, config)
      case 'qwant_direct':
        return searchQwantHtml(effectiveQuery, limit, config)
      case 'reddit':
        return searchReddit(query, limit)
      case 'serper':
        return searchSerper(query, limit, config)
      case 'so360_direct':
        return searchSo360Html(effectiveQuery, limit, config)
      case 'sogou_direct':
        return searchSogouHtml(effectiveQuery, limit, config)
      case 'startpage_direct':
        return searchStartpageHtml(effectiveQuery, limit, config)
      case 'tavily':
        return searchTavily(query, limit, config)
      case 'toutiao_direct':
        return runProviders(query, getNested(config, ['siteSearchProviders'], DEFAULT_WEB_PROVIDERS), limit, SITE_MAP.toutiao, config).then((result) => result.items)
      case 'volcengine':
        return searchVolcengine(query, limit, config)
      case 'wikipedia':
        return searchWikipedia(effectiveQuery, limit)
      case 'wolfram_direct':
        return searchDuckDuckGoInstant(query, Math.min(limit, 5))
      case 'yahoo':
      case 'yahoo_direct':
        return searchYahooHtml(effectiveQuery, limit, config)
      case 'yandex':
        return searchYandexHtml(effectiveQuery, limit, config)
      case 'jisilu_direct':
        return runProviders(query, getNested(config, ['siteSearchProviders'], DEFAULT_WEB_PROVIDERS), limit, SITE_MAP.jisilu, config).then((result) => result.items)
      default:
        throw new Error(`Unsupported provider: ${provider}`)
    }
  })

  const settled = await Promise.allSettled(tasks)
  const errors = settled
    .filter((result) => result.status === 'rejected')
    .map((result) =>
      String(result.reason && result.reason.message ? result.reason.message : result.reason),
    )
  const items = dedupeItems(
    settled
      .filter((result) => result.status === 'fulfilled')
      .flatMap((result) => result.value),
  ).slice(0, limit)
  return {
    items,
    errors,
    providers: normalizedProviders,
  }
}

function resolvePlatforms(parsed, config, fallbackGroup) {
  const platforms = uniqueStrings(parseCommaList(parsed.values.platforms).map((platform) => normalizePlatformName(platform)))
  const group = normalizeWhitespace(parsed.values.group || fallbackGroup).toLowerCase()
  if (platforms.length > 0) {
    return platforms
  }
  if (group) {
    return PLATFORM_GROUPS[group] ? [...PLATFORM_GROUPS[group]] : []
  }
  return [...getNested(config, ['defaultUnionPlatforms'], PLATFORM_GROUPS.preferred)]
}

function listPlatformMetadata() {
  const platforms = uniqueStrings(PLATFORM_GROUPS.all)
  return platforms.map((platform) => ({
    id: platform,
    label: PLATFORM_LABELS[platform] || platform,
    site: SITE_MAP[platform] || null,
  }))
}

async function runPlatformSearch(platform, query, limit, config, fallbackProviders) {
  const normalizedPlatform = normalizePlatformName(platform)
  assertSearchProviderEnabled(normalizedPlatform)
  const startedAt = Date.now()
  const siteProviderList = uniqueStrings(
    getNested(config, ['siteSearchProviders'], fallbackProviders).map((provider) => normalizeProviderName(provider)),
  )
  try {
    let items = []
    let mode = 'provider'
    switch (normalizedPlatform) {
      case 'baidu':
      case 'baidu_direct':
        items = await searchBaidu(query, limit, config)
        break
      case 'bing':
      case 'bing_int_direct':
        items = await searchBing(query, limit, 'www', config)
        break
      case 'bing_cn_direct':
        items = await searchBing(query, limit, 'cn', config)
        break
      case 'brave':
      case 'brave_direct':
        items = await searchBraveHtml(query, limit, config)
        break
      case 'duckduckgo':
      case 'duckduckgo_html':
        items = await searchDuckDuckGoHtml(query, limit, config)
        break
      case 'duckduckgo_instant':
        items = await searchDuckDuckGoInstant(query, limit)
        break
      case 'ecosia_direct':
        items = await searchEcosiaHtml(query, limit, config)
        break
      case 'exa':
        items = await searchExa(query, limit, config)
        break
      case 'github':
        try {
          items = await searchGithub(query, limit, config)
        } catch {
          mode = 'site_fallback'
          items = (await runProviders(query, siteProviderList, limit, SITE_MAP.github, config)).items
        }
        break
      case 'google':
        items = await searchGoogle(query, limit, config)
        break
      case 'google_direct':
        items = await searchGoogleHtml(query, limit, config, 'www.google.com')
        break
      case 'google_hk_direct':
        items = await searchGoogleHtml(query, limit, config, 'www.google.com.hk')
        break
      case 'metaso':
        items = await searchMetaso(query, limit, config)
        break
      case 'mojeek':
        items = await searchMojeekHtml(query, limit, config)
        break
      case 'qwant_direct':
        items = await searchQwantHtml(query, limit, config)
        break
      case 'reddit':
        try {
          items = await searchReddit(query, limit)
        } catch {
          mode = 'site_fallback'
          items = (await runProviders(query, siteProviderList, limit, SITE_MAP.reddit, config)).items
        }
        break
      case 'rss':
        items = await searchRss(query, getNested(config, ['rssFeeds'], []), limit, config)
        break
      case 'serper':
        items = await searchSerper(query, limit, config)
        break
      case 'so360_direct':
        items = await searchSo360Html(query, limit, config)
        break
      case 'sogou_direct':
        items = await searchSogouHtml(query, limit, config)
        break
      case 'startpage_direct':
        items = await searchStartpageHtml(query, limit, config)
        break
      case 'tavily':
        items = await searchTavily(query, limit, config)
        break
      case 'volcengine':
        items = await searchVolcengine(query, limit, config)
        break
      case 'wikipedia':
        items = await searchWikipedia(query, limit)
        break
      case 'wolfram_direct':
        items = await searchDuckDuckGoInstant(query, limit)
        if (items.length === 0) {
          mode = 'site_fallback'
          items = (await runProviders(query, siteProviderList, limit, 'wolframalpha.com', config)).items
        }
        break
      case 'yahoo':
      case 'yahoo_direct':
        items = await searchYahooHtml(query, limit, config)
        break
      case 'yandex':
        items = await searchYandexHtml(query, limit, config)
        break
      case 'youtube':
        if (getApiKey(config, 'youtube')) {
          items = await searchYouTubeApi(query, limit, config)
        } else {
          mode = 'site_fallback'
          items = (await runProviders(query, siteProviderList, limit, SITE_MAP.youtube, config)).items
        }
        break
      default:
        if (!SITE_MAP[normalizedPlatform]) {
          throw new Error(`Unknown platform: ${normalizedPlatform}`)
        }
        mode = 'site_fallback'
        items = (await runProviders(query, siteProviderList, limit, SITE_MAP[normalizedPlatform], config)).items
        break
    }

    return {
      success: true,
      error: null,
      total: items.length,
      timing_ms: Date.now() - startedAt,
      items: markPlatform(items, normalizedPlatform),
      mode,
      label: PLATFORM_LABELS[normalizedPlatform] || normalizedPlatform,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      total: 0,
      timing_ms: Date.now() - startedAt,
      items: [],
      mode: 'error',
      label: PLATFORM_LABELS[normalizedPlatform] || normalizedPlatform,
    }
  }
}

async function runWebSearch(argv, config) {
  const parsed = parseArgv(argv)
  const query = normalizeWhitespace(parsed.values.query || parsed.positionals[0])
  if (!query) {
    throw new Error('web_search.internal requires --query')
  }
  const limit = clampLimit(parsed.values.limit, getNested(config, ['defaultLimit'], 5))
  const providers = parseCommaList(parsed.values.providers).map((provider) => normalizeProviderName(provider))
  const providerList = providers.length > 0 ? providers : getNested(config, ['defaultProviders'], DEFAULT_WEB_PROVIDERS)
  const site = normalizeWhitespace(parsed.values.site) || null
  const result = await runProviders(query, providerList, limit, site, config)
  return {
    query,
    items: result.items,
    providers: result.providers,
    site,
    errors: result.errors,
  }
}

async function runUnionSearch(argv, config) {
  const parsed = parseArgv(argv)
  if (parsed.flags.has('list-platforms')) {
    return {
      platforms: listPlatformMetadata(),
      groups: PLATFORM_GROUPS,
    }
  }
  if (parsed.flags.has('list-groups')) {
    return {
      groups: PLATFORM_GROUPS,
    }
  }

  const query = normalizeWhitespace(parsed.values.query || parsed.positionals[0])
  if (!query) {
    throw new Error('union_search.internal requires --query')
  }

  const limit = clampLimit(parsed.values.limit, getNested(config, ['defaultLimit'], 5))
  const preset = normalizeWhitespace(parsed.values.preset).toLowerCase()
  const perPlatformLimit = resolvePresetLimit(preset, limit)
  const platforms = resolvePlatforms(parsed, config)
  if (platforms.length === 0) {
    throw new Error('No platforms selected for union_search.internal')
  }

  const fallbackProviders = parseCommaList(parsed.values.providers).map((provider) => normalizeProviderName(provider))
  const providerList = fallbackProviders.length > 0 ? fallbackProviders : getNested(config, ['defaultProviders'], DEFAULT_WEB_PROVIDERS)
  const settled = await Promise.all(
    platforms.map(async (platform) => [platform, await runPlatformSearch(platform, query, perPlatformLimit, config, providerList)]),
  )

  const results = Object.fromEntries(settled)
  const mergedItems = settled.flatMap(([, result]) => result.items)
  const deduplicatedItems = dedupeItems(mergedItems)
  const successful = settled.filter(([, result]) => result.success).length
  const failed = settled.length - successful

  return {
    query,
    platforms,
    timestamp: new Date().toISOString(),
    results,
    items: parsed.flags.has('deduplicate') ? deduplicatedItems : mergedItems,
    summary: {
      total_platforms: settled.length,
      successful,
      failed,
      total_items: mergedItems.length,
      deduplicated_items: deduplicatedItems.length,
    },
  }
}

async function runSocialSearch(argv, config) {
  const parsed = parseArgv(argv)
  const query = normalizeWhitespace(parsed.values.query || parsed.positionals[0])
  if (!query) {
    throw new Error('social_search.internal requires --query')
  }

  const limit = clampLimit(parsed.values.limit, getNested(config, ['defaultLimit'], 5))
  const providers = parseCommaList(parsed.values.providers).map((provider) => normalizeProviderName(provider))
  const providerList = providers.length > 0 ? providers : getNested(config, ['defaultProviders'], DEFAULT_WEB_PROVIDERS)

  const platform = normalizePlatformName(parsed.values.platform)
  if (platform) {
    const result = await runPlatformSearch(platform, query, limit, config, providerList)
    return {
      query,
      platform,
      providers: providerList,
      ...result,
    }
  }

  return runUnionSearch(
    ['--query', query, '--group', 'social', '--limit', String(limit), '--providers', providerList.join(',')],
    config,
  )
}

async function runDevSearch(argv, config) {
  const parsed = parseArgv(argv)
  const query = normalizeWhitespace(parsed.values.query || parsed.positionals[0])
  if (!query) {
    throw new Error('dev_search.internal requires --query')
  }

  const limit = clampLimit(parsed.values.limit, getNested(config, ['defaultLimit'], 5))
  const providers = parseCommaList(parsed.values.providers).map((provider) => normalizeProviderName(provider))
  const providerList = providers.length > 0 ? providers : getNested(config, ['defaultProviders'], DEFAULT_WEB_PROVIDERS)
  const platform = normalizePlatformName(parsed.values.platform)

  if (platform) {
    const result = await runPlatformSearch(platform, query, limit, config, providerList)
    return {
      query,
      platform,
      providers: providerList,
      ...result,
    }
  }

  return runUnionSearch(
    ['--query', query, '--group', 'dev', '--limit', String(limit), '--providers', providerList.join(',')],
    config,
  )
}

async function runImageSearch(argv, config) {
  const parsed = parseArgv(argv)
  if (parsed.flags.has('list-platforms')) {
    return {
      providers: Object.keys(IMAGE_PROVIDER_LABELS).map((id) => ({
        id,
        label: IMAGE_PROVIDER_LABELS[id],
      })),
    }
  }

  const query = normalizeWhitespace(parsed.values.query || parsed.positionals[0])
  if (!query) {
    throw new Error('image_search.internal requires --query')
  }

  const limit = clampLimit(parsed.values.limit, 10)
  const providers = parseCommaList(parsed.values.providers).map((provider) => normalizeImageProviderName(provider))
  const providerList = providers.length > 0 ? providers : getNested(config, ['defaultImageProviders'], DEFAULT_IMAGE_PROVIDERS)

  const tasks = providerList.map(async (provider) => {
    switch (provider) {
      case 'baidu_images':
        return searchBaiduImages(query, limit, config)
      case 'bing_images':
        return searchBingImages(query, limit, config)
      case 'danbooru_images':
        return searchDanbooruImages(query, limit)
      case 'gelbooru_images':
        return searchGelbooruImages(query, limit)
      case 'google_images':
        return searchGoogleCustomSearch(query, limit, config, true)
      case 'huaban_images':
      case 'foodiesfeed_images':
        return searchPreviewImagesBySiteSearch(query, IMAGE_SITE_MAP[provider], limit, config)
      case 'pexels_images':
        return searchPexelsImages(query, limit, config)
      case 'pixabay_images':
        return searchPixabayImages(query, limit, config)
      case 'safebooru_images':
        return searchSafebooruImages(query, limit)
      case 'sogou_images':
        return searchPreviewImagesBySiteSearch(query, 'pic.sogou.com', limit, config)
      case 'so360_images':
        return searchSo360Images(query, limit, config)
      case 'unsplash_images':
        return searchUnsplashImages(query, limit, config)
      case 'volcengine_images':
        return searchVolcengineImages(query, limit, config)
      case 'yahoo_images':
      case 'yandex_images':
        return searchPreviewImagesBySiteSearch(query, IMAGE_SITE_MAP[provider], limit, config)
      default:
        throw new Error(`Unsupported image provider: ${provider}`)
    }
  })

  const settled = await Promise.allSettled(tasks)
  const errors = settled
    .filter((result) => result.status === 'rejected')
    .map((result) =>
      String(result.reason && result.reason.message ? result.reason.message : result.reason),
    )
  const items = dedupeItems(
    settled
      .filter((result) => result.status === 'fulfilled')
      .flatMap((result) => result.value),
  ).slice(0, limit)

  return {
    query,
    items,
    providers: providerList,
    errors,
  }
}

async function runRssSearchCommand(argv, config) {
  const parsed = parseArgv(argv)
  const query = normalizeWhitespace(parsed.values.query || parsed.positionals[0])
  if (!query) {
    throw new Error('rss_search.internal requires --query')
  }
  const feeds = parseCommaList(parsed.values.feeds)
  const feedList = feeds.length > 0 ? feeds : getNested(config, ['rssFeeds'], [])
  if (feedList.length === 0) {
    throw new Error('rss_search.internal requires configured feeds')
  }
  const limit = clampLimit(parsed.values.limit, getNested(config, ['defaultLimit'], 5))
  return {
    query,
    feeds: feedList,
    items: await searchRss(query, feedList, limit, config),
  }
}

async function runFetchUrl(scriptName, argv, config) {
  const parsed = parseArgv(argv)
  const url = normalizeWhitespace(parsed.values.url || parsed.positionals[0])
  const label = scriptName.replace(/\.internal$/i, '')
  if (!url) {
    throw new Error(`${scriptName} requires --url`)
  }
  const extract = normalizeWhitespace(parsed.values.extract)
  const payload = await fetchUrl(url, config, extract, resolveFetchUrlOptions(parsed, config), label)
  if (extract.toLowerCase() === 'jina') {
    payload.warnings = ['jina extractor has been disabled; used direct html fetching instead']
  }
  return payload
}

async function dispatch(scriptName, argv) {
  const config = readConfig()
  configureRequestClient(config)
  switch (scriptName) {
    case 'web_search.internal':
      return runWebSearch(argv, config)
    case 'union_search.internal':
      return runUnionSearch(argv, config)
    case 'social_search.internal':
      return runSocialSearch(argv, config)
    case 'dev_search.internal':
      return runDevSearch(argv, config)
    case 'image_search.internal':
      return runImageSearch(argv, config)
    case 'rss_search.internal':
      return runRssSearchCommand(argv, config)
    case 'fetch_url.internal':
    case 'visit_url.internal':
      return runFetchUrl(scriptName, argv, config)
    default:
      throw new Error(`Unknown union-search script: ${scriptName}`)
  }
}

async function main(scriptName, argv) {
  const outputOptions = parseOutputOptions(argv)
  const payload = await dispatch(scriptName, outputOptions.argv)
  const format =
    !outputOptions.formatExplicit && scriptName === 'visit_url.internal'
      ? 'markdown'
      : outputOptions.format
  const rendered = renderOutput(scriptName, payload, format, outputOptions.pretty)
  writeOutputFile(outputOptions.outputPath, rendered)
  process.stdout.write(`${rendered}\n`)
}

module.exports = {
  main,
  PLATFORM_GROUPS,
}
