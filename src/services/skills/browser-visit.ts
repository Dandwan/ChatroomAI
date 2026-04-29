import { resolveAbsolutePath, writeTextFile } from './storage'
import { nativeExtractWebPage } from './native-runtime'
import type {
  BrowserVisitHeading,
  BrowserVisitImage,
  BrowserVisitLink,
  BrowserVisitResult,
  SkillExecutionResult,
} from './types'

type BrowserVisitOutputFormat = 'json' | 'markdown' | 'text'

interface ParsedOutputOptions {
  argv: string[]
  format: BrowserVisitOutputFormat
  formatExplicit: boolean
  pretty: boolean
  outputPath: string
}

interface BrowserVisitRequestOptions {
  url: string
  extract: string
  maxContentChars: number
  maxLinks: number
  maxImages: number
  maxHeadings: number
  includeMetadata: boolean
  includeHeadings: boolean
  includeLinkIndex: boolean
  includeImageIndex: boolean
}

interface BrowserVisitConfig {
  preferredEngine: string
  browserTimeoutMs: number
  maxContentChars: number
  maxLinks: number
  maxImages: number
  maxHeadings: number
  includeMetadata: boolean
  includeHeadings: boolean
  includeLinkIndex: boolean
  includeImageIndex: boolean
}

const MARKDOWN_PREVIEW_LIMIT = 12

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const normalizeWhitespace = (value: unknown): string =>
  String(value || '')
    .replace(/\s+/g, ' ')
    .trim()

const parsePositiveInt = (value: unknown, fallback: number): number => {
  const parsed = Number.parseInt(String(value ?? fallback), 10)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback
  }
  return parsed
}

