const TEXT_FILE_EXTENSIONS = new Set([
  '.cjs',
  '.conf',
  '.css',
  '.csv',
  '.env',
  '.gitignore',
  '.gradle',
  '.html',
  '.internal',
  '.java',
  '.js',
  '.json',
  '.kts',
  '.kt',
  '.log',
  '.md',
  '.mjs',
  '.properties',
  '.ps1',
  '.py',
  '.sh',
  '.sql',
  '.svg',
  '.text',
  '.toml',
  '.ts',
  '.tsx',
  '.txt',
  '.xml',
  '.yaml',
  '.yml',
])

const TEXT_FILE_NAMES = new Set([
  'dockerfile',
  'license',
  'makefile',
  'readme',
])

const MAX_REPLACEMENT_RATIO = 0.02

export const MAX_READ_LIST_ENTRIES = 200
export const MAX_READ_LIST_DEPTH = 4
export const MAX_READ_TEXT_LINES = 400
export const MAX_READ_TEXT_CHARS = 24 * 1024

const normalizeSlashes = (value: string): string => value.replace(/\\/g, '/')

const getPathName = (value: string): string => {
  const normalized = normalizeSlashes(value)
  const segments = normalized.split('/').filter(Boolean)
  return (segments[segments.length - 1] ?? normalized).trim()
}

const getPathExtension = (value: string): string => {
  const name = getPathName(value)
  if (!name) {
    return ''
  }
  if (name.startsWith('.') && !name.slice(1).includes('.')) {
    return name.toLowerCase()
  }
  const lastDot = name.lastIndexOf('.')
  if (lastDot <= 0 || lastDot === name.length - 1) {
    return ''
  }
  return name.slice(lastDot).toLowerCase()
}

export const normalizeReadRelativePath = (value?: string): string => {
  const normalized = normalizeSlashes((value ?? '').trim())
    .replace(/^\/+/, '')
    .replace(/\/{2,}/g, '/')
    .replace(/\/+$/, '')

  if (!normalized || normalized === '.') {
    return ''
  }

  const segments = normalized.split('/')
  if (segments.some((segment) => segment === '.' || segment === '..')) {
    throw new Error(`非法路径：${value ?? ''}`)
  }

  return normalized
}

export const sanitizeReadDepth = (value?: number): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 1
  }
  return Math.max(1, Math.min(MAX_READ_LIST_DEPTH, Math.round(value)))
}

export const isTextFileLikely = (path: string, content?: string): boolean => {
  const extension = getPathExtension(path)
  if (TEXT_FILE_EXTENSIONS.has(extension)) {
    return true
  }

  const name = getPathName(path).toLowerCase()
  if (TEXT_FILE_NAMES.has(name)) {
    return true
  }

  if (content === undefined) {
    return false
  }

  if (content.includes('\u0000')) {
    return false
  }

  const hasControlCharacters = Array.from(content).some((character) => {
    const code = character.charCodeAt(0)
    return code < 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d
  })
  if (hasControlCharacters) {
    return false
  }

  const replacementCharacters = content.match(/\uFFFD/g)?.length ?? 0
  if (replacementCharacters > 0) {
    return replacementCharacters / Math.max(content.length, 1) <= MAX_REPLACEMENT_RATIO
  }

  return true
}

export interface TextWindowSlice {
  content: string
  lineStart: number
  lineEnd: number
  totalLines: number
  truncated: boolean
}

export const sliceTextByLineWindow = (
  content: string,
  startLine?: number,
  endLine?: number,
): TextWindowSlice => {
  const normalized = content.replace(/\r\n?/g, '\n')
  const lines = normalized.split('\n')
  const totalLines = lines.length
  const lineStart =
    typeof startLine === 'number' && Number.isFinite(startLine)
      ? Math.max(1, Math.round(startLine))
      : 1
  const requestedEnd =
    typeof endLine === 'number' && Number.isFinite(endLine)
      ? Math.max(lineStart, Math.round(endLine))
      : lineStart + MAX_READ_TEXT_LINES - 1
  const maxLineEnd = Math.min(requestedEnd, lineStart + MAX_READ_TEXT_LINES - 1, totalLines)

  const selectedLines = lines.slice(lineStart - 1, maxLineEnd)
  let limitedLines = selectedLines
  let lineEnd = lineStart - 1 + limitedLines.length
  let truncated = requestedEnd > maxLineEnd

  let charCount = 0
  const charLimitedLines: string[] = []
  for (const line of selectedLines) {
    const nextCount = charCount + line.length + (charLimitedLines.length > 0 ? 1 : 0)
    if (nextCount > MAX_READ_TEXT_CHARS) {
      truncated = true
      break
    }
    charLimitedLines.push(line)
    charCount = nextCount
  }

  if (charLimitedLines.length < limitedLines.length) {
    limitedLines = charLimitedLines
    lineEnd = lineStart - 1 + limitedLines.length
  }

  return {
    content: limitedLines.join('\n'),
    lineStart,
    lineEnd,
    totalLines,
    truncated: truncated || lineEnd < totalLines,
  }
}
