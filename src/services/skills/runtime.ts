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

type RuntimeMetadata = Pick<RuntimeRecord, 'id' | 'type' | 'version' | 'executablePath' | 'displayName'>

interface RuntimeManifestFile {
  type?: string
  version?: string
  displayName?: string
  entrypoint?: string
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

  return {
    id: folderName,
    type: normalizeRuntimeType(manifest.type, folderName),
    version: manifest.version?.trim() || folderName,
    executablePath,
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
    return {
      id: folderName,
      type: normalizeRuntimeType(nativeMetadata.type, folderName),
      version: nativeMetadata.version?.trim() || manifestMetadata?.version || folderName,
      executablePath: nativeMetadata.executablePath || manifestMetadata?.executablePath || '',
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
  const installed = new Set(await listDirectory(RUNTIMES_ROOT))
  for (const bundled of BUNDLED_RUNTIME_ARCHIVES) {
    if (installed.has(bundled.id)) {
      const existing = await inspectRuntimeDirectory(bundled.id)
      if (existing.executablePath) {
        continue
      }
    }
    await nativeInstallBundledRuntime(bundled.assetPath, bundled.id)
    await nativePreparePath(joinRelativePath(RUNTIMES_ROOT, bundled.id))
    installed.add(bundled.id)
  }
}

export const listRuntimes = async (): Promise<RuntimeRecord[]> => {
  await initializeRuntimeHost()
  const state = await readState()
  const folders = await listDirectory(RUNTIMES_ROOT)
  const results: RuntimeRecord[] = []

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
      isDefault:
        (metadata.type === 'python' || metadata.type === 'node') &&
        state.defaultByType[metadata.type] === folderName,
      installedAt: 0,
      folderName,
    })
  }

  await writeState(state)
  return results.sort((left, right) => left.id.localeCompare(right.id))
}

export const installRuntimePackage = async (file: File): Promise<RuntimeInstallResult> => {
  await initializeRuntimeHost()
  const state = await readState()
  const { rootFolder, replacedExisting } = await installZipDirectory(file, RUNTIMES_ROOT)
  const relativePath = joinRelativePath(RUNTIMES_ROOT, rootFolder)
  await nativePreparePath(relativePath)
  const metadata = await inspectRuntimeDirectory(rootFolder)
  state.enabledById[rootFolder] = true
  state.metadataById[rootFolder] = {
    ...metadata,
    id: rootFolder,
  }
  if ((metadata.type === 'python' || metadata.type === 'node') && !state.defaultByType[metadata.type]) {
    state.defaultByType[metadata.type] = rootFolder
  }
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
