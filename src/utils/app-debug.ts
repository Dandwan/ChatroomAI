/**
 * 调试日志工具函数
 * 从 src/App.tsx 提取
 */

import type { ApiMessage, ApiRole, ApiContentPart } from '../services/chat-api'
import { isRecord } from './app-formatting'

export const DEBUG_SKILL_ROUND_LOG_STORAGE_KEY = 'chatroom.debug.skill-round-log.v1'
export const DEBUG_OBJECT_FLOW_LOG_STORAGE_KEY = 'chatroom.debug.object-flow-log.v1'
export const DEBUG_LOG_ENTRY_LIMIT = 240
export const DEBUG_LOG_TEXT_LIMIT = 6000

export const truncateDebugLogText = (value: string, limit = DEBUG_LOG_TEXT_LIMIT): string =>
  value.length <= limit ? value : `${value.slice(0, limit)}…(truncated ${value.length - limit})`

export const readDebugLogEntries = (storageKey: string): Record<string, unknown>[] => {
  if (typeof localStorage === 'undefined') {
    return []
  }
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) {
      return []
    }
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) {
      return []
    }
    return parsed.filter((item): item is Record<string, unknown> => isRecord(item))
  } catch {
    return []
  }
}

export const appendDebugLogEntry = (storageKey: string, entry: Record<string, unknown>): void => {
  if (typeof localStorage === 'undefined') {
    return
  }
  try {
    const next = [...readDebugLogEntries(storageKey), entry].slice(-DEBUG_LOG_ENTRY_LIMIT)
    localStorage.setItem(storageKey, JSON.stringify(next))
  } catch {
    // Ignore debug log persistence errors.
  }
}

export const clearDebugLogEntries = (storageKey: string): void => {
  if (typeof localStorage === 'undefined') {
    return
  }
  try {
    localStorage.removeItem(storageKey)
  } catch {
    // Ignore debug log cleanup errors.
  }
}

export const buildDebugLogReportText = (
  roundLogs: Record<string, unknown>[],
  objectLogs: Record<string, unknown>[],
): string => {
  const roundTail = roundLogs.slice(-80)
  const objectTail = objectLogs.slice(-160)
  const roundText = JSON.stringify(roundTail, null, 2) ?? '[]'
  const objectText = JSON.stringify(objectTail, null, 2) ?? '[]'

  return [
    `调试日志导出：`,
    `- skill 回合日志总数：${roundLogs.length}（本次导出尾部 ${roundTail.length} 条）`,
    `- 对象流日志总数：${objectLogs.length}（本次导出尾部 ${objectTail.length} 条）`,
    '',
    '## skill 回合日志（输入/回答）',
    '```json',
    roundText,
    '```',
    '',
    '## 界面对象流日志（添加/修改）',
    '```json',
    objectText,
    '```',
  ].join('\n')
}

export const normalizePromptMessagesForDebug = (
  messages: ApiMessage[],
): Array<{ role: ApiRole; content: string | ApiContentPart[] }> =>
  messages.map((message) => ({
    role: message.role,
    content:
      typeof message.content === 'string'
        ? truncateDebugLogText(message.content)
        : message.content.map((part) =>
            part.type === 'text'
              ? {
                  type: 'text' as const,
                  text: truncateDebugLogText(part.text, 1200),
                }
              : {
                  type: 'image_url' as const,
                  image_url: {
                    url: part.image_url.url.startsWith('data:')
                      ? '[data-url omitted]'
                      : truncateDebugLogText(part.image_url.url, 300),
                  },
                },
          ),
  }))
