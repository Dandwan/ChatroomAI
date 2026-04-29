import {
  installZipDirectory,
  joinRelativePath,
  listDirectory,
  pathExists,
  readJsonFile,
  writeJsonFile,
} from './storage'
import {
  isNativeRuntimeAvailable,
  nativeInstallBundledRuntime,
  nativeInspectRuntime,
  nativePreparePath,
  nativeTestRuntime,
} from './native-runtime'
import type { RuntimeInstallResult, RuntimeRecord, RuntimeType } from './types'

interface RuntimeHostState {
  enabledById: Record<string, boolean>
  defaultByType: Partial<Record<Exclude<RuntimeType, 'unknown'>, string>>
  metadataById: Record<string, RuntimeMetadata>
}

type RuntimeMetadata = Pick<
  RuntimeRecord,
  'id' | 'type' | 'version' | 'executablePath' | 'binDirectoryPath' | 'commands' | 'displayName'
>

interface RuntimeManifestFile {
  type?: string
  version?: string
  displayName?: string
  entrypoint?: string
  binDirectory?: string
  commands?: string[]
}

const DEFAULT_STATE: RuntimeHostState = {
  enabledById: {},
  defaultByType: {},
  metadataById: {},
}

const RUNTIMES_ROOT = 'skill-host/runtimes'
const STATE_PATH = 'skill-host/state/runtimes.json'
const BUNDLED_RUNTIME_ARCHIVES = [
  {
    id: 'nodejs-termux-aarch64',
    assetPath: 'public/runtime-packages/nodejs-termux-aarch64.zip',
  },
  {
    id: 'python-termux-aarch64-scientific',
    assetPath: 'public/runtime-packages/python-termux-aarch64-scientific.zip',
  },
] as const

const guessRuntimeType = (folderName: string): RuntimeType => {
  const normalized = folderName.toLowerCase()
  if (normalized.includes('python')) {
    return 'python'
  }
  if (normalized.includes('node')) {
    return 'node'
  }
  return 'unknown'
}

const readState = async (): Promise<RuntimeHostState> => readJsonFile(STATE_PATH, DEFAULT_STATE)

const writeState = async (state: RuntimeHostState): Promise<void> => {
  await writeJsonFile(STATE_PATH, state)
}

const normalizeCommandName = (value: string): string => value.trim().replace(/\\/g, '/')

const sanitizeRuntimeCommands = (values: string[] | undefined): string[] | undefined => {
  if (!values || values.length === 0) {
    return undefined
  }

  const normalized = values
    .map((value) => normalizeCommandName(value))
    .filter((value) => value.length > 0 && !value.includes('/'))

  if (normalized.length === 0) {
    return undefined
  }

  return Array.from(new Set(normalized)).sort((left, right) => left.localeCompare(right))
}

const resolveRuntimeBinDirectoryPath = async (
  relativeRoot: string,
  executablePath: string,
  explicitBinDirectory?: string,
): Promise<string | undefined> => {
  const manifestBinDirectory = explicitBinDirectory?.trim()
  if (manifestBinDirectory) {
    const manifestPath = joinRelativePath(relativeRoot, manifestBinDirectory)
    if (await pathExists(manifestPath)) {
      return manifestPath
    }
  }

  const conventionalPath = joinRelativePath(relativeRoot, 'bin')
  if (await pathExists(conventionalPath)) {
    return conventionalPath
  }

  const normalizedExecutablePath = executablePath.trim()
  if (!normalizedExecutablePath) {
    return undefined
  }

  const segments = normalizedExecutablePath.split('/').filter(Boolean)
  if (segments.length <= 1) {
    return undefined
  }

  return segments.slice(0, -1).join('/')
}

const inspectRuntimeCommands = async (
  relativeBinDirectoryPath: string | undefined,
  manifestCommands?: string[],
): Promise<string[] | undefined> => {
  const explicitCommands = sanitizeRuntimeCommands(manifestCommands)
  if (explicitCommands) {
    return explicitCommands
  }

  if (!relativeBinDirectoryPath || !(await pathExists(relativeBinDirectoryPath))) {
    return undefined
  }

  const discovered = sanitizeRuntimeCommands(await listDirectory(relativeBinDirectoryPath))
  return discovered && discovered.length > 0 ? discovered : undefined
}

const ensureDefaultRuntimeSelection = (
  state: RuntimeHostState,
  runtimes: Array<Pick<RuntimeRecord, 'id' | 'type' | 'enabled'>>,
): void => {
  for (const type of ['python', 'node'] as const) {
    const current = state.defaultByType[type]
    const currentExists = runtimes.some((runtime) => runtime.id === current && runtime.type === type)
    if (currentExists) {
      continue
    }
    const fallback = runtimes.find((runtime) => runtime.type === type && runtime.enabled)
    if (fallback) {
      state.defaultByType[type] = fallback.id
      continue
    }
    delete state.defaultByType[type]
  }
}

