import { buildConversationWorkspaceDirectory } from '../chat-storage/repository'
import { resolveAbsolutePath } from '../chat-storage/filesystem'

export const INFO_PROMPT_SETTING_KEYS = [
  'deviceInfoPromptEnabled',
  'workspaceInfoPromptEnabled',
] as const

export type InfoPromptSettingKey = (typeof INFO_PROMPT_SETTING_KEYS)[number]

export interface InfoPromptDefinition {
  key: InfoPromptSettingKey
  title: string
  globalDescription: string
  providerDescription: string
}

export interface DeviceInfoPromptSnapshot {
  systemLabel: string
  platform: string | null
  language: string | null
  timezone: string | null
  currentDate: string
  currentDateTime: string
}

export interface WorkspaceInfoPromptSnapshot {
  workspacePath: string
  createdAt: string
  updatedAt: string
}

const padTwoDigits = (value: number): string => String(value).padStart(2, '0')

const formatPromptDate = (date: Date): string =>
  `${date.getFullYear()}-${padTwoDigits(date.getMonth() + 1)}-${padTwoDigits(date.getDate())}`

const formatPromptDateTime = (date: Date): string =>
  `${formatPromptDate(date)} ${padTwoDigits(date.getHours())}:${padTwoDigits(
    date.getMinutes(),
  )}:${padTwoDigits(date.getSeconds())}`

const normalizeVersion = (value: string): string => value.replace(/_/g, '.')

const inferSystemLabel = (userAgent: string | null, platform: string | null): string => {
  const normalizedUserAgent = userAgent ?? ''

  const androidMatch = normalizedUserAgent.match(/Android\s+([0-9.]+)/i)
  if (androidMatch?.[1]) {
    return `Android ${normalizeVersion(androidMatch[1])}`
  }

  const iosMatch = normalizedUserAgent.match(/(?:CPU(?: iPhone)? OS|iPhone OS)\s+([0-9_]+)/i)
  if (iosMatch?.[1]) {
    return `iOS ${normalizeVersion(iosMatch[1])}`
  }

  const ipadOsMatch = normalizedUserAgent.match(/CPU OS\s+([0-9_]+)/i)
  if (ipadOsMatch?.[1]) {
    return `iPadOS ${normalizeVersion(ipadOsMatch[1])}`
  }

  const windowsMatch = normalizedUserAgent.match(/Windows NT\s+([0-9.]+)/i)
  if (windowsMatch?.[1]) {
    return `Windows ${windowsMatch[1]}`
  }

  const macMatch = normalizedUserAgent.match(/Mac OS X\s+([0-9_]+)/i)
  if (macMatch?.[1]) {
    return `macOS ${normalizeVersion(macMatch[1])}`
  }

  if (/Linux/i.test(normalizedUserAgent)) {
    return 'Linux'
  }

  return platform?.trim() || '未知系统'
}

const buildMarkdownSection = (title: string, rows: string[]): string =>
  [`## ${title}`, ...rows.map((row) => `- ${row}`)].join('\n')

export const createDeviceInfoPromptSnapshot = (): DeviceInfoPromptSnapshot => {
  const now = new Date()
  const userAgent =
    typeof navigator !== 'undefined' && typeof navigator.userAgent === 'string'
      ? navigator.userAgent
      : null
  const platform =
    typeof navigator !== 'undefined' && typeof navigator.platform === 'string'
      ? navigator.platform
      : null
  const language =
    typeof navigator !== 'undefined' && typeof navigator.language === 'string'
      ? navigator.language
      : null
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? null

  return {
    systemLabel: inferSystemLabel(userAgent, platform),
    platform: platform?.trim() || null,
    language: language?.trim() || null,
    timezone: timezone?.trim() || null,
    currentDate: formatPromptDate(now),
    currentDateTime: formatPromptDateTime(now),
  }
}

export const createWorkspaceInfoPromptSnapshot = (
  absoluteWorkspacePath: string,
  createdAt: number,
  updatedAt: number,
): WorkspaceInfoPromptSnapshot => ({
  workspacePath: absoluteWorkspacePath,
  createdAt: formatPromptDateTime(new Date(createdAt)),
  updatedAt: formatPromptDateTime(new Date(updatedAt)),
})

export const resolveWorkspaceInfoPromptPath = async (conversationId: string): Promise<string> => {
  const relativeWorkspacePath = buildConversationWorkspaceDirectory(conversationId)

  try {
    const absoluteWorkspacePath = await resolveAbsolutePath(relativeWorkspacePath)
    return absoluteWorkspacePath.endsWith('/') ? absoluteWorkspacePath : `${absoluteWorkspacePath}/`
  } catch {
    return `${relativeWorkspacePath}/`
  }
}

export const buildDeviceInfoPromptMarkdown = (snapshot: DeviceInfoPromptSnapshot): string =>
  buildMarkdownSection(
    '当前设备信息',
    [
      `系统：${snapshot.systemLabel}`,
      `平台：${snapshot.platform ?? '未知'}`,
      `语言：${snapshot.language ?? '未知'}`,
      `当前日期：${snapshot.currentDate}`,
      `当前时间：${snapshot.currentDateTime}`,
      `当前时区：${snapshot.timezone ?? '未知'}`,
    ],
  )

export const buildWorkspaceInfoPromptMarkdown = (snapshot: WorkspaceInfoPromptSnapshot): string =>
  buildMarkdownSection(
    '当前对话工作区信息',
    [
      `工作区路径：\`${snapshot.workspacePath}\``,
      `对话创建时间（createdAt）：${snapshot.createdAt}`,
      `对话更新时间（updatedAt）：${snapshot.updatedAt}`,
    ],
  )

export const INFO_PROMPT_DEFINITIONS: InfoPromptDefinition[] = [
  {
    key: 'deviceInfoPromptEnabled',
    title: '当前设备信息',
    globalDescription:
      '将当前设备的系统、平台、语言、日期、时间与时区以 Markdown 形式拼进系统提示词。',
    providerDescription:
      '控制该服务商是否额外把当前设备的系统、平台、语言、日期、时间与时区以 Markdown 形式拼进系统提示词；恢复跟随后将完全使用全局设置。',
  },
  {
    key: 'workspaceInfoPromptEnabled',
    title: '工作区信息',
    globalDescription:
      '将当前对话的 workspace 路径、创建时间和更新时间以 Markdown 形式拼进系统提示词。',
    providerDescription:
      '控制该服务商是否额外把当前对话的 workspace 路径、创建时间和更新时间以 Markdown 形式拼进系统提示词；恢复跟随后将完全使用全局设置。',
  },
]

export const DEFAULT_INFO_PROMPT_SETTINGS: Record<InfoPromptSettingKey, boolean> = {
  deviceInfoPromptEnabled: true,
  workspaceInfoPromptEnabled: true,
}

export const normalizeInfoPromptOverride = (value: unknown): boolean | undefined =>
  typeof value === 'boolean' ? value : undefined
