import type {
  RunAction,
  RunCommandRegistration,
  RunResolvedLaunch,
} from './types'

const SYSTEM_COMMAND_DIRECTORIES = [
  '/system/bin',
  '/system/xbin',
  '/apex/com.android.runtime/bin',
] as const

const normalizeSlashes = (value: string): string => value.replace(/\\/g, '/')

const trimTrailingSlash = (value: string): string =>
  value === '/' ? value : value.replace(/\/+$/, '')

const joinAbsolutePath = (basePath: string, relativePath: string): string =>
  trimTrailingSlash(`${trimTrailingSlash(normalizeSlashes(basePath))}/${relativePath.replace(/^\/+/, '')}`)

const normalizeAbsolutePath = (value: string): string =>
  trimTrailingSlash(normalizeSlashes(value.trim()))

const isAbsolutePath = (value: string): boolean => {
  const normalized = normalizeSlashes(value.trim())
  return normalized.startsWith('/') || /^[A-Za-z]:\//.test(normalized)
}

const isPathLikeCommand = (value: string): boolean =>
  value.includes('/') || value.startsWith('.') || value.startsWith('~')

const expandHomePath = (value: string, homeAbsolutePath: string): string => {
  if (value === '~') {
    return homeAbsolutePath
  }
  if (value.startsWith('~/')) {
    return joinAbsolutePath(homeAbsolutePath, value.slice(2))
  }
  return value
}

const ensureAbsoluteWorkingDirectory = ({
  root,
  cwdAbsolutePath,
}: {
  root: RunAction['root']
  cwdAbsolutePath: string
}): string => {
  if (root === 'absolute' && !isAbsolutePath(cwdAbsolutePath)) {
    throw new Error('absolute root 的 cwd 必须是绝对路径')
  }
  return normalizeAbsolutePath(cwdAbsolutePath)
}

export const resolveRunLaunch = ({
  action,
  parsedArgv,
  cwdAbsolutePath,
  homeAbsolutePath,
  commandRegistry,
  pythonExecutablePath,
  nodeExecutablePath,
}: {
  action: RunAction
  parsedArgv: string[]
  cwdAbsolutePath: string
  homeAbsolutePath: string
  commandRegistry: RunCommandRegistration[]
  pythonExecutablePath?: string
  nodeExecutablePath?: string
}): RunResolvedLaunch | null => {
  if (parsedArgv.length === 0) {
    return null
  }

  const executableToken = expandHomePath(parsedArgv[0], homeAbsolutePath)
  const args = parsedArgv.slice(1)
  const absoluteCwd = ensureAbsoluteWorkingDirectory({
    root: action.root,
    cwdAbsolutePath,
  })

  if (isPathLikeCommand(executableToken)) {
    const targetPath = isAbsolutePath(executableToken)
      ? normalizeAbsolutePath(executableToken)
      : joinAbsolutePath(absoluteCwd, executableToken)
    return {
      kind: 'file',
      targetPath,
      args,
      pythonExecutablePath,
      nodeExecutablePath,
    }
  }

  const runtimeCommand = commandRegistry.find((entry) => entry.command === executableToken)
  if (runtimeCommand) {
    return {
      kind: 'executable',
      targetPath: runtimeCommand.executablePath,
      args,
      inferredRuntime: runtimeCommand.source.startsWith('runtime:') ? 'native' : 'system',
    }
  }

  return {
    kind: 'executable',
    targetPath: SYSTEM_COMMAND_DIRECTORIES
      .map((directoryPath) => `${directoryPath}/${executableToken}`)
      .find(Boolean) ?? executableToken,
    args,
    inferredRuntime: 'system',
  }
}
