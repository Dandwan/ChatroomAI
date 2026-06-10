/**
 * 通用格式化与类型检查工具函数
 * 从 src/App.tsx 提取
 */

import type { JsonObjectValue } from '../components/SkillConfigJsonEditor'
import type { ConversationResponseMode } from '../state/types'

// ── 类型检查 ──

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

export const isJsonObjectRecord = (value: unknown): value is JsonObjectValue =>
  isRecord(value) && !Array.isArray(value)

export const formatJsonObject = (value: JsonObjectValue): string => JSON.stringify(value, null, 2)

export const parseSkillConfigDraft = (raw: string): { value?: JsonObjectValue; error?: string } => {
  try {
    const parsed = JSON.parse(raw.trim() ? raw : '{}') as unknown
    if (!isJsonObjectRecord(parsed)) {
      return { error: '配置必须是 JSON 对象。' }
    }
    return { value: parsed }
  } catch {
    return { error: '配置必须是合法的 JSON。' }
  }
}

export const toFiniteNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : undefined
  }
  return undefined
}

// ── ID 生成 ──

export const createId = (): string => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

// ── 数字/日期格式化 ──

export const numberFormatter = new Intl.NumberFormat('zh-CN')
export const dateFormatter = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

export const drawerGroupDateFormatter = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  weekday: 'short',
  hour12: false,
})

export const drawerGroupTimeFormatter = new Intl.DateTimeFormat('zh-CN', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

export const startOfLocalDay = (time: number): number => {
  const date = new Date(time)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

export const formatDrawerGroupLabel = (time: number, referenceTime = Date.now()): string => {
  const currentDay = startOfLocalDay(referenceTime)
  const targetDay = startOfLocalDay(time)
  const diffDays = Math.round((currentDay - targetDay) / 86400000)

  if (diffDays === 0) {
    return `今天 · ${drawerGroupTimeFormatter.format(time)}`
  }
  if (diffDays === 1) {
    return `昨天 · ${drawerGroupTimeFormatter.format(time)}`
  }
  if (diffDays < 7) {
    return `${diffDays}天前 · ${drawerGroupDateFormatter.format(time)}`
  }
  return drawerGroupDateFormatter.format(time)
}

export const formatCompactCount = (value: number): string => {
  if (value < 1000) {
    return String(value)
  }
  if (value < 10000) {
    const k = (value / 1000).toFixed(1)
    return `${k}k`
  }
  if (value < 1000000) {
    const w = (value / 10000).toFixed(1)
    return `${w}万`
  }
  const m = (value / 1000000).toFixed(1)
  return `${m}M`
}

// ── Response mode 标签 ──

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
