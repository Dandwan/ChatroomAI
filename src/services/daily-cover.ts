import alpineLakeImageUrl from '../assets/daily-covers/alpine-lake.jpg'
import autumnRidgeImageUrl from '../assets/daily-covers/autumn-ridge.jpg'
import craterLakeImageUrl from '../assets/daily-covers/crater-lake.jpg'
import mirrorMountainImageUrl from '../assets/daily-covers/mirror-mountain.jpg'

export interface DailyCoverSettings {
  enabled: boolean
  showChatBanner: boolean
  useApi: boolean
  apiEndpoint: string
  apiMethod: 'GET' | 'POST'
  apiAuthHeader: string
  apiImagePath: string
  apiTitlePath: string
  apiCreditPath: string
  apiLinkPath: string
}

export interface DailyCoverDefinition {
  id: string
  title: string
  photographer: string
  sourceLabel: string
  sourceKind: 'bundled' | 'api'
  imageUrl: string
  description: string
  creditUrl?: string
}

export interface ResolvedDailyCover extends DailyCoverDefinition {
  dateKey: string
}

interface DailyCoverCacheRecord {
  cacheKey: string
  cover: ResolvedDailyCover
  savedAt: number
}

const DAILY_COVER_CACHE_KEY = 'chatroom.daily-cover.cache.v1'
const DAY_MS = 24 * 60 * 60 * 1000

export const DEFAULT_DAILY_COVER_SETTINGS: DailyCoverSettings = {
  enabled: true,
  showChatBanner: true,
  useApi: false,
  apiEndpoint: '',
  apiMethod: 'GET',
  apiAuthHeader: '',
  apiImagePath: 'data.image.url',
  apiTitlePath: 'data.image.title',
  apiCreditPath: 'data.image.credit.name',
  apiLinkPath: 'data.image.credit.link',
}

export const BUNDLED_DAILY_COVER_POOL: DailyCoverDefinition[] = [
  {
    id: 'alpine-lake',
    title: 'Alpine Lake',
    photographer: 'Jplenio',
    sourceLabel: 'Pexels curated',
    sourceKind: 'bundled',
    imageUrl: alpineLakeImageUrl,
    description: 'A still opening image with long air and clean water.',
  },
  {
    id: 'mirror-mountain',
    title: 'Mirror Mountain',
    photographer: 'Eberhard Grossgasteiger',
    sourceLabel: 'Pexels curated',
    sourceKind: 'bundled',
    imageUrl: mirrorMountainImageUrl,
    description: 'A colder, more editorial cover with restrained contrast.',
  },
  {
    id: 'crater-lake',
    title: 'Crater Lake',
    photographer: 'Sanaan Mazhar',
    sourceLabel: 'Pexels curated',
    sourceKind: 'bundled',
    imageUrl: craterLakeImageUrl,
    description: 'A calm opening image for a fresh conversation.',
  },
  {
    id: 'autumn-ridge',
    title: 'Autumn Ridge',
    photographer: 'Nenad Rakicevic',
    sourceLabel: 'Pexels curated',
    sourceKind: 'bundled',
    imageUrl: autumnRidgeImageUrl,
    description: 'For days that need more warmth without losing control.',
  },
]

const normalizeWhitespace = (value: string): string => value.trim().replace(/\s+/g, ' ')

const getPathValue = (source: unknown, path: string): unknown => {
  if (!path.trim()) {
    return undefined
  }

  return path
    .split('.')
    .map((segment) => segment.trim())
    .filter(Boolean)
    .reduce<unknown>((current, segment) => {
      if (!current || typeof current !== 'object' || !(segment in current)) {
        return undefined
      }
      return (current as Record<string, unknown>)[segment]
    }, source)
}

const buildApiEndpoint = (template: string, dateKey: string): string =>
  template
    .replaceAll('{YYYY-MM-DD}', dateKey)
    .replaceAll('{date}', dateKey)

const buildCacheKey = (settings: DailyCoverSettings, dateKey: string): string =>
  JSON.stringify({
    endpoint: settings.apiEndpoint.trim(),
    method: settings.apiMethod,
    auth: settings.apiAuthHeader.trim(),
    imagePath: settings.apiImagePath.trim(),
    titlePath: settings.apiTitlePath.trim(),
    creditPath: settings.apiCreditPath.trim(),
    linkPath: settings.apiLinkPath.trim(),
    dateKey,
  })