const persistInstalledRuntimeMetadata = (
  state: RuntimeHostState,
  runtimeId: string,
  metadata: RuntimeMetadata,
): void => {
  state.enabledById[runtimeId] = state.enabledById[runtimeId] ?? true
  state.metadataById[runtimeId] = {
    ...metadata,
    id: runtimeId,
  }
  if ((metadata.type === 'python' || metadata.type === 'node') && !state.defaultByType[metadata.type]) {
    state.defaultByType[metadata.type] = runtimeId
  }
}

const shouldRefreshRuntimeMetadata = (
  cached: RuntimeMetadata | undefined,
  folderName: string,
): boolean => {
  if (!cached) {
    return true
  }

  if (!cached.executablePath?.trim()) {
    return true
  }

  if (!cached.binDirectoryPath?.trim()) {
    return true
  }

  if (!cached.commands || cached.commands.length === 0) {
    return true
  }

  if (cached.type !== 'unknown' && cached.version === folderName && cached.displayName === folderName) {
    return true
  }

  return false
}

const normalizeRuntimeType = (value: string | undefined, folderName: string): RuntimeType => {
  const normalized = value?.trim().toLowerCase()
  if (normalized === 'python' || normalized === 'node' || normalized === 'unknown') {
    return normalized
  }
  return guessRuntimeType(folderName)
}

const inspectRuntimeManifest = async (folderName: string): Promise<RuntimeMetadata | null> => {
  const relativeRoot = joinRelativePath(RUNTIMES_ROOT, folderName)
  const manifest = await readJsonFile<RuntimeManifestFile | null>(
    joinRelativePath(relativeRoot, 'runtime.json'),
    null,
  )

  if (!manifest || typeof manifest !== 'object') {
    return null
  }

  const entrypoint = manifest.entrypoint?.trim()
  const executablePath =
    entrypoint && (await pathExists(joinRelativePath(relativeRoot, entrypoint)))
      ? joinRelativePath(relativeRoot, entrypoint)
      : ''
  const binDirectoryPath = await resolveRuntimeBinDirectoryPath(
    relativeRoot,
    executablePath,
    manifest.binDirectory,
  )
  const commands = await inspectRuntimeCommands(binDirectoryPath, manifest.commands)

  return {
    id: folderName,
    type: normalizeRuntimeType(manifest.type, folderName),
    version: manifest.version?.trim() || folderName,
    executablePath,
    binDirectoryPath,
    commands,
    displayName: manifest.displayName?.trim() || folderName,
  }
}

const inspectRuntimeDirectory = async (folderName: string): Promise<RuntimeMetadata> => {
  const manifestMetadata = await inspectRuntimeManifest(folderName)
  if (manifestMetadata?.executablePath) {
    return manifestMetadata
  }

  const relativePath = joinRelativePath(RUNTIMES_ROOT, folderName)
  try {
    const nativeMetadata = {
      ...(await nativeInspectRuntime(relativePath)),
      id: folderName,
    }
    const executablePath = nativeMetadata.executablePath || manifestMetadata?.executablePath || ''
    const binDirectoryPath = await resolveRuntimeBinDirectoryPath(
      relativePath,
      executablePath,
      undefined,
    )
    const commands = await inspectRuntimeCommands(binDirectoryPath, manifestMetadata?.commands)
    return {
      id: folderName,
      type: normalizeRuntimeType(nativeMetadata.type, folderName),
      version: nativeMetadata.version?.trim() || manifestMetadata?.version || folderName,
      executablePath,
      binDirectoryPath,
      commands,
      displayName: nativeMetadata.displayName?.trim() || manifestMetadata?.displayName || folderName,
    }
  } catch {
    if (manifestMetadata) {
      return manifestMetadata
    }
    const type = guessRuntimeType(folderName)
    return {
      id: folderName,
      type,
      version: folderName,
      executablePath: '',
      binDirectoryPath: undefined,
      commands: undefined,
      displayName: folderName,
    }
  }
}

export const initializeRuntimeHost = async (): Promise<void> => {
  const state = await readState()
  await writeState({
    ...DEFAULT_STATE,
    ...state,
    enabledById: { ...DEFAULT_STATE.enabledById, ...state.enabledById },
    metadataById: { ...DEFAULT_STATE.metadataById, ...state.metadataById },
  })
}

