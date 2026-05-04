import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core'
import type {
  ReadListEntry,
  RunExecutionResult,
  RuntimeType,
  SkillExecutionRequest,
  SkillExecutionResult,
} from './types'

interface PreparePathOptions {
  relativePath: string
}

interface InstallBundledRuntimeOptions {
  assetPath: string
  runtimeId: string
}

interface InspectRuntimeOptions {
  relativePath: string
}

interface InspectRuntimeResult {
  type: RuntimeType
  version: string
  executablePath: string
  binDirectoryPath?: string
  commands?: string[]
  displayName: string
}

interface ExecuteProcessOptions extends SkillExecutionRequest {
  relativeSkillRoot: string
  relativeWorkingDirectory?: string
  pythonExecutablePath?: string
  nodeExecutablePath?: string
}

interface ExecuteRunOptions {
  sessionId: string
  session?: string
  workingDirectoryPath: string
  waitMs?: number
  stdin?: string
  env?: Record<string, string>
  launchKind?: 'file' | 'executable'
  targetPath?: string
  args?: string[]
  pythonExecutablePath?: string
  nodeExecutablePath?: string
  inferredRuntime?: string
}

interface AbsoluteDirectoryEntry {
  path: string
  name: string
  type?: string
  size?: number
}

interface ListAbsoluteDirectoryOptions {
  absolutePath: string
}

interface ListAbsoluteDirectoryResult {
  path: string
  entries: AbsoluteDirectoryEntry[]
}

interface StatAbsolutePathOptions {
  absolutePath: string
}

interface StatAbsolutePathResult {
  path: string
  type?: string
  size?: number
}

interface ReadAbsoluteTextFileOptions {
  absolutePath: string
}

interface ReadAbsoluteTextFileResult {
  path: string
  content: string
}

interface WriteAbsoluteTextFileOptions {
  absolutePath: string
  content: string
}

interface TestRuntimeOptions {
  executablePath: string
  args?: string[]
}

interface TestRuntimeResult {
  ok: boolean
  stdout: string
  stderr: string
  exitCode: number
}

interface LastKnownLocationResult {
  available: boolean
  reason?: string
  provider?: string
  latitude?: number
  longitude?: number
  accuracyMeters?: number | null
  altitude?: number | null
  speed?: number | null
  bearing?: number | null
  timestamp?: number
}

interface NativeRuntimePlugin {
  preparePath(options: PreparePathOptions): Promise<void>
  installBundledRuntime(options: InstallBundledRuntimeOptions): Promise<void>
  inspectRuntime(options: InspectRuntimeOptions): Promise<InspectRuntimeResult>
  executeProcess(options: ExecuteProcessOptions): Promise<SkillExecutionResult>
  executeRun(options: ExecuteRunOptions): Promise<RunExecutionResult>
  listAbsoluteDirectory(options: ListAbsoluteDirectoryOptions): Promise<ListAbsoluteDirectoryResult>
  statAbsolutePath(options: StatAbsolutePathOptions): Promise<StatAbsolutePathResult>
  readAbsoluteTextFile(options: ReadAbsoluteTextFileOptions): Promise<ReadAbsoluteTextFileResult>
  writeAbsoluteTextFile(options: WriteAbsoluteTextFileOptions): Promise<void>
  testRuntime(options: TestRuntimeOptions): Promise<TestRuntimeResult>
  getLastKnownLocation(): Promise<LastKnownLocationResult>
  addListener(eventName: string, listenerFunc: (data: unknown) => void): Promise<PluginListenerHandle>
  removeAllListeners(): Promise<void>
}

const NativeRuntime = registerPlugin<NativeRuntimePlugin>('SkillRuntime', {
  web: () => ({
    async preparePath() {
      return
    },
    async installBundledRuntime() {
      throw new Error('当前平台不支持内置运行时安装。')
    },
    async inspectRuntime() {
      throw new Error('当前平台不支持外部运行时。')
    },
    async executeProcess() {
      throw new Error('当前平台不支持外部脚本执行。')
    },
    async executeRun() {
      throw new Error('当前平台不支持 run 执行。')
    },
    async listAbsoluteDirectory() {
      throw new Error('当前平台不支持系统根目录访问。')
    },
    async statAbsolutePath() {
      throw new Error('当前平台不支持系统根目录访问。')
    },
    async readAbsoluteTextFile() {
      throw new Error('当前平台不支持系统根目录访问。')
    },
    async writeAbsoluteTextFile() {
      throw new Error('当前平台不支持系统根目录访问。')
    },
    async testRuntime() {
      throw new Error('当前平台不支持运行时测试。')
    },
    async getLastKnownLocation() {
      return {
        available: false,
        reason: 'not-supported-on-web',
      }
    },
    async addListener() {
      return {
        remove: async () => undefined,
      }
    },
    async removeAllListeners() {
      return
    },
  }),
})

export const isNativeRuntimeAvailable = (): boolean => Capacitor.isNativePlatform()

export const nativePreparePath = async (relativePath: string): Promise<void> => {
  if (!isNativeRuntimeAvailable()) {
    return
  }
  await NativeRuntime.preparePath({ relativePath })
}

export const nativeInstallBundledRuntime = async (
  assetPath: string,
  runtimeId: string,
): Promise<void> => {
  if (!isNativeRuntimeAvailable()) {
    return
  }
  await NativeRuntime.installBundledRuntime({
    assetPath,
    runtimeId,
  })
}

export const nativeInspectRuntime = async (relativePath: string): Promise<InspectRuntimeResult> =>
  NativeRuntime.inspectRuntime({ relativePath })

export const nativeExecuteProcess = async (
  options: ExecuteProcessOptions,
): Promise<SkillExecutionResult> => NativeRuntime.executeProcess(options)

export const nativeExecuteRun = async (
  options: ExecuteRunOptions,
): Promise<RunExecutionResult> => NativeRuntime.executeRun(options)

export const nativeListAbsoluteDirectory = async (
  absolutePath: string,
): Promise<{
  path: string
  entries: Array<{
    path: string
    name: string
    kind: ReadListEntry['kind']
    size?: number
  }>
}> => {
  const result = await NativeRuntime.listAbsoluteDirectory({ absolutePath })
  return {
    path: result.path,
    entries: result.entries.map((entry) => ({
      path: entry.path,
      name: entry.name,
      kind: entry.type === 'directory' ? 'directory' : 'file',
      size: entry.type === 'directory' ? undefined : entry.size,
    })),
  }
}

export const nativeStatAbsolutePath = async (
  absolutePath: string,
): Promise<{
  path: string
  entryType: 'file' | 'directory'
  size?: number
}> => {
  const result = await NativeRuntime.statAbsolutePath({ absolutePath })
  return {
    path: result.path,
    entryType: result.type === 'directory' ? 'directory' : 'file',
    size: result.type === 'directory' ? undefined : result.size,
  }
}

export const nativeReadAbsoluteTextFile = async (
  absolutePath: string,
): Promise<ReadAbsoluteTextFileResult> =>
  NativeRuntime.readAbsoluteTextFile({ absolutePath })

export const nativeWriteAbsoluteTextFile = async (
  absolutePath: string,
  content: string,
): Promise<void> =>
  NativeRuntime.writeAbsoluteTextFile({
    absolutePath,
    content,
  })

export const nativeTestRuntime = async (
  executablePath: string,
  args: string[] = [],
): Promise<TestRuntimeResult> => NativeRuntime.testRuntime({ executablePath, args })

export const nativeGetLastKnownLocation = async (): Promise<LastKnownLocationResult> =>
  NativeRuntime.getLastKnownLocation()
