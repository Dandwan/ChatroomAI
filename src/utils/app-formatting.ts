/**
 * 通用格式化与类型检查工具函数
 * 从 src/App.tsx 提取
 */

import type { JsonObjectValue } from '../components/SkillConfigJsonEditor'
import type { ConversationResponseMode } from '../state/types'

export const numberFormatter = new Intl.NumberFormat('zh-CN')
export const dateFormatter = new Intl.DateTimeFormat('zh-CN', {
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})
export const drawerGroupDateFormatter = new Intl.DateTimeFormat('zh-CN', {
  month: '2-digit',
  day: '2-digit',
})
export const drawerGroupTimeFormatter = new Intl.DateTimeFormat('zh-CN', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})
export const createId = (): string => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

export const isJsonObjectRecord = (value: unknown): value is JsonObjectValue =>
  isRecord(value) && !Array.isArray(value)

export const formatJsonObject = (value: JsonObjectValue): string => JSON.stringify(value, null, 2)

export const parseSkillConfigDraft = (raw: string): { value?: JsonObjectValue; error?: string } => {
  try {
    const parsed = JSON.parse(raw.trim() ? raw : '{}') as unknown
    if (!isJsonObjectRecord(parsed)) {
      return {
        error: '配置必须是 JSON 对象。',
      }
    }
    return {
      value: parsed,
    }
  } catch {
    return {
      error: '配置必须是合法的 JSON。',
    }
  }
}

export const toFiniteNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }
  return undefined
}

export const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(Math.max(value, minimum), maximum)

export const startOfLocalDay = (time: number): number => {
  const next = new Date(time)
  next.setHours(0, 0, 0, 0)
  return next.getTime()
}

export const formatDrawerGroupLabel = (time: number, referenceTime = Date.now()): string => {
  const currentDay = startOfLocalDay(referenceTime)
  const targetDay = startOfLocalDay(time)

  if (targetDay === currentDay) {
    return `TODAY · ${drawerGroupTimeFormatter.format(time)}`
  }

  if (targetDay === currentDay - 24 * 60 * 60 * 1000) {
    return `YESTERDAY · ${drawerGroupTimeFormatter.format(time)}`
  }

  return `${drawerGroupDateFormatter.format(time)} · ${drawerGroupTimeFormatter.format(time)}`
}

export const formatCompactCount = (value: number): string => {
  const absolute = Math.abs(value)
  if (absolute < 1000) {
    return numberFormatter.format(Math.round(value))
  }

  const units = [
    { value: 1_000_000_000, suffix: 'b' },
    { value: 1_000_000, suffix: 'm' },
    { value: 1_000, suffix: 'k' },
  ] as const

  const unit = units.find((item) => absolute >= item.value) ?? units[units.length - 1]
  const scaled = value / unit.value
  const digits = Math.abs(scaled) >= 10 ? 1 : 1
  return `${scaled.toFixed(digits).replace(/\.0$/, '')}${unit.suffix}`
}


export const getResponseModeLabel = (mode: ConversationResponseMode): string =>
  mode === 'tool' ? '技能模式' : '文本模式'

export const buildHomepageModelTriggerLabel = (
  modelId: string,
  responseMode: ConversationResponseMode,
): string => {
  const trimmedModelId = modelId.trim()
  const modeLabel = getResponseModeLabel(responseMode)
  return trimmedModelId ? `${trimmedModelId} · ${modeLabel}` : `选择模型 · ${modeLabel}`
}

