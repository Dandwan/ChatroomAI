/**
 * 扩展管理 hook — 提取自 App.tsx（D4 阶段）
 *
 * 管理 skill/runtime 安装、启用、配置编辑和刷新。
 */
import { useCallback, useEffect } from 'react'
import type { JsonObjectValue } from '../components/SkillConfigJsonEditor'
import { useExtensionsStore } from '../state/extensions-store'
import { useUIStore } from '../state/ui-store'
import {
  deleteSkill,
  initializeSkillHost,
  installSkillPackage,
  listSkills,
  readSkillConfig,
  setSkillEnabled,
  writeSkillConfig,
} from '../services/skills/host'
import {
  deleteRuntime,
  ensureBundledRuntimesInstalled,
  installRuntimePackage,
  listRuntimes,
  setDefaultRuntime,
  setRuntimeEnabled,
  testRuntime,
} from '../services/skills/runtime'
import { formatJsonObject, parseSkillConfigDraft } from '../utils/app-formatting'

export interface UseExtensionsReturn {
  // State (read from store)
  skillRecords: ReturnType<typeof useExtensionsStore.getState>['skillRecords']
  runtimeRecords: ReturnType<typeof useExtensionsStore.getState>['runtimeRecords']
  isLoadingExtensions: boolean
  isInstallingSkillArchive: boolean
  isInstallingRuntimeArchive: boolean
  skillConfigTargetId: string | null
  skillConfigDraft: string
  skillConfigValue: JsonObjectValue
  skillConfigRawError: string | null
  isLoadingSkillConfig: boolean
  isSavingSkillConfig: boolean
  modelHealth: ReturnType<typeof useExtensionsStore.getState>['modelHealth']
  skillConfigTarget: any | null

  // Skill management
  handleSkillArchiveSelect: (event: React.ChangeEvent<HTMLInputElement>) => void
  handleSetSkillEnabled: (skillId: string, enabled: boolean) => Promise<void>
  deleteSkillById: (skillId: string) => Promise<void>
  requestDeleteSkill: (skillId: string) => void

  // Runtime management
  handleRuntimeArchiveSelect: (event: React.ChangeEvent<HTMLInputElement>) => void
  handleSetRuntimeEnabled: (runtimeId: string, enabled: boolean) => Promise<void>
  deleteRuntimeById: (runtimeId: string) => Promise<void>
  requestDeleteRuntime: (runtimeId: string) => void
  handleSetDefaultRuntime: (runtimeId: string) => Promise<void>
  handleTestRuntime: (runtimeId: string) => Promise<void>

  // Skill config
  handleSkillConfigDraftChange: (nextDraft: string) => void
  applySkillConfigValue: (nextValue: JsonObjectValue) => void
  formatSkillConfigDraft: () => void
  openSkillConfigEditor: (skillId: string) => Promise<void>
  saveSkillConfig: () => Promise<void>

  // Refresh
  refreshExtensions: (showLoading?: boolean) => Promise<void>

  // Setters
  setModelHealth: ReturnType<typeof useExtensionsStore.getState>['setModelHealth']
}

