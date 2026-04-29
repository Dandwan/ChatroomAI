(() => {
  const options = globalThis.__CHATROOMAI_BROWSER_EXTRACTOR_OPTIONS || {}

  const maxContentChars = Number.isFinite(Number(options.maxContentChars))
    ? Math.max(1, Math.round(Number(options.maxContentChars)))
    : 24000
  const maxLinks = Number.isFinite(Number(options.maxLinks))
    ? Math.max(1, Math.round(Number(options.maxLinks)))
    : 40
  const maxImages = Number.isFinite(Number(options.maxImages))
    ? Math.max(1, Math.round(Number(options.maxImages)))
    : 20
  const maxHeadings = Number.isFinite(Number(options.maxHeadings))
    ? Math.max(1, Math.round(Number(options.maxHeadings)))
    : 32
  const includeMetadata = options.includeMetadata !== false
  const includeHeadings = options.includeHeadings !== false
  const includeLinkIndex = options.includeLinkIndex !== false
  const includeImageIndex = options.includeImageIndex !== false

  const SKIP_TAGS = new Set([
    'SCRIPT',
    'STYLE',
    'NOSCRIPT',
    'TEMPLATE',
    'SVG',
    'CANVAS',
    'FORM',
    'INPUT',
    'SELECT',
    'TEXTAREA',
  ])

  const BLOCK_TAGS = new Set([
    'ARTICLE',
    'ASIDE',
    'BLOCKQUOTE',
    'BODY',
    'DETAILS',
    'DIV',
    'FIGCAPTION',
    'FIGURE',
    'FOOTER',
    'HEADER',
    'LI',
    'MAIN',
    'NAV',
    'OL',
    'P',
    'PRE',
    'SECTION',
    'TABLE',
    'TBODY',
    'TD',
    'TFOOT',
    'TH',
    'THEAD',
    'TR',
    'UL',
  ])

  const POSITIVE_HINT_PATTERN = /\b(article|answer|body|content|entry|main|post|prose|question|richtext|text)\b/i
  const NEGATIVE_HINT_PATTERN =
    /\b(ad|ads|advert|banner|breadcrumb|comment|footer|header|login|menu|nav|pagination|promo|related|share|sidebar|subscribe|toolbar)\b/i

  const normalizeWhitespace = (value) =>
    String(value || '')
      .replace(/\s+/g, ' ')
      .trim()

  const truncateText = (value, maxLength) => {
    const normalized = normalizeWhitespace(value)
    if (!normalized) {
      return ''
    }
    if (normalized.length <= maxLength) {
      return normalized
    }
    return `${normalized.slice(0, Math.max(1, maxLength - 3))}...`
  }

  const escapeMarkdownInline = (value) =>
    String(value || '')
      .replace(/\\/g, '\\\\')
      .replace(/\[/g, '\\[')
      .replace(/\]/g, '\\]')
      .replace(/\|/g, '\\|')
      .replace(/`/g, '\\`')

  const toAbsoluteUrl = (value) => {
    const normalized = normalizeWhitespace(value)
    if (!normalized) {
      return ''
    }
    try {
      return new URL(normalized, location.href).toString()
    } catch {
      return normalized
    }
  }

  const getHintText = (element) =>
    normalizeWhitespace(
      [
        element.id || '',
        element.className || '',
        element.getAttribute('role') || '',
        element.getAttribute('aria-label') || '',
      ].join(' '),
    )

  const isSkippableElement = (element) => {
    if (!(element instanceof Element)) {
      return false
    }
    if (SKIP_TAGS.has(element.tagName)) {
      return true
    }
    const hintText = getHintText(element)
    return Boolean(hintText) && NEGATIVE_HINT_PATTERN.test(hintText) && !POSITIVE_HINT_PATTERN.test(hintText)
  }

  const extractText = (node, preserveWhitespace = false) => {
    if (!node) {
      return ''
    }
    if (node.nodeType === Node.TEXT_NODE) {
      return preserveWhitespace ? node.textContent || '' : normalizeWhitespace(node.textContent || '')
    }
    if (!(node instanceof Element) || isSkippableElement(node)) {
      return ''
    }
    if (node.tagName === 'BR') {
      return preserveWhitespace ? '\n' : ' '
    }
    if (node.tagName === 'PRE') {
      return Array.from(node.childNodes)
        .map((child) => extractText(child, true))
        .join('')
    }
    const parts = Array.from(node.childNodes)
      .map((child) => extractText(child, preserveWhitespace))
      .filter(Boolean)
    return preserveWhitespace ? parts.join('') : normalizeWhitespace(parts.join(' '))
  }

  const selectCandidateRoot = () => {
    const directSelectors = [
      'article',
      'main',
      '[role="main"]',
      '.Post-RichTextContainer',
      '.Question-mainColumn',
      '.RichText',
      '.RichContent',
      '.QuestionPage',
    ]

    for (const selector of directSelectors) {
      const candidate = document.querySelector(selector)
      if (candidate && extractText(candidate).length >= 120) {
        return candidate
      }
    }

    const candidates = Array.from(
      document.querySelectorAll('article, main, section, div, body'),
    )

    let best = document.body
    let bestScore = -Infinity
    for (const candidate of candidates) {
      if (!(candidate instanceof Element) || isSkippableElement(candidate)) {
        continue
      }
      const textLength = extractText(candidate).length
      if (textLength < 80) {
        continue
      }

      const hintText = getHintText(candidate)
      let score = Math.min(textLength, 12000) / 40
      if (candidate.tagName === 'ARTICLE') score += 120
      if (candidate.tagName === 'MAIN') score += 110
      if (candidate.tagName === 'SECTION') score += 70
      if (candidate.tagName === 'DIV') score += 40
      if (POSITIVE_HINT_PATTERN.test(hintText)) score += 60
      if (NEGATIVE_HINT_PATTERN.test(hintText)) score -= 100
      if (candidate.tagName === 'NAV' || candidate.tagName === 'ASIDE' || candidate.tagName === 'FOOTER') {
        score -= 140
      }

      if (score > bestScore) {
        bestScore = score
        best = candidate
      }
    }

    return best || document.body
  }

  const compactInline = (value) =>
    String(value || '')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n[ \t]+/g, '\n')
      .replace(/[ \t]{2,}/g, ' ')
      .trim()

  const cleanupMarkdown = (value) => {
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

  const indentLines = (value, prefix, firstPrefix) =>
    String(value || '')
      .split('\n')
      .map((line, index) => `${index === 0 ? firstPrefix : prefix}${line}`)
      .join('\n')

  const renderInlineChildren = (nodes, context) =>
    compactInline(Array.from(nodes).map((node) => renderInlineNode(node, context)).join(''))

  const renderInlineNode = (node, context) => {
    if (!node) {
      return ''
    }
    if (node.nodeType === Node.TEXT_NODE) {
      return context && context.preserveWhitespace
        ? node.textContent || ''
        : String(node.textContent || '').replace(/\s+/g, ' ')
    }
    if (!(node instanceof Element) || isSkippableElement(node)) {
      return ''
    }

    switch (node.tagName) {
      case 'BR':
        return '\n'
      case 'CODE':
        return context && context.inPre
          ? extractText(node, true)
          : `\`${compactInline(renderInlineChildren(node.childNodes, context))}\``
      case 'STRONG':
      case 'B': {
        const content = compactInline(renderInlineChildren(node.childNodes, context))
        return content ? `**${content}**` : ''
      }
      case 'EM':
      case 'I': {
        const content = compactInline(renderInlineChildren(node.childNodes, context))
        return content ? `*${content}*` : ''
      }
      case 'DEL':
      case 'S': {
        const content = compactInline(renderInlineChildren(node.childNodes, context))
        return content ? `~~${content}~~` : ''
      }
      case 'A': {
        const href = toAbsoluteUrl(node.getAttribute('href') || '')
        const text = compactInline(renderInlineChildren(node.childNodes, context)) || href
        return href ? `[${text}](${href})` : text
      }
      case 'IMG': {
        const src = toAbsoluteUrl(node.getAttribute('src') || node.getAttribute('data-src') || '')
        if (!src) {
          return ''
        }
        const alt = compactInline(node.getAttribute('alt') || '')
        return `![${alt}](${src})`
      }
      default:
        if (BLOCK_TAGS.has(node.tagName)) {
          return renderNode(node, context)
        }
        return renderInlineChildren(node.childNodes, context)
    }
  }

  const renderList = (element, context) => {
    const ordered = element.tagName === 'OL'
    const depth = context && Number.isFinite(context.listDepth) ? context.listDepth : 0
    const items = Array.from(element.children).filter((child) => child.tagName === 'LI')
    let currentIndex = Number.parseInt(element.getAttribute('start') || '1', 10)
    if (!Number.isFinite(currentIndex) || currentIndex <= 0) {
      currentIndex = 1
    }

    const lines = []
    for (const item of items) {
      const marker = ordered ? `${currentIndex}. ` : '- '
      const rendered = cleanupMarkdown(renderChildren(item.childNodes, { ...context, listDepth: depth + 1 }))
      if (!rendered) {
        currentIndex += 1
        continue
      }
      const indent = '  '.repeat(depth)
      const continuation = `${indent}${' '.repeat(marker.length)}`
      lines.push(indentLines(rendered, continuation, `${indent}${marker}`))
      currentIndex += 1
    }

    return lines.join('\n')
  }

  const renderTable = (element) => {
    const rows = Array.from(element.querySelectorAll('tr'))
      .map((row) =>
        Array.from(row.children)
          .filter((child) => child.tagName === 'TH' || child.tagName === 'TD')
          .map((child) => escapeMarkdownInline(compactInline(renderInlineChildren(child.childNodes, {})))),
      )
      .filter((row) => row.length > 0)

    if (rows.length === 0) {
      return ''
    }

    const width = rows.reduce((max, row) => Math.max(max, row.length), 0)
    const normalizedRows = rows.map((row) => {
      const copy = [...row]
      while (copy.length < width) {
        copy.push('')
      }
      return copy
    })

    const header = normalizedRows[0]
    const divider = header.map(() => '---')
    return [
      `| ${header.join(' | ')} |`,
      `| ${divider.join(' | ')} |`,
      ...normalizedRows.slice(1).map((row) => `| ${row.join(' | ')} |`),
    ].join('\n')
  }

  const renderChildren = (nodes, context) =>
    Array.from(nodes).map((node) => renderNode(node, context)).join('')

  const renderNode = (node, context) => {
    if (!node) {
      return ''
    }
    if (node.nodeType === Node.TEXT_NODE) {
      return context && context.preserveWhitespace
        ? node.textContent || ''
        : String(node.textContent || '').replace(/\s+/g, ' ')
    }
    if (!(node instanceof Element) || isSkippableElement(node)) {
      return ''
    }

    switch (node.tagName) {
      case 'BODY':
      case 'MAIN':
      case 'ARTICLE':
      case 'SECTION':
      case 'DIV':
      case 'FIGURE':
      case 'DETAILS':
        return `\n\n${renderChildren(node.childNodes, context)}\n\n`
      case 'FIGCAPTION': {
        const caption = compactInline(renderInlineChildren(node.childNodes, context))
        return caption ? `\n\n*${caption}*\n\n` : ''
      }
      case 'P': {
        const paragraph = compactInline(renderInlineChildren(node.childNodes, context))
        return paragraph ? `\n\n${paragraph}\n\n` : ''
      }
      case 'H1':
      case 'H2':
      case 'H3':
      case 'H4':
      case 'H5':
      case 'H6': {
        const level = Number.parseInt(node.tagName.slice(1), 10)
        const heading = compactInline(renderInlineChildren(node.childNodes, context))
        return heading ? `\n\n${'#'.repeat(level)} ${heading}\n\n` : ''
      }
      case 'UL':
      case 'OL': {
        const list = renderList(node, context)
        return list ? `\n\n${list}\n\n` : ''
      }
      case 'BLOCKQUOTE': {
        const body = cleanupMarkdown(renderChildren(node.childNodes, context))
        if (!body) {
          return ''
        }
        return `\n\n${body
          .split('\n')
          .map((line) => (line ? `> ${line}` : '>'))
          .join('\n')}\n\n`
      }
      case 'PRE': {
        const raw = extractText(node, true).trimEnd()
        if (!raw) {
          return ''
        }
        const code = node.querySelector('code')
        const languageMatch = String(code?.className || node.className || '').match(/language-([a-z0-9_-]+)/i)
        const language = languageMatch ? languageMatch[1] : ''
        return `\n\n\`\`\`${language}\n${raw}\n\`\`\`\n\n`
      }
      case 'TABLE': {
        const table = renderTable(node)
        return table ? `\n\n${table}\n\n` : ''
      }
      case 'HR':
        return '\n\n---\n\n'
      case 'BR':
        return '\n'
      default:
        if (BLOCK_TAGS.has(node.tagName)) {
          return `\n\n${renderChildren(node.childNodes, context)}\n\n`
        }
        return renderInlineNode(node, context)
    }
  }

  const collectHeadings = (root) => {
    if (!includeHeadings) {
      return []
    }
    return Array.from(root.querySelectorAll('h1, h2, h3, h4, h5, h6'))
      .map((heading) => ({
        level: Number.parseInt(heading.tagName.slice(1), 10),
        text: truncateText(extractText(heading), 180),
      }))
      .filter((item) => item.text)
      .slice(0, maxHeadings)
  }

  const collectLinks = (root) => {
    if (!includeLinkIndex) {
      return []
    }
    const seen = new Set()
    const links = []
    for (const element of root.querySelectorAll('a[href]')) {
      const url = toAbsoluteUrl(element.getAttribute('href') || '')
      if (!url || seen.has(url)) {
        continue
      }
      seen.add(url)
      links.push({
        text: truncateText(extractText(element), 140) || url,
        url,
        title: truncateText(element.getAttribute('title') || '', 140) || undefined,
      })
      if (links.length >= maxLinks) {
        break
      }
    }
    return links
  }

  const collectImages = (root) => {
    if (!includeImageIndex) {
      return []
    }
    const seen = new Set()
    const images = []
    for (const element of root.querySelectorAll('img')) {
      const url = toAbsoluteUrl(element.getAttribute('src') || element.getAttribute('data-src') || '')
      if (!url || seen.has(url)) {
        continue
      }
      seen.add(url)
      images.push({
        alt: truncateText(element.getAttribute('alt') || '', 160) || undefined,
        url,
        title: truncateText(element.getAttribute('title') || '', 160) || undefined,
      })
      if (images.length >= maxImages) {
        break
      }
    }
    return images
  }

  const readMeta = (name) => {
    const selector = [
      `meta[name="${name}"]`,
      `meta[property="${name}"]`,
      `meta[itemprop="${name}"]`,
    ].join(',')
    const element = document.querySelector(selector)
    return normalizeWhitespace(element && element.getAttribute('content'))
  }

  const buildMetadata = (blockedBy, extra) => {
    if (!includeMetadata) {
      return undefined
    }
    return {
      requestedUrl: options.requestedUrl || location.href,
      finalUrl: location.href,
      title: document.title || undefined,
      description: readMeta('description') || readMeta('og:description') || undefined,
      lang: normalizeWhitespace(document.documentElement.lang || '') || undefined,
      canonicalUrl: toAbsoluteUrl((document.querySelector('link[rel="canonical"]') || {}).href || '') || undefined,
      siteName: readMeta('og:site_name') || undefined,
      author: readMeta('author') || undefined,
      publishedAt: readMeta('article:published_time') || undefined,
      modifiedAt: readMeta('article:modified_time') || undefined,
      keywords: readMeta('keywords') || undefined,
      contentType: document.contentType || undefined,
      status: Number.isFinite(Number(options.httpStatus)) ? Number(options.httpStatus) : undefined,
      ...(blockedBy ? { blockedBy } : {}),
      ...(extra || {}),
    }
  }

  const createBlockedPayload = (reason, blockedBy, extra) => {
    const finalUrl = location.href
    const url = options.requestedUrl || finalUrl
    const body = [
      '# 访问受限',
      '',
      `- **URL**: ${url}`,
      ...(finalUrl !== url ? [`- **最终 URL**: ${finalUrl}`] : []),
      ...(Number.isFinite(Number(options.httpStatus)) ? [`- **状态码**: ${Number(options.httpStatus)}`] : []),
      `- **原因**: ${reason}`,
      '',
      '## 当前结论',
      '',
      '目标页面当前返回了站点限制或登录页，浏览器模式虽然已经执行了页面脚本，但仍然没有拿到可用正文。',
    ].join('\n')

    return {
      title: document.title || '访问受限',
      url,
      finalUrl,
      description: reason,
      content: body,
      contentFormat: 'markdown',
      contentText: truncateText(`${reason} ${body}`, 4000),
      engine: 'browser_blocked',
      headings: [],
      links: [],
      images: [],
      metadata: buildMetadata(blockedBy, extra),
      warnings: [
        'browser mode loaded the page but still did not obtain article正文; returning an access-limited summary instead',
      ],
      truncated: false,
    }
  }

  const isZhihuChallengePage =
    !!document.querySelector('#zh-zse-ck') ||
    document.body.textContent.includes('请求存在异常') ||
    document.body.innerHTML.includes('__zse_ck')

  if (isZhihuChallengePage) {
    const script = document.querySelector('script[src*="zse-ck"]')
    return JSON.stringify(
      createBlockedPayload('知乎当前返回了 zse-ck 风控/验证页面，浏览器模式暂未拿到正文。', 'zhihu_zse_ck', {
        challengeScriptUrl: script ? toAbsoluteUrl(script.getAttribute('src') || '') : undefined,
      }),
    )
  }

  if (/\/signin/i.test(location.pathname) || document.title === '知乎 - 有问题，就会有答案') {
    return JSON.stringify(
      createBlockedPayload('页面被重定向到了登录或站点首页，当前会话没有获得可用正文。', 'signin_redirect'),
    )
  }

  const contentRoot = selectCandidateRoot()
  const markdown = cleanupMarkdown(renderNode(contentRoot, { listDepth: 0 }))
  const truncated =
    markdown.length > maxContentChars
      ? `${cleanupMarkdown(markdown.slice(0, Math.max(1, maxContentChars - 18)))}\n\n[内容已截断]`
      : markdown

  const payload = {
    title: document.title || location.href,
    url: options.requestedUrl || location.href,
    finalUrl: location.href,
    description: readMeta('description') || readMeta('og:description') || '',
    content: truncated,
    contentFormat: 'markdown',
    contentText: truncateText(extractText(contentRoot), maxContentChars),
    engine: 'browser_webview',
    headings: collectHeadings(contentRoot),
    links: collectLinks(contentRoot),
    images: collectImages(contentRoot),
    metadata: buildMetadata(undefined, {}),
    warnings: [],
    truncated: markdown.length > maxContentChars,
  }

  return JSON.stringify(payload)
})()