export const ensureBundledRuntimesInstalled = async (): Promise<void> => {
  if (!isNativeRuntimeAvailable()) {
    return
  }
  await initializeRuntimeHost()
  const state = await readState()
  const installed = new Set(await listDirectory(RUNTIMES_ROOT))
  for (const bundled of BUNDLED_RUNTIME_ARCHIVES) {
    try {
      if (installed.has(bundled.id)) {
        const existing = await inspectRuntimeDirectory(bundled.id)
        if (existing.executablePath) {
          persistInstalledRuntimeMetadata(state, bundled.id, existing)
          continue
        }
      }

      await nativeInstallBundledRuntime(bundled.assetPath, bundled.id)
      await nativePreparePath(joinRelativePath(RUNTIMES_ROOT, bundled.id))
      const metadata = await inspectRuntimeDirectory(bundled.id)
      persistInstalledRuntimeMetadata(state, bundled.id, metadata)
      installed.add(bundled.id)
    } catch (error) {
      console.warn(
        `Bundled runtime install skipped for ${bundled.id}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      )
    }
  }
  await writeState(state)
}

export const listRuntimes = async (): Promise<RuntimeRecord[]> => {
  await initializeRuntimeHost()
  const state = await readState()
  const folders = await listDirectory(RUNTIMES_ROOT)
  const results: Array<RuntimeRecord & { isDefault: boolean }> = []

  for (const folderName of folders) {
    const cached = state.metadataById[folderName]
    const metadata =
      shouldRefreshRuntimeMetadata(cached, folderName)
        ? ({
            ...(await inspectRuntimeDirectory(folderName)),
            id: folderName,
          } as RuntimeHostState['metadataById'][string])
        : cached
    state.metadataById[folderName] = metadata
    results.push({
      ...metadata,
      id: folderName,
      enabled: state.enabledById[folderName] ?? true,
      isDefault: false,
      installedAt: 0,
      folderName,
    })
  }

  const sorted = results.sort((left, right) => left.id.localeCompare(right.id))
  ensureDefaultRuntimeSelection(state, sorted)
  const normalized = sorted.map((runtime) => ({
    ...runtime,
    isDefault:
      (runtime.type === 'python' || runtime.type === 'node') &&
      state.defaultByType[runtime.type] === runtime.id,
  }))

  await writeState(state)
  return normalized
}

export const installRuntimePackage = async (file: File): Promise<RuntimeInstallResult> => {
  await initializeRuntimeHost()
  const state = await readState()
  const { rootFolder, replacedExisting } = await installZipDirectory(file, RUNTIMES_ROOT)
  const relativePath = joinRelativePath(RUNTIMES_ROOT, rootFolder)
  await nativePreparePath(relativePath)
  const metadata = await inspectRuntimeDirectory(rootFolder)
  persistInstalledRuntimeMetadata(state, rootFolder, metadata)
  await writeState(state)

  return {
    runtime: {
      ...metadata,
      id: rootFolder,
      enabled: true,
      isDefault:
        (metadata.type === 'python' || metadata.type === 'node') &&
        state.defaultByType[metadata.type] === rootFolder,
      installedAt: Date.now(),
      folderName: rootFolder,
    },
    replacedExisting,
  }
}

export const setRuntimeEnabled = async (runtimeId: string, enabled: boolean): Promise<void> => {
  await initializeRuntimeHost()
  const state = await readState()
  state.enabledById[runtimeId] = enabled
  await writeState(state)
}

export const setDefaultRuntime = async (
  type: Exclude<RuntimeType, 'unknown'>,
  runtimeId: string,
): Promise<void> => {
  await initializeRuntimeHost()
  const state = await readState()
  state.defaultByType[type] = runtimeId
  await writeState(state)
}

export const deleteRuntime = async (runtimeId: string): Promise<void> => {
  const { deletePath } = await import('./storage')
  await initializeRuntimeHost()
  const state = await readState()
  await deletePath(joinRelativePath(RUNTIMES_ROOT, runtimeId))
  delete state.enabledById[runtimeId]
  delete state.metadataById[runtimeId]
  if (state.defaultByType.python === runtimeId) {
    delete state.defaultByType.python
  }
  if (state.defaultByType.node === runtimeId) {
    delete state.defaultByType.node
  }
  await writeState(state)
}

export const getPreferredRuntimePaths = async (): Promise<{
  pythonExecutablePath?: string
  nodeExecutablePath?: string
}> => {
  const runtimes = await listRuntimes()
  const state = await readState()

  const resolve = (type: Exclude<RuntimeType, 'unknown'>): string | undefined => {
    const preferred = state.defaultByType[type]
    const candidate =
      runtimes.find((runtime) => runtime.id === preferred && runtime.enabled) ??
      runtimes.find((runtime) => runtime.type === type && runtime.enabled)
    return candidate?.executablePath || undefined
  }

  return {
    pythonExecutablePath: resolve('python'),
    nodeExecutablePath: resolve('node'),
  }
}

export const testRuntime = async (runtimeId: string): Promise<RuntimeRecord> => {
  await initializeRuntimeHost()
  const runtimes = await listRuntimes()
  const runtime = runtimes.find((item) => item.id === runtimeId)
  if (!runtime) {
    throw new Error(`未找到运行时：${runtimeId}`)
  }

  if (!runtime.executablePath) {
    return {
      ...runtime,
      testStatus: 'error',
      testMessage: '未找到可执行入口。',
    }
  }

  const result = await nativeTestRuntime(runtime.executablePath, ['--version'])
  return {
    ...runtime,
    testStatus: result.ok ? 'ok' : 'error',
    testMessage: result.ok ? (result.stdout || result.stderr).trim() : result.stderr.trim() || '测试失败',
  }
}