const readCacheRecord = (): DailyCoverCacheRecord | null => {
  if (typeof localStorage === 'undefined') {
    return null
  }

  try {
    const raw = localStorage.getItem(DAILY_COVER_CACHE_KEY)
    if (!raw) {
      return null
    }

    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') {
      return null
    }

    const record = parsed as Partial<DailyCoverCacheRecord>
    if (
      typeof record.cacheKey !== 'string' ||
      typeof record.savedAt !== 'number' ||
      !record.cover ||
      typeof record.cover !== 'object'
    ) {
      return null
    }

    return record as DailyCoverCacheRecord
  } catch {
    return null
  }
}

const writeCacheRecord = (record: DailyCoverCacheRecord): void => {
  if (typeof localStorage === 'undefined') {
    return
  }

  try {
    localStorage.setItem(DAILY_COVER_CACHE_KEY, JSON.stringify(record))
  } catch {
    // Ignore cache persistence failures.
  }
}

export const getLocalDateKey = (date = new Date()): string => {
  const localDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  return localDate.toISOString().slice(0, 10)
}

export const resolveBundledDailyCover = (dateKey: string): ResolvedDailyCover => {
  const compactDate = dateKey.replaceAll('-', '')
  let hashValue = 0

  for (let index = 0; index < compactDate.length; index += 1) {
    hashValue += Number(compactDate[index]) * (index + 7)
  }

  const definition =
    BUNDLED_DAILY_COVER_POOL[hashValue % BUNDLED_DAILY_COVER_POOL.length] ??
    BUNDLED_DAILY_COVER_POOL[0]

  return {
    ...definition,
    dateKey,
  }
}

const resolveApiDailyCover = async (
  settings: DailyCoverSettings,
  dateKey: string,
  fallbackCover: ResolvedDailyCover,
): Promise<ResolvedDailyCover | null> => {
  const endpointTemplate = settings.apiEndpoint.trim()
  if (!endpointTemplate) {
    return null
  }

  const cacheKey = buildCacheKey(settings, dateKey)
  const cacheRecord = readCacheRecord()
  if (cacheRecord && cacheRecord.cacheKey === cacheKey && Date.now() - cacheRecord.savedAt < DAY_MS) {
    return cacheRecord.cover
  }

  const endpoint = buildApiEndpoint(endpointTemplate, dateKey)
  const headers = settings.apiAuthHeader.trim()
    ? {
        Authorization: settings.apiAuthHeader.trim(),
      }
    : undefined

  try {
    const response = await fetch(endpoint, {
      method: settings.apiMethod,
      headers,
    })
    if (!response.ok) {
      return null
    }

    const payload = (await response.json()) as unknown
    const imageUrl = getPathValue(payload, settings.apiImagePath)
    const titleValue = getPathValue(payload, settings.apiTitlePath)
    const creditValue = getPathValue(payload, settings.apiCreditPath)
    const linkValue = getPathValue(payload, settings.apiLinkPath)

    if (typeof imageUrl !== 'string' || !normalizeWhitespace(imageUrl)) {
      return null
    }

    const resolvedCover: ResolvedDailyCover = {
      id: `api:${dateKey}`,
      title:
        typeof titleValue === 'string' && normalizeWhitespace(titleValue)
          ? normalizeWhitespace(titleValue)
          : fallbackCover.title,
      photographer:
        typeof creditValue === 'string' && normalizeWhitespace(creditValue)
          ? normalizeWhitespace(creditValue)
          : fallbackCover.photographer,
      sourceLabel: 'Daily image API',
      sourceKind: 'api',
      imageUrl: normalizeWhitespace(imageUrl),
      description: 'A daily image selected from the configured API source.',
      creditUrl:
        typeof linkValue === 'string' && normalizeWhitespace(linkValue)
          ? normalizeWhitespace(linkValue)
          : undefined,
      dateKey,
    }

    writeCacheRecord({
      cacheKey,
      cover: resolvedCover,
      savedAt: Date.now(),
    })

    return resolvedCover
  } catch {
    return null
  }
}

export const resolveDailyCover = async (
  settings: DailyCoverSettings,
  dateKey = getLocalDateKey(),
): Promise<ResolvedDailyCover> => {
  const bundledCover = resolveBundledDailyCover(dateKey)

  if (!settings.enabled || !settings.useApi) {
    return bundledCover
  }

  const apiCover = await resolveApiDailyCover(settings, dateKey, bundledCover)
  return apiCover ?? bundledCover
}
