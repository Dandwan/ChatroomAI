import { parse, stringify } from 'yaml'
import type { SkillDocument, SkillFrontmatter } from './types'

const FRONTMATTER_PATTERN = /^---\s*\n([\s\S]*?)\n---\s*\n?/

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const stripDisallowedControlCharacters = (value: string): string =>
  Array.from(value)
    .filter((character) => {
      const code = character.charCodeAt(0)
      return code >= 0x20 || code === 0x09 || code === 0x0a
    })
    .join('')

const normalizeFrontmatterText = (value: string): string =>
  stripDisallowedControlCharacters(value.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n'))

export const parseSkillDocument = (content: string): SkillDocument => {
  const match = content.match(FRONTMATTER_PATTERN)
  const body = (match ? content.slice(match[0].length) : content).trim()
  let parsed: unknown = {}
  if (match) {
    try {
      parsed = parse(normalizeFrontmatterText(match[1])) as unknown
    } catch {
      parsed = {}
    }
  }
  const frontmatterRaw = isRecord(parsed) ? parsed : {}
  const headingName = body.match(/^#\s+(.+?)\s*$/m)?.[1]?.trim()
  const frontmatter: SkillFrontmatter = {
    ...frontmatterRaw,
    name:
      typeof frontmatterRaw.name === 'string' && frontmatterRaw.name.trim()
        ? frontmatterRaw.name.trim()
        : headingName || 'unnamed-skill',
    description:
      typeof frontmatterRaw.description === 'string' && frontmatterRaw.description.trim()
        ? frontmatterRaw.description.trim()
        : '未提供描述。',
  }

  return {
    frontmatter,
    body,
    content,
  }
}

export const readFrontmatterOnly = (content: string): SkillFrontmatter => {
  const parsed = parseSkillDocument(content)
  return parsed.frontmatter
}

export const renderSkillsCatalogYaml = (items: Array<Record<string, unknown>>): string =>
  stringify(items, {
    collectionStyle: 'block',
    lineWidth: 0,
  }).trim()