export function useExtensions(
  pushNotice: (text: string, type?: 'info' | 'success' | 'error') => void,
  openDeleteDialog: (dialog: any) => void,
): UseExtensionsReturn {
  // ── Store selectors ──
  const skillRecords = useExtensionsStore((s) => s.skillRecords)
  const setSkillRecords = useExtensionsStore((s) => s.setSkillRecords)
  const runtimeRecords = useExtensionsStore((s) => s.runtimeRecords)
  const setRuntimeRecords = useExtensionsStore((s) => s.setRuntimeRecords)
  const isLoadingExtensions = useExtensionsStore((s) => s.isLoadingExtensions)
  const setIsLoadingExtensions = useExtensionsStore((s) => s.setIsLoadingExtensions)
  const isInstallingSkillArchive = useExtensionsStore((s) => s.isInstallingSkillArchive)
  const setIsInstallingSkillArchive = useExtensionsStore((s) => s.setIsInstallingSkillArchive)
  const isInstallingRuntimeArchive = useExtensionsStore((s) => s.isInstallingRuntimeArchive)
  const setIsInstallingRuntimeArchive = useExtensionsStore((s) => s.setIsInstallingRuntimeArchive)
  const skillConfigTargetId = useExtensionsStore((s) => s.skillConfigTargetId)
  const setSkillConfigTargetId = useExtensionsStore((s) => s.setSkillConfigTargetId)
  const skillConfigDraft = useExtensionsStore((s) => s.skillConfigDraft)
  const setSkillConfigDraft = useExtensionsStore((s) => s.setSkillConfigDraft)
  const skillConfigValue = useExtensionsStore((s) => s.skillConfigValue)
  const setSkillConfigValue = useExtensionsStore((s) => s.setSkillConfigValue)
  const skillConfigRawError = useExtensionsStore((s) => s.skillConfigRawError)
  const setSkillConfigRawError = useExtensionsStore((s) => s.setSkillConfigRawError)
  const isLoadingSkillConfig = useExtensionsStore((s) => s.isLoadingSkillConfig)
  const setIsLoadingSkillConfig = useExtensionsStore((s) => s.setIsLoadingSkillConfig)
  const isSavingSkillConfig = useExtensionsStore((s) => s.isSavingSkillConfig)
  const setIsSavingSkillConfig = useExtensionsStore((s) => s.setIsSavingSkillConfig)
  const modelHealth = useExtensionsStore((s) => s.modelHealth)
  const setModelHealth = useExtensionsStore((s) => s.setModelHealth)

  // ── Computed ──
  const skillConfigTarget =
    skillConfigTargetId
      ? skillRecords.find((skill) => skill.id === skillConfigTargetId) ?? null
      : null

  // ── Skill config helpers ──
  const handleSkillConfigDraftChange = useCallback((nextDraft: string): void => {
    setSkillConfigDraft(nextDraft)
    const parsed = parseSkillConfigDraft(nextDraft)
    if (parsed.error || !parsed.value) {
      setSkillConfigRawError(parsed.error ?? '配置必须是合法的 JSON。')
      return
    }
    setSkillConfigValue(parsed.value)
    setSkillConfigRawError(null)
  }, [])

  const applySkillConfigValue = useCallback((nextValue: JsonObjectValue): void => {
    setSkillConfigValue(nextValue)
    setSkillConfigDraft(formatJsonObject(nextValue))
    setSkillConfigRawError(null)
  }, [])

  const formatSkillConfigDraft = useCallback((): void => {
    const parsed = parseSkillConfigDraft(skillConfigDraft)
    if (parsed.error || !parsed.value) {
      pushNotice(parsed.error ?? '当前配置不是合法 JSON，无法格式化。', 'error')
      return
    }
    applySkillConfigValue(parsed.value)
  }, [applySkillConfigValue, pushNotice, skillConfigDraft])

  // ── Refresh ──
  const refreshExtensions = useCallback(
    async (showLoading = false): Promise<void> => {
      if (showLoading) setIsLoadingExtensions(true)
      try {
        const [hostResult, bundleResult] = await Promise.allSettled([
          initializeSkillHost(),
          ensureBundledRuntimesInstalled(),
        ])
        const [skillsResult, runtimesResult] = await Promise.allSettled([
          listSkills(),
          listRuntimes(),
        ])
        const errors: string[] = []
        if (hostResult.status === 'rejected') errors.push(`Skill host: ${hostResult.reason}`)
        else setSkillRecords(skillsResult.status === 'fulfilled' ? skillsResult.value : skillRecords)
        if (bundleResult.status === 'rejected') errors.push(`Bundled runtimes: ${bundleResult.reason}`)
        setRuntimeRecords(runtimesResult.status === 'fulfilled' ? runtimesResult.value : runtimeRecords)
        if (errors.length > 0) {
          pushNotice(`部分扩展加载失败：${errors.join('；')}`, 'error')
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : '未知错误'
        pushNotice(`扩展加载失败：${message}`, 'error')
      } finally {
        setIsLoadingExtensions(false)
      }
    },
    [pushNotice, skillRecords, runtimeRecords],
  )

  // ── Skill archive ──
  const handleSkillArchiveSelect = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>): void => {
      const file = event.target.files?.[0]
      if (!file) return
      setIsInstallingSkillArchive(true)
      installSkillPackage(file)
        .then(() => {
          pushNotice(`已安装 skill：${file.name}`, 'success')
          return refreshExtensions()
        })
        .catch((error) => {
          const message = error instanceof Error ? error.message : '未知错误'
          pushNotice(`Skill 安装失败：${message}`, 'error')
        })
        .finally(() => setIsInstallingSkillArchive(false))
    },
    [pushNotice, refreshExtensions],
  )

  // ── Runtime archive ──
  const handleRuntimeArchiveSelect = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>): void => {
      const file = event.target.files?.[0]
      if (!file) return
      setIsInstallingRuntimeArchive(true)
      installRuntimePackage(file)
        .then(() => {
          pushNotice(`已安装运行时：${file.name}`, 'success')
          return refreshExtensions()
        })
        .catch((error) => {
          const message = error instanceof Error ? error.message : '未知错误'
          pushNotice(`运行时安装失败：${message}`, 'error')
        })
        .finally(() => setIsInstallingRuntimeArchive(false))
    },
    [pushNotice, refreshExtensions],
  )

  // ── Skill enable/disable ──
  const handleSetSkillEnabled = useCallback(
    async (skillId: string, enabled: boolean): Promise<void> => {
      try {
        await setSkillEnabled(skillId, enabled)
        setSkillRecords((prev) =>
          prev.map((s) => (s.id === skillId ? { ...s, enabled } : s)),
        )
      } catch (error) {
        const message = error instanceof Error ? error.message : '未知错误'
        pushNotice(`更新 skill 状态失败：${message}`, 'error')
      }
    },
    [pushNotice],
  )

  // ── Skill delete ──
  const deleteSkillById = useCallback(
    async (skillId: string): Promise<void> => {
      try {
        await deleteSkill(skillId)
        if (skillConfigTargetId === skillId) {
          setSkillConfigTargetId(null)
          setSkillConfigDraft('')
          setSkillConfigValue({})
          setSkillConfigRawError(null)
        }
        pushNotice(`已删除 skill：${skillId}`, 'success')
        await refreshExtensions()
      } catch (error) {
        const message = error instanceof Error ? error.message : '未知错误'
        pushNotice(`删除 skill 失败：${message}`, 'error')
      }
    },
    [pushNotice, refreshExtensions, skillConfigTargetId],
  )

  const requestDeleteSkill = useCallback(
    (skillId: string): void => {
      openDeleteDialog({ type: 'skill', targetId: skillId })
    },
    [openDeleteDialog],
  )

  // ── Runtime enable/disable ──
  const handleSetRuntimeEnabled = useCallback(
    async (runtimeId: string, enabled: boolean): Promise<void> => {
      try {
        await setRuntimeEnabled(runtimeId, enabled)
        setRuntimeRecords((prev) =>
          prev.map((r) => (r.id === runtimeId ? { ...r, enabled } : r)),
        )
      } catch (error) {
        const message = error instanceof Error ? error.message : '未知错误'
        pushNotice(`更新运行时状态失败：${message}`, 'error')
      }
    },
    [pushNotice],
  )

  // ── Runtime delete ──
  const deleteRuntimeById = useCallback(
    async (runtimeId: string): Promise<void> => {
      try {
        await deleteRuntime(runtimeId)
        pushNotice(`已删除运行时：${runtimeId}`, 'success')
        await refreshExtensions()
      } catch (error) {
        const message = error instanceof Error ? error.message : '未知错误'
        pushNotice(`删除运行时失败：${message}`, 'error')
      }
    },
    [pushNotice, refreshExtensions],
  )

  const requestDeleteRuntime = useCallback(
    (runtimeId: string): void => {
      openDeleteDialog({ type: 'runtime', targetId: runtimeId })
    },
    [openDeleteDialog],
  )

  // ── Default runtime ──
  const handleSetDefaultRuntime = useCallback(
    async (runtimeId: string): Promise<void> => {
      const runtime = runtimeRecords.find((r) => r.id === runtimeId)
      if (!runtime || (runtime.type !== 'python' && runtime.type !== 'node')) return
      try {
        await setDefaultRuntime(runtime.type, runtime.id)
        await refreshExtensions()
        pushNotice(`已将 ${runtime.id} 设为默认 ${runtime.type} 运行时。`, 'success')
      } catch (error) {
        const message = error instanceof Error ? error.message : '未知错误'
        pushNotice(`设置默认运行时失败：${message}`, 'error')
      }
    },
    [pushNotice, refreshExtensions, runtimeRecords],
  )

  // ── Test runtime ──
  const handleTestRuntime = useCallback(async (runtimeId: string): Promise<void> => {
    setRuntimeRecords((previous: any[]) =>
      previous.map((runtime: any) =>
        runtime.id === runtimeId ? { ...runtime, testStatus: undefined, testMessage: '检测中...' } : runtime,
      ),
    )
    try {
      const nextRuntime: any = await testRuntime(runtimeId)
      setRuntimeRecords((previous: any[]) =>
        previous.map((runtime: any) => (runtime.id === runtimeId ? nextRuntime : runtime)),
      )
      pushNotice(
        nextRuntime.testStatus === 'ok'
          ? `运行时 ${runtimeId} 检测成功。`
          : `运行时 ${runtimeId} 检测失败：${nextRuntime.testMessage ?? '未知错误'}`,
        nextRuntime.testStatus === 'ok' ? 'success' : 'error',
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : '运行时检测失败'
      setRuntimeRecords((previous: any[]) =>
        previous.map((runtime: any) =>
          runtime.id === runtimeId ? { ...runtime, testStatus: 'error', testMessage: message } : runtime,
        ),
      )
      pushNotice(`运行时检测失败：${message}`, 'error')
    }
  }, [pushNotice])

  // ── Skill config editor ──
  const openSkillConfigEditor = useCallback(
    async (skillId: string): Promise<void> => {
      setIsLoadingSkillConfig(true)
      try {
        const config = await readSkillConfig(skillId)
        const jsonValue = typeof config === 'object' && config !== null ? config as JsonObjectValue : {}
        setSkillConfigTargetId(skillId)
        setSkillConfigValue(jsonValue)
        setSkillConfigDraft(formatJsonObject(jsonValue))
        setSkillConfigRawError(null)
        useUIStore.getState().navigateSettingsView('skill-config')
      } catch (error) {
        const message = error instanceof Error ? error.message : '未知错误'
        pushNotice(`读取配置失败：${message}`, 'error')
        useUIStore.getState().navigateSettingsView('skills')
      } finally {
        setIsLoadingSkillConfig(false)
      }
    },
    [pushNotice],
  )

  const saveSkillConfig = useCallback(async (): Promise<void> => {
    if (!skillConfigTargetId) return
    const parsed = parseSkillConfigDraft(skillConfigDraft)
    if (parsed.error || !parsed.value) {
      pushNotice(parsed.error ?? '配置必须是合法的 JSON。', 'error')
      return
    }
    setIsSavingSkillConfig(true)
    try {
      await writeSkillConfig(skillConfigTargetId, parsed.value)
      await refreshExtensions(true)
      pushNotice(`已保存 ${skillConfigTargetId} 的配置。`, 'success')
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知错误'
      pushNotice(`保存配置失败：${message}`, 'error')
    } finally {
      setIsSavingSkillConfig(false)
    }
  }, [pushNotice, refreshExtensions, skillConfigDraft, skillConfigTargetId])

  // ── Initial load effect ──
  useEffect(() => {
    void refreshExtensions()
  }, [pushNotice, refreshExtensions])

  return {
    skillRecords,
    runtimeRecords,
    isLoadingExtensions,
    isInstallingSkillArchive,
    isInstallingRuntimeArchive,
    skillConfigTargetId,
    skillConfigDraft,
    skillConfigValue,
    skillConfigRawError,
    isLoadingSkillConfig,
    isSavingSkillConfig,
    modelHealth,
    skillConfigTarget,
    handleSkillArchiveSelect,
    handleSetSkillEnabled,
    deleteSkillById,
    requestDeleteSkill,
    handleRuntimeArchiveSelect,
    handleSetRuntimeEnabled,
    deleteRuntimeById,
    requestDeleteRuntime,
    handleSetDefaultRuntime,
    handleTestRuntime,
    handleSkillConfigDraftChange,
    applySkillConfigValue,
    formatSkillConfigDraft,
    openSkillConfigEditor,
    saveSkillConfig,
    refreshExtensions,
    setModelHealth,
  }
}
