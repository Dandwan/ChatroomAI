import { buildConversationWorkspaceDirectory } from '../chat-storage/repository'
import {
  ensureDirectory as ensureChatDirectory,
  resolveAbsolutePath as resolveChatAbsolutePath,
} from '../chat-storage/filesystem'
import {
  initializeSkillHost,
  listSkills,
  readSkillConfig,
  resolveSkillRoot,
} from './host'
import { executeDeviceInfoSkillCall } from './device-info'
import { parseRunSimpleCommand } from './run-parser'
import { resolveRunLaunch } from './run-resolver'
import { nativeExecuteRun } from './native-runtime'
import { getPreferredRuntimePaths, listRuntimes } from './runtime'
import {
  SKILL_DIRECTORIES,
  ensureDirectory as ensureSkillDirectory,
  joinRelativePath,
  resolveAbsolutePath as resolveSkillAbsolutePath,
} from './storage'
import type {
  RunAction,
  RunCommandRegistration,
  RunExecutionResult,
  RuntimeRecord,
  SkillCallAction,
  SkillExecutionResult,
} from './types'

const DEFAULT_RUN_WAIT_MS = 3000

export type MaterializedRunAction = RunAction & {
  session: string
}

const normalizeSlashes = (value: string): string => value.replace(/\\/g, '/')

const trimTrailingSlash = (value: string): string =>
  value === '/' ? value : value.replace(/\/+$/, '')

const normalizeAbsolutePath = (value: string): string =>
  trimTrailingSlash(normalizeSlashes(value.trim()))

const normalizeRelativeCwd = (value: string | undefined): string => {
  const normalized = normalizeSlashes((value ?? '').trim())
    .replace(/^\/+/, '')
    .replace(/\/{2,}/g, '/')
    .replace(/\/+$/, '')

  if (!normalized || normalized === '.') {
    return '.'
  }

  const segments = normalized.split('/')
  if (segments.some((segment) => segment === '.' || segment === '..')) {
    throw new Error(`非法 cwd：${value ?? ''}`)
  }

  return normalized
}

const normalizeWaitMs = (value: number | undefined): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return DEFAULT_RUN_WAIT_MS
  }
  return Math.max(0, Math.round(value))
}

const hasRunCommand = (action: Pick<RunAction, 'command'>): boolean =>
  typeof action.command === 'string' && action.command.trim().length > 0

