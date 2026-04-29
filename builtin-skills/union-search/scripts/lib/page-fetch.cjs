const { URL } = require('node:url')

const VOID_TAGS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
])

const BLOCK_TAGS = new Set([
  'address',
  'article',
  'aside',
  'blockquote',
  'body',
  'caption',
  'details',
  'div',
  'dl',
  'fieldset',
  'figcaption',
  'figure',
  'footer',
  'form',
  'header',
  'li',
  'main',
  'nav',
  'ol',
  'p',
  'pre',
  'section',
  'summary',
  'table',
  'tbody',
  'td',
  'tfoot',
  'th',
  'thead',
  'tr',
  'ul',
])

const SKIP_TAGS = new Set([
  'canvas',
  'form',
  'input',
  'noscript',
  'script',
  'select',
  'style',
  'svg',
  'template',
  'textarea',
])

const PRIORITY_BY_TAG = {
  article: 140,
  main: 130,
  section: 75,
  div: 55,
  body: 40,
}

const POSITIVE_HINT_PATTERN = /\b(article|body|content|entry|main|markdown|post|prose|read|story|text)\b/i
const NEGATIVE_HINT_PATTERN =
  /\b(ad|ads|advert|banner|breadcrumb|comment|footer|header|hero|menu|nav|pagination|promo|related|share|sidebar|social|subscribe|toolbar)\b/i

