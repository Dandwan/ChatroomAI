import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core'
import type { RuntimeType, SkillExecutionRequest, SkillExecutionResult } from './types'

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
  displayName: string
}

interface ExecuteProcessOptions extends SkillExecutionRequest {
  relativeSkillRoot: string
  relativeWorkingDirectory?: string
  pythonExecutablePath?: string
  nodeExecutablePath?: string
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

export const nativeTestRuntime = async (
  executablePath: string,
  args: string[] = [],
): Promise<TestRuntimeResult> => NativeRuntime.testRuntime({ executablePath, args })

export const nativeGetLastKnownLocation = async (): Promise<LastKnownLocationResult> =>
  NativeRuntime.getLastKnownLocation()