const markdownEscapeInline = (value: unknown): string =>
  String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/\|/g, '\\|')
    .replace(/`/g, '\\`')

const parseOutputOptions = (argv: string[]): ParsedOutputOptions => {
  const passthrough: string[] = []
  let format: BrowserVisitOutputFormat = 'json'
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
      if (normalized !== 'json' && normalized !== 'markdown' && normalized !== 'text') {
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

const parseArgv = (argv: string[]) => {
  const values: Record<string, string> = {}
  const flags = new Set<string>()
  const positionals: string[] = []

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

  return {
    values,
    flags,
    positionals,
  }
}

const resolveBooleanOption = (
  flags: Set<string>,
  enabledFlag: string,
  disabledFlag: string,
  fallback: boolean,
): boolean => {
  if (flags.has(disabledFlag)) {
    return false
  }
  if (flags.has(enabledFlag)) {
    return true
  }
  return fallback
}

const getNested = (source: unknown, path: string[], fallback: unknown): unknown => {
  let current: unknown = source
  for (const segment of path) {
    if (!isRecord(current) || !(segment in current)) {
      return fallback
    }
    current = current[segment]
  }
  return current === undefined ? fallback : current
}

const resolveBrowserVisitConfig = (skillConfig: unknown): BrowserVisitConfig => ({
  preferredEngine: normalizeWhitespace(getNested(skillConfig, ['fetchUrl', 'preferredEngine'], 'browser')) || 'browser',
  browserTimeoutMs: parsePositiveInt(getNested(skillConfig, ['fetchUrl', 'browserTimeoutMs'], 20000), 20000),
  maxContentChars: parsePositiveInt(getNested(skillConfig, ['fetchUrl', 'maxContentChars'], 24000), 24000),
  maxLinks: parsePositiveInt(getNested(skillConfig, ['fetchUrl', 'maxLinks'], 40), 40),
  maxImages: parsePositiveInt(getNested(skillConfig, ['fetchUrl', 'maxImages'], 20), 20),
  maxHeadings: parsePositiveInt(getNested(skillConfig, ['fetchUrl', 'maxHeadings'], 32), 32),
  includeMetadata: Boolean(getNested(skillConfig, ['fetchUrl', 'includeMetadata'], true)),
  includeHeadings: Boolean(getNested(skillConfig, ['fetchUrl', 'includeHeadings'], true)),
  includeLinkIndex: Boolean(getNested(skillConfig, ['fetchUrl', 'includeLinkIndex'], true)),
  includeImageIndex: Boolean(getNested(skillConfig, ['fetchUrl', 'includeImageIndex'], true)),
})

const normalizeRequestedUrlInput = (value: string): string => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) {
    return ''
  }
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(normalized)) {
    return normalized
  }
  if (normalized.startsWith('//')) {
    return `https:${normalized}`
  }

  const authority = normalized
    .split(/[/?#]/, 1)[0]
    .replace(/^[^@]+@/, '')
  const hostname = authority.replace(/:\d+$/, '').toLowerCase()
  const isLocal =
    hostname === 'localhost' ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    hostname.endsWith('.lan') ||
    /^(?:\d{1,3}\.){3}\d{1,3}$/.test(hostname) ||
    !hostname.includes('.')

  return `${isLocal ? 'http' : 'https'}://${normalized}`
}

const resolveBrowserVisitRequest = (
  argv: string[],
  skillConfig: unknown,
): BrowserVisitRequestOptions => {
  const parsed = parseArgv(argv)
  const defaults = resolveBrowserVisitConfig(skillConfig)
  const url = normalizeRequestedUrlInput(parsed.values.url || parsed.positionals[0] || '')
  if (!url) {
    throw new Error('visit_url requires --url')
  }

  return {
    url,
    extract: normalizeWhitespace(parsed.values.extract || defaults.preferredEngine).toLowerCase() || defaults.preferredEngine,
    maxContentChars: parsePositiveInt(parsed.values['max-content-chars'], defaults.maxContentChars),
    maxLinks: parsePositiveInt(parsed.values['max-links'], defaults.maxLinks),
    maxImages: parsePositiveInt(parsed.values['max-images'], defaults.maxImages),
    maxHeadings: parsePositiveInt(parsed.values['max-headings'], defaults.maxHeadings),
    includeMetadata: resolveBooleanOption(parsed.flags, 'include-metadata', 'no-metadata', defaults.includeMetadata),
    includeHeadings: resolveBooleanOption(parsed.flags, 'include-headings', 'no-headings', defaults.includeHeadings),
    includeLinkIndex: resolveBooleanOption(parsed.flags, 'include-links', 'no-links', defaults.includeLinkIndex),
    includeImageIndex: resolveBooleanOption(parsed.flags, 'include-images', 'no-images', defaults.includeImageIndex),
  }
}

export const shouldUseBrowserVisitMode = (
  commandArgv: string[],
  skillConfig: unknown,
): boolean => {
  if (commandArgv.length === 0) {
    return false
  }

  const target = commandArgv[0].replace(/^\.\/+/, '')
  if (
    target !== 'visit_url' &&
    target !== 'fetch_url' &&
    target !== 'scripts/visit_url' &&
    target !== 'scripts/fetch_url'
  ) {
    return false
  }

  const parsed = parseArgv(commandArgv.slice(1))
  const extract = normalizeWhitespace(parsed.values.extract || '')
  if (extract) {
    const normalized = extract.toLowerCase()
    return normalized === 'browser'
  }

  const defaults = resolveBrowserVisitConfig(skillConfig)
  const preferred = defaults.preferredEngine.toLowerCase()
  return preferred === 'browser' || preferred === 'webview' || preferred === 'native'
}

const normalizeLinks = (links: BrowserVisitLink[] | undefined): BrowserVisitLink[] =>
  Array.isArray(links) ? links.filter((item) => item && normalizeWhitespace(item.url)) : []

const normalizeImages = (images: BrowserVisitImage[] | undefined): BrowserVisitImage[] =>
  Array.isArray(images) ? images.filter((item) => item && normalizeWhitespace(item.url)) : []

const normalizeHeadings = (headings: BrowserVisitHeading[] | undefined): BrowserVisitHeading[] =>
  Array.isArray(headings) ? headings.filter((item) => item && normalizeWhitespace(item.text)) : []

const renderBrowserVisitMarkdown = (payload: BrowserVisitResult): string => {
  const lines = [`# ${markdownEscapeInline(payload.title || '网页访问结果')}`, '']
  const finalUrl = normalizeWhitespace(payload.finalUrl)
  const warnings = Array.isArray(payload.warnings) ? payload.warnings : []
  const metadata = payload.metadata ?? {}

  if (payload.url) {
    lines.push(`- **URL**: ${payload.url}`)
  }
  if (finalUrl && finalUrl !== payload.url) {
    lines.push(`- **最终 URL**: ${finalUrl}`)
  }
  if (payload.engine) {
    lines.push(`- **引擎**: ${markdownEscapeInline(payload.engine)}`)
  }
  if (typeof metadata.status === 'number') {
    lines.push(`- **状态码**: ${metadata.status}`)
  }
  if (metadata.contentType) {
    lines.push(`- **内容类型**: ${markdownEscapeInline(metadata.contentType)}`)
  }
  if (metadata.lang) {
    lines.push(`- **语言**: ${markdownEscapeInline(metadata.lang)}`)
  }
  if (metadata.siteName) {
    lines.push(`- **站点**: ${markdownEscapeInline(metadata.siteName)}`)
  }
  if (payload.description) {
    lines.push(`- **描述**: ${markdownEscapeInline(payload.description)}`)
  }
  if (metadata.author) {
    lines.push(`- **作者**: ${markdownEscapeInline(metadata.author)}`)
  }
  if (metadata.publishedAt) {
    lines.push(`- **发布时间**: ${markdownEscapeInline(metadata.publishedAt)}`)
  }
  if (metadata.modifiedAt) {
    lines.push(`- **修改时间**: ${markdownEscapeInline(metadata.modifiedAt)}`)
  }

  if (payload.content) {
    lines.push('', '## 正文', '', payload.content)
  }

  if (payload.truncated) {
    lines.push('', '> 页面内容已按长度限制截断。')
  }

  if (warnings.length > 0) {
    lines.push('', '## 提示')
    for (const warning of warnings) {
      lines.push(`- ${markdownEscapeInline(String(warning || ''))}`)
    }
  }

  const headings = normalizeHeadings(payload.headings)
  if (headings.length > 0) {
    lines.push('', '## 标题索引')
    for (const heading of headings) {
      const level = Number.isFinite(heading.level) ? Math.max(1, Math.min(heading.level, 6)) : 1
      lines.push(`- H${level}: ${markdownEscapeInline(heading.text)}`)
    }
  }

  const links = normalizeLinks(payload.links)
  if (links.length > 0) {
    lines.push('', '## 链接索引')
    for (let index = 0; index < Math.min(links.length, MARKDOWN_PREVIEW_LIMIT * 4); index += 1) {
      const link = links[index]
      const text = normalizeWhitespace(link.text) || link.url
      lines.push(`${index + 1}. [${markdownEscapeInline(text)}](${link.url})`)
    }
  }

  const images = normalizeImages(payload.images)
  if (images.length > 0) {
    lines.push('', '## 图片索引')
    for (let index = 0; index < Math.min(images.length, MARKDOWN_PREVIEW_LIMIT * 4); index += 1) {
      const image = images[index]
      const alt = normalizeWhitespace(image.alt || '') || `image-${index + 1}`
      lines.push(`${index + 1}. ![${markdownEscapeInline(alt)}](${image.url})`)
    }
  }

  return lines.join('\n')
}

const renderBrowserVisitText = (targetName: string, payload: BrowserVisitResult): string => {
  const lines = [`script=${targetName}`]
  if (payload.url) {
    lines.push(`url=${payload.url}`)
  }
  if (payload.finalUrl && payload.finalUrl !== payload.url) {
    lines.push(`finalUrl=${payload.finalUrl}`)
  }
  lines.push(`engine=${payload.engine}`)
  lines.push(`headings=${normalizeHeadings(payload.headings).length}`)
  lines.push(`links=${normalizeLinks(payload.links).length}`)
  lines.push(`images=${normalizeImages(payload.images).length}`)
  lines.push(`truncated=${payload.truncated ? 'true' : 'false'}`)
  return lines.join('\n')
}

const renderBrowserVisitOutput = (
  targetName: string,
  payload: BrowserVisitResult,
  format: BrowserVisitOutputFormat,
  pretty: boolean,
): string => {
  if (format === 'markdown') {
    return renderBrowserVisitMarkdown(payload)
  }
  if (format === 'text') {
    return renderBrowserVisitText(targetName, payload)
  }
  return pretty ? JSON.stringify(payload, null, 2) : JSON.stringify(payload)
}

const normalizeAbsolutePath = (value: string): string => value.replace(/\\/g, '/').trim()

const buildOutputAbsolutePath = (cwdAbsolutePath: string, outputPath: string): string => {
  const normalizedOutput = normalizeWhitespace(outputPath)
  if (!normalizedOutput) {
    return ''
  }

  if (/^(?:[A-Za-z]:[\\/]|\/)/.test(normalizedOutput)) {
    return normalizeAbsolutePath(normalizedOutput)
  }

  const cwd = normalizeAbsolutePath(cwdAbsolutePath).replace(/\/+$/, '')
  return `${cwd}/${normalizedOutput.replace(/^\/+/, '')}`
}

const toAppDataRelativePath = async (absolutePath: string): Promise<string> => {
  const normalizedAbsolutePath = normalizeAbsolutePath(absolutePath)
  const skillRootAbsolutePath = normalizeAbsolutePath(await resolveAbsolutePath('skill-host'))
  const skillHostSuffix = '/skill-host'
  const skillHostIndex = skillRootAbsolutePath.lastIndexOf(skillHostSuffix)
  if (skillHostIndex < 0) {
    throw new Error('Unable to resolve app files root for browser visit output')
  }
  const appDataRoot = skillRootAbsolutePath.slice(0, skillHostIndex)
  if (!normalizedAbsolutePath.startsWith(`${appDataRoot}/`)) {
    throw new Error('browser visit output path must stay within the app files directory')
  }
  return normalizedAbsolutePath.slice(appDataRoot.length + 1)
}

const writeOutputFileIfNeeded = async (
  rendered: string,
  cwdAbsolutePath: string,
  outputPath: string,
): Promise<void> => {
  if (!normalizeWhitespace(outputPath)) {
    return
  }

  const absolutePath = buildOutputAbsolutePath(cwdAbsolutePath, outputPath)
  const relativePath = await toAppDataRelativePath(absolutePath)
  await writeTextFile(relativePath, `${rendered}\n`)
}

export const executeBrowserVisit = async ({
  targetName,
  commandArgv,
  skillConfig,
  cwdAbsolutePath,
  timeoutMs,
}: {
  targetName: 'visit_url' | 'fetch_url'
  commandArgv: string[]
  skillConfig: unknown
  cwdAbsolutePath: string
  timeoutMs: number
}): Promise<SkillExecutionResult> => {
  const startedAt = performance.now()
  const outputOptions = parseOutputOptions(commandArgv.slice(1))
  const request = resolveBrowserVisitRequest(outputOptions.argv, skillConfig)
  const effectiveFormat =
    !outputOptions.formatExplicit && targetName === 'visit_url'
      ? 'markdown'
      : outputOptions.format

  const defaults = resolveBrowserVisitConfig(skillConfig)
  const pageResult = await nativeExtractWebPage({
    url: request.url,
    timeoutMs: Math.max(defaults.browserTimeoutMs, timeoutMs),
    maxContentChars: request.maxContentChars,
    maxLinks: request.maxLinks,
    maxImages: request.maxImages,
    maxHeadings: request.maxHeadings,
    includeMetadata: request.includeMetadata,
    includeHeadings: request.includeHeadings,
    includeLinkIndex: request.includeLinkIndex,
    includeImageIndex: request.includeImageIndex,
  })

  const rendered = renderBrowserVisitOutput(
    targetName,
    pageResult,
    effectiveFormat,
    outputOptions.pretty,
  )
  await writeOutputFileIfNeeded(rendered, cwdAbsolutePath, outputOptions.outputPath)

  return {
    ok: true,
    stdout: rendered,
    stderr: '',
    exitCode: 0,
    elapsedMs: performance.now() - startedAt,
    resolvedCommand: [targetName, ...commandArgv.slice(1)],
    inferredRuntime: 'native',
  }
}
