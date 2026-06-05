import type { AppSettings } from '../../state/types'
import type { StoredCloudAuth } from '../../services/cloud-auth'

interface AccountsSettingsProps {
  settings: AppSettings
  isCloudLoggedIn: boolean
  cloudAuth: StoredCloudAuth | null
  onNavigateActiNet: () => void
  onNavigateProviders: () => void
  otherProvidersEnabled: boolean
  onToggleOtherProviders: (enabled: boolean) => void
}

export default function AccountsSettings({
  settings,
  isCloudLoggedIn,
  cloudAuth,
  onNavigateActiNet,
  onNavigateProviders,
  otherProvidersEnabled,
  onToggleOtherProviders,
}: AccountsSettingsProps) {
  const enabledModelCount = settings.providers.flatMap(
    (provider) => provider.models.filter((model) => model.enabled),
  ).length

  return (
    <>
      <section className="settings-section">
        <div className="conversation-group-divider settings-section-divider">
          <span className="conversation-group-label">账号入口</span>
          <span className="conversation-group-dash" aria-hidden="true" />
        </div>

        <div className="settings-entry-list settings-entry-list-tight">
          {/* ── ActiNet 入口 ── */}
          <button
            type="button"
            className="settings-entry-button settings-summary-button"
            onClick={onNavigateActiNet}
          >
            <div className="settings-summary-list">
              <div className="settings-summary-row">
                <span className="settings-summary-row-label">ActiNet 云服务</span>
                <span className="settings-summary-row-value">
                  {isCloudLoggedIn && cloudAuth
                    ? `${cloudAuth.username}${cloudAuth.email ? ` · ${cloudAuth.email}` : ''}`
                    : '未登录'}
                </span>
              </div>
            </div>
            <span className="settings-entry-meta">
              {isCloudLoggedIn
                ? '已连接 ActiNet 云服务'
                : '登录 ActiNet 获取云端 API 代理'}
            </span>
          </button>

          {/* ── 其它服务商开关 ── */}
          <label className="toggle-row">
            <span>启用其它服务商</span>
            <input
              className="toggle-switch"
              type="checkbox"
              checked={otherProvidersEnabled}
              onChange={(event) => onToggleOtherProviders(event.target.checked)}
            />
          </label>

          {/* ── 其它服务商入口 ── */}
          {otherProvidersEnabled && (
            <button
              type="button"
              className="settings-entry-button settings-summary-button"
              onClick={onNavigateProviders}
            >
              <div className="settings-summary-list">
                <div className="settings-summary-row">
                  <span className="settings-summary-row-label">其他服务商</span>
                  <span className="settings-summary-row-value">
                    {settings.providers.length === 0
                      ? '暂无服务商'
                      : `已配置 ${settings.providers.length} 个`}
                  </span>
                </div>
              </div>
              <span className="settings-entry-meta">
                {settings.providers.length === 0
                  ? '添加 OpenAI、Anthropic 等服务商'
                  : `已启用 ${enabledModelCount} 个模型`}
              </span>
            </button>
          )}
        </div>
      </section>
    </>
  )
}
