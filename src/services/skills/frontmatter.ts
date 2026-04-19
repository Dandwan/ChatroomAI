import { parse, stringify } from 'yaml'
import type { SkillDocument, SkillFrontmatter } from './types'

const FRONTMATTER_PATTERN = /^---\s*\n([\s\S]*?)\n---\s*\n?/
const HEADING_PATTERN = /^##\s+(.+?)\s*$/gm

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

export const parseSkillDocument = (content: string): SkillDocument => {
  const match = content.match(FRONTMATTER_PATTERN)
  const body = (match ? content.slice(match[0].length) : content).trim()
  let parsed: unknown = {}
  if (match) {
    try {
      parsed = parse(match[1]) as unknown
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
  const sections: Record<string, string> = {}

  const headings = [...body.matchAll(HEADING_PATTERN)]
  if (headings.length === 0) {
    sections.Overview = body
  } else {
    for (const [index, heading] of headings.entries()) {
      const title = heading[1].trim()
      const start = heading.index ?? 0
      const contentStart = start + heading[0].length
      const next = headings[index + 1]
      const end = next?.index ?? body.length
      sections[title] = body.slice(contentStart, end).trim()
    }
  }

  return {
    frontmatter,
    body,
    content,
    sections,
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