const createGeneratedSession = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `run-${crypto.randomUUID().slice(0, 8)}`
  }
  return `run-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

const normalizeRunSession = (value: string | undefined): string => value?.trim() ?? ''

export const materializeRunAction = (action: RunAction): MaterializedRunAction => {
  const session = normalizeRunSession(action.session)
  if (session) {
    return action.session === session
      ? (action as MaterializedRunAction)
      : {
          ...action,
          session,
        }
  }

  if (!hasRunCommand(action)) {
    throw new Error('查看已有 run 结果时必须显式提供 session')
  }

  return {
    ...action,
    session: createGeneratedSession(),
  }
}

const normalizeScopedSessionPart = (value: string): string =>
  value
    .replace(/\s+/g, ' ')
    .trim()

const buildScopedSession = ({
  root,
  skill,
  cwdAbsolutePath,
  session,
}: {
  root: RunAction['root']
  skill?: string
  cwdAbsolutePath: string
  session: string
}): string =>
  [
    normalizeScopedSessionPart(root),
    normalizeScopedSessionPart(skill ?? ''),
    normalizeScopedSessionPart(cwdAbsolutePath),
    normalizeScopedSessionPart(session),
  ].join('::')

const prioritizeRuntimes = (runtimes: RuntimeRecord[]): RuntimeRecord[] =>
  [...runtimes]
    .filter((runtime) => runtime.enabled)
    .sort((left, right) => {
      if (left.isDefault !== right.isDefault) {
        return left.isDefault ? -1 : 1
      }
      return left.id.localeCompare(right.id)
    })

const buildRunCommandRegistry = async (
  runtimes: RuntimeRecord[],
): Promise<RunCommandRegistration[]> => {
  const registrations = new Map<string, RunCommandRegistration>()

  for (const runtime of prioritizeRuntimes(runtimes)) {
    if (!runtime.binDirectoryPath || !runtime.commands || runtime.commands.length === 0) {
      continue
    }

    const absoluteBinDirectoryPath = await resolveSkillAbsolutePath(runtime.binDirectoryPath)
    for (const command of runtime.commands) {
      const normalizedCommand = command.trim()
      if (!normalizedCommand || registrations.has(normalizedCommand)) {
        continue
      }

      registrations.set(normalizedCommand, {
        command: normalizedCommand,
        executablePath: `${absoluteBinDirectoryPath}/${normalizedCommand}`,
        source: `runtime:${runtime.id}`,
      })
    }
  }

  return Array.from(registrations.values()).sort((left, right) => left.command.localeCompare(right.command))
}

const resolveRunContext = async (
  action: RunAction,
  conversationId: string,
): Promise<{
  homeAbsolutePath: string
  cwdAbsolutePath: string
  baseEnv: Record<string, string>
}> => {
  await ensureSkillDirectory(SKILL_DIRECTORIES.home)
  const homeAbsolutePath = await resolveSkillAbsolutePath(SKILL_DIRECTORIES.home)
  const baseEnv: Record<string, string> = {}

  switch (action.root) {
    case 'skill': {
      const skillId = action.skill?.trim()
      if (!skillId) {
        throw new Error('run 在 skill root 下缺少 skill id')
      }

      const skill = (await listSkills()).find((item) => item.id === skillId)
      if (!skill) {
        throw new Error(`未找到 skill：${skillId}`)
      }
      if (!skill.enabled) {
        throw new Error(`skill 已停用：${skillId}`)
      }

      const { root } = await resolveSkillRoot(skillId)
      const relativeCwd = normalizeRelativeCwd(action.cwd)
      const cwdRelativePath = relativeCwd === '.'
        ? root
        : joinRelativePath(root, relativeCwd)
      const cwdAbsolutePath = await resolveSkillAbsolutePath(cwdRelativePath)
      baseEnv.SKILL_CONFIG_JSON = JSON.stringify(await readSkillConfig(skillId))
      return {
        homeAbsolutePath,
        cwdAbsolutePath,
        baseEnv,
      }
    }

    case 'workspace': {
      const workspaceRelativePath = buildConversationWorkspaceDirectory(conversationId)
      await ensureChatDirectory(workspaceRelativePath)
      const relativeCwd = normalizeRelativeCwd(action.cwd)
      const cwdRelativePath = relativeCwd === '.'
        ? workspaceRelativePath
        : joinRelativePath(workspaceRelativePath, relativeCwd)
      await ensureChatDirectory(cwdRelativePath)
      return {
        homeAbsolutePath,
        cwdAbsolutePath: await resolveChatAbsolutePath(cwdRelativePath),
        baseEnv,
      }
    }

    case 'home': {
      const relativeCwd = normalizeRelativeCwd(action.cwd)
      const cwdRelativePath = relativeCwd === '.'
        ? SKILL_DIRECTORIES.home
        : joinRelativePath(SKILL_DIRECTORIES.home, relativeCwd)
      await ensureSkillDirectory(cwdRelativePath)
      return {
        homeAbsolutePath,
        cwdAbsolutePath: await resolveSkillAbsolutePath(cwdRelativePath),
        baseEnv,
      }
    }

    case 'absolute': {
      const cwdAbsolutePath = action.cwd?.trim()
        ? normalizeAbsolutePath(action.cwd)
        : homeAbsolutePath
      return {
        homeAbsolutePath,
        cwdAbsolutePath,
        baseEnv,
      }
    }

    default:
      throw new Error(`不支持的 run root：${String(action.root)}`)
  }
}

const tryExecuteDeviceInfoRun = async (action: RunAction): Promise<SkillExecutionResult | null> => {
  if (action.root !== 'skill' || action.skill !== 'device-info' || !action.command?.trim()) {
    return null
  }

  const parsed = parseRunSimpleCommand(action.command)
  if (parsed.argv.length === 0) {
    return null
  }

  const target = parsed.argv[0].replace(/^\.\/+/, '')
  if (target !== 'get_device_info' && target !== 'scripts/get_device_info') {
    return null
  }

  const legacyAction: SkillCallAction = {
    kind: 'skill_call',
    id: action.id,
    skill: action.skill,
    script: 'scripts/get_device_info',
    argv: parsed.argv.slice(1),
    stdin: action.stdin,
    env: {
      ...parsed.env,
      ...(action.env ?? {}),
    },
    timeoutMs: undefined,
  }

  return executeDeviceInfoSkillCall(legacyAction)
}

export const executeRunAction = async (
  action: RunAction,
  conversationId: string,
): Promise<RunExecutionResult> => {
  await initializeSkillHost()

  const effectiveAction = materializeRunAction(action)
  const hasCommand = hasRunCommand(effectiveAction)
  const session = effectiveAction.session

  const deviceInfoExecution = await tryExecuteDeviceInfoRun(effectiveAction)
  if (deviceInfoExecution) {
    return {
      ok: deviceInfoExecution.ok,
      running: false,
      session,
      stdout: deviceInfoExecution.stdout,
      stderr: deviceInfoExecution.stderr,
      exitCode: deviceInfoExecution.exitCode,
      elapsedMs: Math.round(deviceInfoExecution.elapsedMs),
      waitedMs: normalizeWaitMs(effectiveAction.waitMs),
      resolvedCommand: deviceInfoExecution.resolvedCommand,
      resolvedCwd: effectiveAction.cwd?.trim() || '.',
      inferredRuntime: deviceInfoExecution.inferredRuntime,
      updatedAt: Date.now(),
      completedAt: Date.now(),
    }
  }

  const waitMs = normalizeWaitMs(effectiveAction.waitMs)
  const runtimeRecords = await listRuntimes()
  const commandRegistry = await buildRunCommandRegistry(runtimeRecords)
  const { homeAbsolutePath, cwdAbsolutePath, baseEnv } = await resolveRunContext(
    effectiveAction,
    conversationId,
  )
  const preferredRuntimePaths = await getPreferredRuntimePaths()
  const parsedCommand = effectiveAction.command?.trim()
    ? parseRunSimpleCommand(effectiveAction.command)
    : {
        env: {},
        argv: [],
      }
  const resolvedLaunch = resolveRunLaunch({
    action: effectiveAction,
    parsedArgv: parsedCommand.argv,
    cwdAbsolutePath,
    homeAbsolutePath,
    commandRegistry,
    pythonExecutablePath: preferredRuntimePaths.pythonExecutablePath
      ? await resolveSkillAbsolutePath(preferredRuntimePaths.pythonExecutablePath)
      : undefined,
    nodeExecutablePath: preferredRuntimePaths.nodeExecutablePath
      ? await resolveSkillAbsolutePath(preferredRuntimePaths.nodeExecutablePath)
      : undefined,
  })

  return nativeExecuteRun({
    sessionId: buildScopedSession({
      root: effectiveAction.root,
      skill: effectiveAction.skill,
      cwdAbsolutePath,
      session,
    }),
    session: hasCommand ? session : undefined,
    workingDirectoryPath: cwdAbsolutePath,
    waitMs,
    stdin: effectiveAction.stdin,
    env: {
      ...baseEnv,
      ...parsedCommand.env,
      ...(effectiveAction.env ?? {}),
    },
    launchKind: resolvedLaunch?.kind,
    targetPath: resolvedLaunch?.targetPath,
    args: resolvedLaunch?.args,
    pythonExecutablePath: resolvedLaunch?.pythonExecutablePath,
    nodeExecutablePath: resolvedLaunch?.nodeExecutablePath,
    inferredRuntime: resolvedLaunch?.inferredRuntime,
  })
}
