import { parse, stringify } from 'yaml'
import type { SkillDocument, SkillFrontmatter } from './types'

const FRONTMATTER_PATTERN = /^---\s*\n([\s\S]*?)\n---\s*\n?/
const HEADING_PATTERN = /^##\s+(.+?)\s*$/gm

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

export const parseSkillDocument = (content: string): SkillDocument => {
  const match = content.match(FRONTMATTER_PATTERN)
  if (!match) {
    throw new Error('SKILL.md 缺少 YAML frontmatter。')
  }

  const parsed = parse(match[1]) as unknown
  if (!isRecord(parsed) || typeof parsed.name !== 'string' || typeof parsed.description !== 'string') {
    throw new Error('SKILL.md frontmatter 至少需要包含 name 和 description。')
  }

  const body = content.slice(match[0].length).trim()
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
    frontmatter: parsed as SkillFrontmatter,
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
