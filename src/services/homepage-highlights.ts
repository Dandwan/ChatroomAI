export interface HomepageHighlightStat {
  id: 'tokenUsage' | 'conversationHistory' | 'toolCalls' | 'imagesSent' | 'messageCount'
  label: string
  value: string
  meta: string
  count: number
  priority: 'primary' | 'backup'
}

export const HOMEPAGE_HIGHLIGHT_DISPLAY_COUNT = 3

const PRIMARY_PRIORITY_ORDER: HomepageHighlightStat['id'][] = [
  'tokenUsage',
  'conversationHistory',
  'toolCalls',
]

const BACKUP_PRIORITY_ORDER: HomepageHighlightStat['id'][] = ['imagesSent', 'messageCount']

export const selectHomepageHighlights = (
  stats: HomepageHighlightStat[],
): HomepageHighlightStat[] => {
  const statById = new Map(stats.map((stat) => [stat.id, stat]))
  const orderedIds = [...PRIMARY_PRIORITY_ORDER, ...BACKUP_PRIORITY_ORDER]

  const positiveStats = orderedIds
    .map((id) => statById.get(id))
    .filter((stat): stat is HomepageHighlightStat => Boolean(stat && stat.count > 0))

  if (positiveStats.length === 0) {
    return PRIMARY_PRIORITY_ORDER.map((id) => statById.get(id)).filter(
      (stat): stat is HomepageHighlightStat => Boolean(stat),
    )
  }

  const selected = positiveStats.slice(0, HOMEPAGE_HIGHLIGHT_DISPLAY_COUNT)
  if (selected.length >= HOMEPAGE_HIGHLIGHT_DISPLAY_COUNT) {
    return selected
  }

  const fallbackStats = orderedIds
    .map((id) => statById.get(id))
    .filter((stat): stat is HomepageHighlightStat => Boolean(stat && !selected.includes(stat)))

  return [...selected, ...fallbackStats].slice(0, HOMEPAGE_HIGHLIGHT_DISPLAY_COUNT)
}