const ENTITY_MAP = {
  amp: '&',
  apos: '\'',
  gt: '>',
  lt: '<',
  nbsp: ' ',
  quot: '"',
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

function normalizeWhitespace(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
}

function sanitizeUrl(value) {
  return normalizeWhitespace(decodeHtmlEntities(value))
}

function toAbsoluteUrl(rawUrl, baseUrl) {
  const candidate = sanitizeUrl(rawUrl)
  if (!candidate) {
    return ''
  }
  try {
    return new URL(candidate, baseUrl).toString()
  } catch {
    return candidate
  }
}

function escapeMarkdownInline(value) {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/\|/g, '\\|')
    .replace(/`/g, '\\`')
}

function truncateText(value, maxLength) {
  const normalized = normalizeWhitespace(value)
  if (!normalized) {
    return ''
  }
  if (normalized.length <= maxLength) {
    return normalized
  }
  return `${normalized.slice(0, Math.max(1, maxLength - 1))}...`
}

function isSupportedAbsoluteUrl(value) {
  try {
    const parsed = new URL(String(value || ''))
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

function parseAttributes(source) {
  const attributes = {}
  const pattern = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g
  let match = pattern.exec(source)
  while (match) {
    const key = String(match[1] || '').toLowerCase()
    const value = decodeHtmlEntities(match[2] || match[3] || match[4] || '')
    if (key) {
      attributes[key] = value
    }
    match = pattern.exec(source)
  }
  return attributes
}

function parseHtmlFragment(html) {
  const root = { type: 'element', tag: 'root', attrs: {}, children: [] }
  const stack = [root]
  const tokenPattern = /<!--[\s\S]*?-->|<!DOCTYPE[\s\S]*?>|<\/?[a-zA-Z][^>]*>|[^<]+/gi
  let match = tokenPattern.exec(String(html || ''))

  while (match) {
    const token = match[0]
    if (!token) {
      match = tokenPattern.exec(String(html || ''))
      continue
    }

    if (token.startsWith('<!--') || /^<!DOCTYPE/i.test(token)) {
      match = tokenPattern.exec(String(html || ''))
      continue
    }

    if (token.startsWith('</')) {
      const closingTag = String(token.slice(2).match(/^[^\s>]+/)?.[0] || '').toLowerCase()
      if (closingTag) {
        for (let index = stack.length - 1; index > 0; index -= 1) {
          if (stack[index].tag === closingTag) {
            stack.length = index
            break
          }
        }
      }
      match = tokenPattern.exec(String(html || ''))
      continue
    }

    if (token.startsWith('<')) {
      const openingMatch = token.match(/^<\s*([^\s/>]+)/)
      const tag = String(openingMatch?.[1] || '').toLowerCase()
      if (!tag) {
        match = tokenPattern.exec(String(html || ''))
        continue
      }
      const attrs = parseAttributes(token)
      const node = { type: 'element', tag, attrs, children: [] }
      stack[stack.length - 1].children.push(node)
      const selfClosing = token.endsWith('/>') || VOID_TAGS.has(tag)
      if (!selfClosing) {
        stack.push(node)
      }
      match = tokenPattern.exec(String(html || ''))
      continue
    }

    const decoded = decodeHtmlEntities(token)
    if (decoded) {
      stack[stack.length - 1].children.push({ type: 'text', value: decoded })
    }
    match = tokenPattern.exec(String(html || ''))
  }

  return root
}

function stripRemovableBlocks(html) {
  let cleaned = String(html || '')
  const removableTags = ['script', 'style', 'noscript', 'template', 'svg', 'canvas']
  for (const tag of removableTags) {
    const pattern = new RegExp(`<${tag}\\b[\\s\\S]*?<\\/${tag}>`, 'gi')
    cleaned = cleaned.replace(pattern, '')
  }
  return cleaned
}

function extractBodyHtml(html) {
  const cleaned = stripRemovableBlocks(html)
  const bodyMatch = cleaned.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)
  if (bodyMatch?.[1]) {
    return bodyMatch[1]
  }
  return cleaned
}

function extractText(node, options) {
  if (!node) {
    return ''
  }
  const settings = options || {}
  if (node.type === 'text') {
    return settings.preserveWhitespace ? String(node.value || '') : normalizeWhitespace(node.value)
  }
  if (!node.children || SKIP_TAGS.has(node.tag)) {
    return ''
  }
  if (node.tag === 'br') {
    return settings.preserveWhitespace ? '\n' : ' '
  }
  if (node.tag === 'pre') {
    return node.children.map((child) => extractText(child, { preserveWhitespace: true })).join('')
  }
  const parts = node.children
    .map((child) => extractText(child, settings))
    .filter(Boolean)
  return settings.preserveWhitespace ? parts.join('') : normalizeWhitespace(parts.join(' '))
}

function walk(node, visitor) {
  if (!node) {
    return
  }
  visitor(node)
  if (!node.children) {
    return
  }
  for (const child of node.children) {
    walk(child, visitor)
  }
}

function getHintText(node) {
  return normalizeWhitespace(
    [node.attrs?.id || '', node.attrs?.class || '', node.attrs?.role || '', node.attrs?.['aria-label'] || ''].join(
      ' ',
    ),
  )
}

function isSkippableNode(node) {
  if (!node || node.type !== 'element') {
    return false
  }
  if (SKIP_TAGS.has(node.tag)) {
    return true
  }
  const hintText = getHintText(node)
  if (!hintText) {
    return false
  }
  return NEGATIVE_HINT_PATTERN.test(hintText) && !POSITIVE_HINT_PATTERN.test(hintText)
}

function selectPrimaryNode(root) {
  let bestNode = null
  let bestScore = -Infinity

  walk(root, (node) => {
    if (!node || node.type !== 'element' || node.tag === 'root' || isSkippableNode(node)) {
      return
    }

    const textLength = extractText(node).length
    if (textLength < 80) {
      return
    }

    const hintText = getHintText(node)
    let score = Math.min(textLength, 12000) / 40
    score += PRIORITY_BY_TAG[node.tag] || 0

    if (POSITIVE_HINT_PATTERN.test(hintText)) {
      score += 60
    }
    if (NEGATIVE_HINT_PATTERN.test(hintText)) {
      score -= 90
    }
    if (node.tag === 'nav' || node.tag === 'aside' || node.tag === 'footer' || node.tag === 'header') {
      score -= 140
    }

    if (score > bestScore) {
      bestScore = score
      bestNode = node
    }
  })

  return bestNode || root
}

function compactInline(value) {
  return String(value || '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

function cleanupMarkdown(value) {
  const lines = String(value || '')
    .replace(/\r\n?/g, '\n')
    .split('\n')

  const cleaned = []
  let blankCount = 0
  let inFence = false

  for (const rawLine of lines) {
    const line = rawLine.replace(/[ \t]+$/g, '')
    if (/^```/.test(line.trim())) {
      inFence = !inFence
      blankCount = 0
      cleaned.push(line)
      continue
    }

    if (!inFence && line.trim() === '') {
      blankCount += 1
      if (blankCount > 2) {
        continue
      }
      cleaned.push('')
      continue
    }

    blankCount = 0
    cleaned.push(line)
  }

  return cleaned.join('\n').trim()
}

function indentLines(value, prefix, exceptFirstPrefix) {
  const lines = String(value || '').split('\n')
  return lines
    .map((line, index) => `${index === 0 ? exceptFirstPrefix : prefix}${line}`)
    .join('\n')
}

function renderChildren(nodes, context) {
  return nodes.map((node) => renderNode(node, context)).join('')
}

function renderInlineChildren(nodes, context) {
  const rendered = nodes.map((node) => renderInlineNode(node, context)).join('')
  return compactInline(rendered)
}

function renderInlineNode(node, context) {
  if (!node) {
    return ''
  }
  if (node.type === 'text') {
    return context?.preserveWhitespace ? String(node.value || '') : String(node.value || '').replace(/\s+/g, ' ')
  }
  if (isSkippableNode(node)) {
    return ''
  }

  switch (node.tag) {
    case 'br':
      return '\n'
    case 'code':
      if (context?.inPre) {
        return extractText(node, { preserveWhitespace: true })
      }
      return `\`${compactInline(renderInlineChildren(node.children || [], context))}\``
    case 'strong':
    case 'b': {
      const content = compactInline(renderInlineChildren(node.children || [], context))
      return content ? `**${content}**` : ''
    }
    case 'em':
    case 'i': {
      const content = compactInline(renderInlineChildren(node.children || [], context))
      return content ? `*${content}*` : ''
    }
    case 'del':
    case 's': {
      const content = compactInline(renderInlineChildren(node.children || [], context))
      return content ? `~~${content}~~` : ''
    }
    case 'a': {
      const href = toAbsoluteUrl(node.attrs?.href || '', context?.baseUrl || '')
      const text = compactInline(renderInlineChildren(node.children || [], context)) || href
      if (!href) {
        return text
      }
      return `[${text}](${href})`
    }
    case 'img': {
      const src = toAbsoluteUrl(node.attrs?.src || node.attrs?.['data-src'] || '', context?.baseUrl || '')
      if (!src) {
        return ''
      }
      const alt = compactInline(node.attrs?.alt || '')
      return `![${alt}](${src})`
    }
    default:
      if (BLOCK_TAGS.has(node.tag)) {
        return renderNode(node, context)
      }
      return renderInlineChildren(node.children || [], context)
  }
}

function renderList(node, context) {
  const ordered = node.tag === 'ol'
  const depth = context?.listDepth || 0
  const items = (node.children || []).filter((child) => child.type === 'element' && child.tag === 'li')
  let index = Number.parseInt(String(node.attrs?.start || '1'), 10)
  if (!Number.isFinite(index) || index <= 0) {
    index = 1
  }

  const lines = []
  for (const item of items) {
    const marker = ordered ? `${index}. ` : '- '
    const nestedContext = { ...context, listDepth: depth + 1 }
    const rendered = cleanupMarkdown(renderChildren(item.children || [], nestedContext))
    if (!rendered) {
      index += 1
      continue
    }
    const indent = '  '.repeat(depth)
    const continuation = `${indent}${' '.repeat(marker.length)}`
    lines.push(indentLines(rendered, continuation, `${indent}${marker}`))
    index += 1
  }

  return lines.join('\n')
}

function collectTableRows(node) {
  const rows = []
  walk(node, (candidate) => {
    if (!candidate || candidate.type !== 'element' || candidate.tag !== 'tr') {
      return
    }
    const cells = (candidate.children || [])
      .filter((child) => child.type === 'element' && (child.tag === 'th' || child.tag === 'td'))
      .map((child) => compactInline(renderInlineChildren(child.children || [], { baseUrl: '' })))
    if (cells.length > 0) {
      rows.push(cells)
    }
  })
  return rows
}

function renderTable(node) {
  const rows = collectTableRows(node)
  if (rows.length === 0) {
    return ''
  }

  const width = rows.reduce((max, row) => Math.max(max, row.length), 0)
  const normalizedRows = rows.map((row) => {
    const copy = [...row]
    while (copy.length < width) {
      copy.push('')
    }
    return copy.map((cell) => escapeMarkdownInline(cell))
  })

  const header = normalizedRows[0]
  const divider = header.map(() => '---')
  const body = normalizedRows.slice(1)
  const lines = [
    `| ${header.join(' | ')} |`,
    `| ${divider.join(' | ')} |`,
    ...body.map((row) => `| ${row.join(' | ')} |`),
  ]

  return lines.join('\n')
}

function renderBlockquote(node, context) {
  const body = cleanupMarkdown(renderChildren(node.children || [], context))
  if (!body) {
    return ''
  }
  return body
    .split('\n')
    .map((line) => (line ? `> ${line}` : '>'))
    .join('\n')
}

function renderNode(node, context) {
  if (!node) {
    return ''
  }
  if (node.type === 'text') {
    return context?.preserveWhitespace ? String(node.value || '') : String(node.value || '').replace(/\s+/g, ' ')
  }
  if (isSkippableNode(node)) {
    return ''
  }

  switch (node.tag) {
    case 'root':
    case 'body':
    case 'main':
    case 'article':
    case 'section':
    case 'div':
    case 'header':
    case 'footer':
    case 'aside':
    case 'nav':
    case 'figure':
    case 'details':
      return `\n\n${renderChildren(node.children || [], context)}\n\n`
    case 'summary': {
      const summary = compactInline(renderInlineChildren(node.children || [], context))
      return summary ? `\n\n**${summary}**\n\n` : ''
    }
    case 'figcaption': {
      const caption = compactInline(renderInlineChildren(node.children || [], context))
      return caption ? `\n\n*${caption}*\n\n` : ''
    }
    case 'p': {
      const paragraph = compactInline(renderInlineChildren(node.children || [], context))
      return paragraph ? `\n\n${paragraph}\n\n` : ''
    }
    case 'br':
      return '\n'
    case 'hr':
      return '\n\n---\n\n'
    case 'h1':
    case 'h2':
    case 'h3':
    case 'h4':
    case 'h5':
    case 'h6': {
      const level = Number.parseInt(node.tag.slice(1), 10)
      const heading = compactInline(renderInlineChildren(node.children || [], context))
      return heading ? `\n\n${'#'.repeat(level)} ${heading}\n\n` : ''
    }
    case 'ul':
    case 'ol': {
      const list = renderList(node, context)
      return list ? `\n\n${list}\n\n` : ''
    }
    case 'blockquote': {
      const quote = renderBlockquote(node, context)
      return quote ? `\n\n${quote}\n\n` : ''
    }
    case 'pre': {
      const raw = extractText(node, { preserveWhitespace: true }).trimEnd()
      if (!raw) {
        return ''
      }
      const codeNode = (node.children || []).find((child) => child.type === 'element' && child.tag === 'code')
      const className = String(codeNode?.attrs?.class || node.attrs?.class || '')
      const languageMatch = className.match(/language-([a-z0-9_-]+)/i)
      const language = languageMatch?.[1] || ''
      return `\n\n\`\`\`${language}\n${raw}\n\`\`\`\n\n`
    }
    case 'table': {
      const table = renderTable(node)
      return table ? `\n\n${table}\n\n` : ''
    }
    default:
      if (BLOCK_TAGS.has(node.tag)) {
        return `\n\n${renderChildren(node.children || [], context)}\n\n`
      }
      return renderInlineNode(node, context)
  }
}

function collectLinks(node, baseUrl, limit) {
  const items = []
  const seen = new Set()
  walk(node, (candidate) => {
    if (items.length >= limit || !candidate || candidate.type !== 'element' || candidate.tag !== 'a') {
      return
    }
    const url = toAbsoluteUrl(candidate.attrs?.href || '', baseUrl)
    if (!isSupportedAbsoluteUrl(url)) {
      return
    }
    const text = truncateText(extractText(candidate), 140) || url
    const key = `${url}|${text}`
    if (seen.has(key)) {
      return
    }
    seen.add(key)
    items.push({
      text,
      url,
      title: truncateText(candidate.attrs?.title || '', 140) || undefined,
    })
  })
  return items
}

function collectImages(node, baseUrl, limit) {
  const items = []
  const seen = new Set()
  walk(node, (candidate) => {
    if (items.length >= limit || !candidate || candidate.type !== 'element' || candidate.tag !== 'img') {
      return
    }
    const url = toAbsoluteUrl(candidate.attrs?.src || candidate.attrs?.['data-src'] || '', baseUrl)
    if (!isSupportedAbsoluteUrl(url) || seen.has(url)) {
      return
    }
    seen.add(url)
    items.push({
      alt: truncateText(candidate.attrs?.alt || '', 160),
      url,
      title: truncateText(candidate.attrs?.title || '', 160) || undefined,
    })
  })
  return items
}

function collectHeadings(node, limit) {
  const items = []
  walk(node, (candidate) => {
    if (
      items.length >= limit ||
      !candidate ||
      candidate.type !== 'element' ||
      !/^h[1-6]$/.test(candidate.tag)
    ) {
      return
    }
    const text = truncateText(extractText(candidate), 180)
    if (!text) {
      return
    }
    items.push({
      level: Number.parseInt(candidate.tag.slice(1), 10),
      text,
    })
  })
  return items
}

function truncateMarkdown(markdown, maxChars) {
  if (!Number.isFinite(maxChars) || maxChars <= 0 || markdown.length <= maxChars) {
    return {
      value: markdown,
      truncated: false,
    }
  }

  const chunks = markdown.split(/\n{2,}/)
  const kept = []
  let currentLength = 0

  for (const chunk of chunks) {
    const addition = kept.length === 0 ? chunk.length : chunk.length + 2
    if (kept.length > 0 && currentLength + addition > maxChars) {
      break
    }
    if (kept.length === 0 && chunk.length > maxChars) {
      kept.push(chunk.slice(0, Math.max(1, maxChars - 18)).trimEnd())
      currentLength = kept[0].length
      break
    }
    kept.push(chunk)
    currentLength += addition
  }

  const fallback = markdown.slice(0, Math.max(1, maxChars - 18)).trimEnd()
  const value = cleanupMarkdown(`${(kept.join('\n\n') || fallback).trimEnd()}\n\n[内容已截断]`)
  return {
    value,
    truncated: true,
  }
}

function extractMetaMap(html) {
  const meta = {}
  const metaPattern = /<meta\b[^>]*>/gi
  let match = metaPattern.exec(String(html || ''))
  while (match) {
    const attrs = parseAttributes(match[0])
    const key = String(attrs.name || attrs.property || attrs['http-equiv'] || '').toLowerCase()
    const content = normalizeWhitespace(attrs.content || '')
    if (key && content && !(key in meta)) {
      meta[key] = content
    }
    match = metaPattern.exec(String(html || ''))
  }
  return meta
}

function extractLinkMap(html, baseUrl) {
  const links = {}
  const linkPattern = /<link\b[^>]*>/gi
  let match = linkPattern.exec(String(html || ''))
  while (match) {
    const attrs = parseAttributes(match[0])
    const rel = String(attrs.rel || '').toLowerCase()
    const href = toAbsoluteUrl(attrs.href || '', baseUrl)
    if (!rel || !href) {
      match = linkPattern.exec(String(html || ''))
      continue
    }
    links[rel] = href
    match = linkPattern.exec(String(html || ''))
  }
  return links
}

function extractMetadata(html, requestedUrl, finalUrl, responseMetadata) {
  const meta = extractMetaMap(html)
  const linkMap = extractLinkMap(html, finalUrl)
  const titleMatch = String(html || '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  const htmlMatch = String(html || '').match(/<html\b[^>]*lang="([^"]+)"/i)
  const keywords = normalizeWhitespace(meta.keywords || '')
  const contentTypeHeader = responseMetadata?.contentType
  const lastModifiedHeader = responseMetadata?.lastModified

  return {
    requestedUrl,
    finalUrl,
    title:
      normalizeWhitespace(decodeHtmlEntities(titleMatch?.[1] || '')) ||
      normalizeWhitespace(meta['og:title'] || meta['twitter:title'] || '') ||
      finalUrl,
    description:
      normalizeWhitespace(meta.description || meta['og:description'] || meta['twitter:description'] || '') || '',
    lang: normalizeWhitespace(htmlMatch?.[1] || meta['og:locale'] || '') || undefined,
    canonicalUrl: linkMap.canonical || undefined,
    siteName: normalizeWhitespace(meta['og:site_name'] || '') || undefined,
    author: normalizeWhitespace(meta.author || '') || undefined,
    publishedAt:
      normalizeWhitespace(meta['article:published_time'] || meta['og:published_time'] || meta.pubdate || '') ||
      undefined,
    modifiedAt:
      normalizeWhitespace(meta['article:modified_time'] || meta['last-modified'] || lastModifiedHeader || '') ||
      undefined,
    keywords: keywords || undefined,
    contentType:
      Array.isArray(contentTypeHeader) && contentTypeHeader.length > 0
        ? contentTypeHeader.join(', ')
        : typeof contentTypeHeader === 'string'
          ? contentTypeHeader
          : undefined,
    status: responseMetadata?.status,
  }
}

function extractPageContent(html, options) {
  const settings = options || {}
  const requestedUrl = settings.requestedUrl || ''
  const finalUrl = settings.finalUrl || requestedUrl
  const bodyHtml = extractBodyHtml(html)
  const parsed = parseHtmlFragment(bodyHtml)
  const primaryNode = selectPrimaryNode(parsed)
  const rendered = cleanupMarkdown(renderNode(primaryNode, { baseUrl: finalUrl, listDepth: 0 }))
  const truncatedContent = truncateMarkdown(rendered, settings.maxContentChars)
  const textContent = truncateText(extractText(primaryNode), settings.maxContentChars || 24000)

  const headings = settings.includeHeadings === false ? [] : collectHeadings(primaryNode, settings.maxHeadings || 32)
  const links = settings.includeLinkIndex === false ? [] : collectLinks(primaryNode, finalUrl, settings.maxLinks || 40)
  const images =
    settings.includeImageIndex === false ? [] : collectImages(primaryNode, finalUrl, settings.maxImages || 20)
  const metadata = settings.includeMetadata === false
    ? null
    : extractMetadata(html, requestedUrl, finalUrl, {
        contentType: settings.contentType,
        lastModified: settings.lastModified,
        status: settings.status,
      })

  return {
    title: metadata?.title || finalUrl,
    url: requestedUrl,
    finalUrl,
    description: metadata?.description || '',
    content: truncatedContent.value,
    contentFormat: 'markdown',
    contentText: textContent,
    engine: 'html',
    headings,
    links,
    images,
    metadata,
    truncated: truncatedContent.truncated,
  }
}

module.exports = {
  extractPageContent,
}
