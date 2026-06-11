import {
  startTransition,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  type UIEvent,
} from 'react'
import { useUIStore } from '../state/ui-store'
import { useSettingsStore } from '../state/settings-store'
import { useExtensionsStore } from '../state/extensions-store'
import type { SettingsView } from '../state/types'
import { DRAWER_TO_SETTINGS_OPEN_DELAY_MS } from '../state/types'
import { createProviderNumericSettingDrafts } from '../utils/app-module'

export interface UseSettingsNavigationParams {
  settingsPageRef: React.MutableRefObject<HTMLElement | null>
  settingsScrollByViewRef: React.MutableRefObject<Record<SettingsView, number>>
  openSettings: () => void
  closeSettings: () => void
  closeDrawer: () => void
}

export interface UseSettingsNavigationReturn {
  openSettingsHome: () => void
  openSettingsFromDrawer: () => void
  navigateSettingsView: (nextView: SettingsView) => void
  openProviderDetail: (providerId: string) => void
  handleSettingsBack: () => void
  closeSettingsPanel: () => void
  onSettingsScroll: (event: UIEvent<HTMLElement>) => void
}

export function useSettingsNavigation(params: UseSettingsNavigationParams): UseSettingsNavigationReturn {
  const { settingsPageRef, settingsScrollByViewRef, openSettings, closeSettings, closeDrawer } = params

  const settingsView = useUIStore((s) => s.settingsView)
  const settingsVisible = useUIStore((s) => s.settingsVisible)
  const setManualModelDraft = useUIStore((s) => s.setManualModelDraft)
  const setProviderModelSearch = useUIStore((s) => s.setProviderModelSearch)
  const setProviderDetailTargetId = useUIStore((s) => s.setProviderDetailTargetId)
  const setOpenProviderPromptEditors = useUIStore((s) => s.setOpenProviderPromptEditors)

  const openSettingsAfterDrawerTimerRef = useRef<number | null>(null)

  const resetProviderDetailState = useCallback((): void => {
    useUIStore.getState().setProviderModelSearch('')
    useUIStore.getState().setManualModelDraft('')
    useUIStore.getState().setProviderDetailTargetId(null)
    useUIStore.getState().setOpenProviderPromptEditors({
      systemPrompt: false,
      topLevelTagSystemPrompt: false,
      generalTagSystemPrompt: false,
      readSystemPrompt: false,
      skillCallSystemPrompt: false,
      editSystemPrompt: false,
    })
  }, [])

  const rememberSettingsScrollPosition = useCallback((view: SettingsView = settingsView): void => {
    const settingsPage = settingsPageRef.current
    if (!settingsPage) return
    settingsScrollByViewRef.current[view] = settingsPage.scrollTop
  }, [settingsView, settingsPageRef, settingsScrollByViewRef])

  const navigateSettingsView = useCallback((nextView: SettingsView): void => {
    rememberSettingsScrollPosition()
    useUIStore.getState().navigateSettingsView(nextView)
  }, [rememberSettingsScrollPosition])

  const openSettingsHome = useCallback((): void => {
    navigateSettingsView('main')
    resetProviderDetailState()
    useExtensionsStore.getState().setSkillConfigTargetId(null)
    useExtensionsStore.getState().setSkillConfigDraft('')
    useExtensionsStore.getState().setSkillConfigValue({})
    useExtensionsStore.getState().setSkillConfigRawError(null)
    openSettings()
  }, [openSettings, resetProviderDetailState, navigateSettingsView])

  const clearOpenSettingsAfterDrawerTimer = useCallback((): void => {
    if (openSettingsAfterDrawerTimerRef.current !== null) {
      window.clearTimeout(openSettingsAfterDrawerTimerRef.current)
      openSettingsAfterDrawerTimerRef.current = null
    }
  }, [])

  const openSettingsFromDrawer = useCallback((): void => {
    closeDrawer()
    clearOpenSettingsAfterDrawerTimer()
    openSettingsAfterDrawerTimerRef.current = window.setTimeout(() => {
      openSettingsAfterDrawerTimerRef.current = null
      openSettingsHome()
    }, DRAWER_TO_SETTINGS_OPEN_DELAY_MS)
  }, [clearOpenSettingsAfterDrawerTimer, closeDrawer, openSettingsHome])

  // Cleanup timer on unmount
  useEffect(
    () => () => {
      if (openSettingsAfterDrawerTimerRef.current !== null) {
        window.clearTimeout(openSettingsAfterDrawerTimerRef.current)
      }
      openSettingsAfterDrawerTimerRef.current = null
    },
    [],
  )

  const openProviderDetail = useCallback((providerId: string): void => {
    rememberSettingsScrollPosition()
    const targetProvider =
      useSettingsStore.getState().settings.providers.find((p) => p.id === providerId) ?? null
    startTransition(() => {
      setManualModelDraft('')
      setProviderModelSearch('')
      useSettingsStore.getState().setProviderNumericSettingDrafts(
        createProviderNumericSettingDrafts(targetProvider),
      )
      setOpenProviderPromptEditors({
        systemPrompt: false,
        topLevelTagSystemPrompt: false,
        generalTagSystemPrompt: false,
        readSystemPrompt: false,
        skillCallSystemPrompt: false,
        editSystemPrompt: false,
      })
      setProviderDetailTargetId(providerId)
      navigateSettingsView('provider-detail')
    })
  }, [rememberSettingsScrollPosition, setManualModelDraft, setProviderModelSearch, setOpenProviderPromptEditors, setProviderDetailTargetId, navigateSettingsView])

  const closeSettingsPanel = useCallback((): void => {
    rememberSettingsScrollPosition()
    navigateSettingsView('main')
    resetProviderDetailState()
    useExtensionsStore.getState().setSkillConfigTargetId(null)
    useExtensionsStore.getState().setSkillConfigDraft('')
    useExtensionsStore.getState().setSkillConfigValue({})
    useExtensionsStore.getState().setSkillConfigRawError(null)
    closeSettings()
  }, [closeSettings, rememberSettingsScrollPosition, resetProviderDetailState, navigateSettingsView])

  const handleSettingsBack = useCallback((): void => {
    if (settingsView === 'skill-config') {
      rememberSettingsScrollPosition()
      navigateSettingsView('skills')
      useExtensionsStore.getState().setSkillConfigTargetId(null)
      useExtensionsStore.getState().setSkillConfigDraft('')
      useExtensionsStore.getState().setSkillConfigValue({})
      useExtensionsStore.getState().setSkillConfigRawError(null)
      return
    }
    if (settingsView === 'provider-detail') {
      rememberSettingsScrollPosition()
      resetProviderDetailState()
      navigateSettingsView('providers')
      return
    }
    if (settingsView === 'provider-tag-prompts') {
      rememberSettingsScrollPosition()
      navigateSettingsView('provider-detail')
      return
    }
    if (settingsView === 'providers' || settingsView === 'actinet') {
      rememberSettingsScrollPosition()
      navigateSettingsView('accounts')
      return
    }
    if (settingsView !== 'main') {
      rememberSettingsScrollPosition()
      navigateSettingsView('main')
      return
    }
    closeSettingsPanel()
  }, [closeSettingsPanel, rememberSettingsScrollPosition, resetProviderDetailState, settingsView, navigateSettingsView])

  const onSettingsScroll = useCallback(
    (event: UIEvent<HTMLElement>) => {
      settingsScrollByViewRef.current[settingsView] = event.currentTarget.scrollTop
    },
    [settingsView, settingsScrollByViewRef],
  )

  // Scroll position restore on view change
  useLayoutEffect(() => {
    const settingsPage = settingsPageRef.current
    if (!settingsPage) return

    const nextScrollTop = settingsScrollByViewRef.current[settingsView] ?? 0
    const frameId = window.requestAnimationFrame(() => {
      if (settingsPageRef.current === settingsPage) {
        settingsPage.scrollTop = nextScrollTop
      }
    })
    return () => window.cancelAnimationFrame(frameId)
  }, [settingsView, settingsVisible, settingsPageRef, settingsScrollByViewRef])

  return {
    openSettingsHome,
    openSettingsFromDrawer,
    navigateSettingsView,
    openProviderDetail,
    handleSettingsBack,
    closeSettingsPanel,
    onSettingsScroll,
  }
}
