const { URL } = require('node:url')

const { parseHTML } = require('./vendor/node_modules/linkedom')
const defuddleNode = require('./vendor/node_modules/defuddle/dist/node.js')

function normalizeWhitespace(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
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
    switch (lower) {
      case 'amp':
        return '&'
      case 'apos':
        return '\''
      case 'gt':
        return '>'
      case 'lt':
        return '<'
      case 'nbsp':
        return ' '
      case 'quot':
        return '"'
      default:
        return match
    }
  })
}

function truncateText(value, maxLength) {
  const normalized = normalizeWhitespace(value)
  if (!normalized) {
    return ''
  }
  if (!Number.isFinite(maxLength) || maxLength <= 0 || normalized.length <= maxLength) {
    return normalized
  }
  return `${normalized.slice(0, Math.max(1, maxLength - 1))}...`
}

function truncateMarkdown(markdown, maxChars) {
  if (!Number.isFinite(maxChars) || maxChars <= 0 || markdown.length <= maxChars) {
    return {
      value: markdown.trim(),
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
  const value = `${(kept.join('\n\n') || fallback).trimEnd()}\n\n[内容已截断]`
  return {
    value: value.trim(),
    truncated: true,
  }
}

function toAbsoluteUrl(rawUrl, baseUrl) {
  const candidate = normalizeWhitespace(rawUrl)
  if (!candidate) {
    return ''
  }
  try {
    return new URL(candidate, baseUrl).toString()
  } catch {
    return candidate
  }
}

function parseDocument(html, url) {
  const { document } = parseHTML(String(html || ''))
  if (!document.styleSheets) {
    document.styleSheets = []
  }
  if (document.defaultView && !document.defaultView.getComputedStyle) {
    document.defaultView.getComputedStyle = () => ({ display: '' })
  }
  if (url) {
    document.URL = url
  }
  return document
}

function getMetaContent(document, matcher) {
  const metas = Array.from(document.querySelectorAll('meta'))
  for (const meta of metas) {
    const name = normalizeWhitespace(meta.getAttribute('name') || '').toLowerCase()
    const property = normalizeWhitespace(meta.getAttribute('property') || '').toLowerCase()
    const httpEquiv = normalizeWhitespace(meta.getAttribute('http-equiv') || '').toLowerCase()
    if (matcher(name, property, httpEquiv)) {
      const content = normalizeWhitespace(meta.getAttribute('content') || '')
      if (content) {
        return decodeHtmlEntities(content)
      }
    }
  }
  return ''
}

function getCanonicalUrl(document, baseUrl) {
  const links = Array.from(document.querySelectorAll('link[rel]'))
  for (const link of links) {
    const rel = normalizeWhitespace(link.getAttribute('rel') || '').toLowerCase()
    if (rel === 'canonical') {
      return toAbsoluteUrl(link.getAttribute('href') || '', baseUrl)
    }
  }
  return ''
}

function collectHeadings(document, limit) {
  return Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'))
    .map((heading) => ({
      level: Number.parseInt(heading.tagName.slice(1), 10),
      text: truncateText(heading.textContent || '', 180),
    }))
    .filter((item) => item.text)
    .slice(0, limit)
}

function collectLinks(document, baseUrl, limit) {
  const seen = new Set()
  const items = []
  for (const link of Array.from(document.querySelectorAll('a[href]'))) {
    const url = toAbsoluteUrl(link.getAttribute('href') || '', baseUrl)
    if (!url || seen.has(url)) {
      continue
    }
    seen.add(url)
    items.push({
      text: truncateText(link.textContent || '', 140) || url,
      url,
      title: truncateText(link.getAttribute('title') || '', 140) || undefined,
    })
    if (items.length >= limit) {
      break
    }
  }
  return items
}

function collectImages(document, baseUrl, limit) {
  const seen = new Set()
  const items = []
  for (const image of Array.from(document.querySelectorAll('img[src], img[data-src]'))) {
    const url = toAbsoluteUrl(image.getAttribute('src') || image.getAttribute('data-src') || '', baseUrl)
    if (!url || seen.has(url)) {
      continue
    }
    seen.add(url)
    items.push({
      alt: truncateText(image.getAttribute('alt') || '', 160) || undefined,
      url,
      title: truncateText(image.getAttribute('title') || '', 160) || undefined,
    })
    if (items.length >= limit) {
      break
    }
  }
  return items
}

function buildMetadata(document, requestedUrl, finalUrl, responseMetadata, result) {
  const lang =
    normalizeWhitespace(result.language || '') ||
    normalizeWhitespace(document.documentElement?.getAttribute('lang') || '')
  const canonicalUrl =
    getCanonicalUrl(document, finalUrl) ||
    getMetaContent(document, (name, property) => property === 'og:url' || name === 'og:url')
  const keywords = getMetaContent(document, (name) => name === 'keywords')
  const modifiedAt =
    getMetaContent(document, (name, property, httpEquiv) =>
      property === 'article:modified_time' ||
      property === 'og:updated_time' ||
      name === 'last-modified' ||
      httpEquiv === 'last-modified',
    ) || normalizeWhitespace(responseMetadata.lastModified || '')

  return {
    requestedUrl,
    finalUrl,
    title: result.title || finalUrl,
    description: result.description || '',
    lang: lang || undefined,
    canonicalUrl: canonicalUrl || undefined,
    siteName: normalizeWhitespace(result.site || '') || undefined,
    author: normalizeWhitespace(result.author || '') || undefined,
    publishedAt: normalizeWhitespace(result.published || '') || undefined,
    modifiedAt: modifiedAt || undefined,
    keywords: keywords || undefined,
    contentType: normalizeWhitespace(responseMetadata.contentType || '') || undefined,
    status: Number.isFinite(responseMetadata.status) ? responseMetadata.status : undefined,
  }
}

async function extractPageContentWithDefuddle({
  html,
  requestedUrl,
  finalUrl,
  responseMetadata,
  options,
  engine,
  warnings,
}) {
  const effectiveOptions = options || {}
  const originalDocument = parseDocument(html, finalUrl)
  const result = await defuddleNode.Defuddle(originalDocument, finalUrl, {
    markdown: false,
    separateMarkdown: true,
    useAsync: false,
  })
  const cleanedHtml = String(result.content || '').trim()
  const contentMarkdown = String(result.contentMarkdown || '').trim()
  if (!cleanedHtml && !contentMarkdown) {
    throw new Error(`Defuddle returned no content for ${finalUrl}`)
  }

  const contentDocument = parseDocument(`<body>${cleanedHtml}</body>`, finalUrl)
  const headings =
    effectiveOptions.includeHeadings === false
      ? []
      : collectHeadings(contentDocument, effectiveOptions.maxHeadings || 32)
  const links =
    effectiveOptions.includeLinkIndex === false
      ? []
      : collectLinks(contentDocument, finalUrl, effectiveOptions.maxLinks || 40)
  const images =
    effectiveOptions.includeImageIndex === false
      ? []
      : collectImages(contentDocument, finalUrl, effectiveOptions.maxImages || 20)
  const content = truncateMarkdown(contentMarkdown || cleanedHtml, effectiveOptions.maxContentChars || 24000)
  const contentText = truncateText(contentDocument.body?.textContent || cleanedHtml, 4000)

  return {
    title: result.title || finalUrl,
    url: requestedUrl,
    finalUrl,
    description: result.description || '',
    content: content.value,
    contentFormat: 'markdown',
    contentText,
    engine,
    headings,
    links,
    images,
    metadata:
      effectiveOptions.includeMetadata === false
        ? null
        : buildMetadata(originalDocument, requestedUrl, finalUrl, responseMetadata || {}, result),
    warnings: Array.isArray(warnings) ? warnings.filter(Boolean) : [],
    truncated: content.truncated,
  }
}

module.exports = {
  extractPageContentWithDefuddle,
}
