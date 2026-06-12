import { useState, useCallback, useEffect } from 'react'
import type { StoredCloudAuth } from '../../services/cloud-auth'
import type { ProviderModel } from '../../state/types'
import {
  fetchCloudUserInfo,
  changeCloudEmail,
  confirmCloudEmailChange,
  saveCloudAuth,
  type CloudUserInfo,
} from '../../services/cloud-auth'
import {
  getEffectiveActiNetModels,
  saveActiNetModelPreferences,
  fetchActiNetModelsFromServer,
  mergeActiNetModels,
} from '../../services/actinet-models'

interface ActiNetSettingsProps {
  isCloudLoggedIn: boolean
  cloudAuth: StoredCloudAuth | null
  onCloudLogin: () => void
  onCloudLogout: () => void
  actiNetModels: ProviderModel[]
  onUpdateActiNetModels: (models: ProviderModel[]) => void
  actiNetAdvancedModelsEnabled: boolean
  onToggleAdvancedModels: (enabled: boolean) => void
}

export default function ActiNetSettings({
  isCloudLoggedIn,
  cloudAuth,
  onCloudLogin,
  onCloudLogout,
  actiNetModels,
  onUpdateActiNetModels,
  actiNetAdvancedModelsEnabled,
  onToggleAdvancedModels,
}: ActiNetSettingsProps) {
  const [apiKeyVisible, setApiKeyVisible] = useState(false)
  const [copied, setCopied] = useState(false)
  const [isFetchingModels, setIsFetchingModels] = useState(false)
  const [modelSearch, setModelSearch] = useState('')
  const [manualModelDraft, setManualModelDraft] = useState('')

  // ── Email status & change ──
  const [userInfo, setUserInfo] = useState<CloudUserInfo | null>(null)
  const [emailChangeOpen, setEmailChangeOpen] = useState(false)
  const [emailChangeStep, setEmailChangeStep] = useState<'input' | 'token'>('input')
  const [newEmail, setNewEmail] = useState('')
  const [emailChangePassword, setEmailChangePassword] = useState('')
  const [emailChangeToken, setEmailChangeToken] = useState('')
  const [emailChangeLoading, setEmailChangeLoading] = useState(false)
  const [emailChangeError, setEmailChangeError] = useState('')
  const [emailChangeMessage, setEmailChangeMessage] = useState('')

  useEffect(() => {
    if (isCloudLoggedIn && cloudAuth) {
      fetchCloudUserInfo().then((info) => {
        if (info) setUserInfo(info)
      })
    }
  }, [isCloudLoggedIn, cloudAuth])

  const effectiveModels = getEffectiveActiNetModels()

  const handleCopyApiKey = async () => {
    if (!cloudAuth?.apiKey) return
    try {
      await navigator.clipboard.writeText(cloudAuth.apiKey)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback: silently ignore clipboard errors
    }
  }

  const handleFetchModels = useCallback(async () => {
    if (!cloudAuth || !cloudAuth.apiKey) return
    setIsFetchingModels(true)
    try {
      const remoteModels = await fetchActiNetModelsFromServer(cloudAuth.serverUrl, cloudAuth.apiKey)
      const merged = mergeActiNetModels(remoteModels, actiNetModels)
      onUpdateActiNetModels(merged)
      saveActiNetModelPreferences(merged)
    } catch (err) {
      const message = err instanceof Error ? err.message : '请求失败'
      window.dispatchEvent(new CustomEvent('actinet-notice', { detail: { type: 'error', text: `模型列表获取失败：${message}` } }))
    } finally {
      setIsFetchingModels(false)
    }
  }, [cloudAuth, actiNetModels, onUpdateActiNetModels])

  const toggleModel = (modelId: string, enabled: boolean) => {
    const updated = effectiveModels.map((m) =>
      m.id === modelId ? { ...m, enabled } : m,
    )
    onUpdateActiNetModels(updated)
    saveActiNetModelPreferences(updated)
  }

  const addManualModel = () => {
    const trimmed = manualModelDraft.trim()
    if (!trimmed) return
    if (effectiveModels.some((m) => m.id === trimmed)) {
      window.dispatchEvent(new CustomEvent('actinet-notice', { detail: { type: 'info', text: '该模型已存在。' } }))
      return
    }
    const updated = [...effectiveModels, { id: trimmed, enabled: false }]
    onUpdateActiNetModels(updated)
    saveActiNetModelPreferences(updated)
    setManualModelDraft('')
  }

  const filteredModels = modelSearch.trim()
    ? effectiveModels.filter((m) => m.id.toLowerCase().includes(modelSearch.toLowerCase()))
    : effectiveModels

  // ── Email change handlers ──

  async function handleRequestEmailChange() {
    if (!newEmail.trim() || !emailChangePassword) {
      setEmailChangeError('请输入新邮箱和密码')
      return
    }
    if (!newEmail.includes('@')) {
      setEmailChangeError('请输入有效的邮箱地址')
      return
    }
    if (!cloudAuth?.apiKey) return

    setEmailChangeLoading(true)
    setEmailChangeError('')
    setEmailChangeMessage('')
    try {
      const result = await changeCloudEmail(cloudAuth.serverUrl, cloudAuth.apiKey, newEmail.trim(), emailChangePassword)
      setEmailChangeMessage(result.message)
      setEmailChangeStep('token')
    } catch (err) {
      setEmailChangeError(err instanceof Error ? err.message : '请求失败')
    } finally {
      setEmailChangeLoading(false)
    }
  }

  async function handleConfirmEmailChange() {
    if (!emailChangeToken.trim()) {
      setEmailChangeError('请输入验证码')
      return
    }

    setEmailChangeLoading(true)
    setEmailChangeError('')
    setEmailChangeMessage('')
    try {
      const result = await confirmCloudEmailChange(cloudAuth!.serverUrl, emailChangeToken.trim())
      setEmailChangeMessage(result.message)
      // Update stored auth with new email
      if (cloudAuth) {
        saveCloudAuth({ ...cloudAuth, email: result.email, savedAt: Date.now() })
      }
      // Refresh user info
      const info = await fetchCloudUserInfo()
      if (info) setUserInfo(info)
      // Close dialog after a short delay
      setTimeout(() => {
        setEmailChangeOpen(false)
        resetEmailChange()
      }, 1500)
    } catch (err) {
      setEmailChangeError(err instanceof Error ? err.message : '请求失败')
    } finally {
      setEmailChangeLoading(false)
    }
  }

  function resetEmailChange() {
    setEmailChangeStep('input')
    setNewEmail('')
    setEmailChangePassword('')
    setEmailChangeToken('')
    setEmailChangeError('')
    setEmailChangeMessage('')
  }

  const emailVerified = userInfo?.email_verified ?? true

  // ── Not logged in ──
  if (!isCloudLoggedIn || !cloudAuth) {
    return (
      <>
        <section className="settings-section">
          <div className="conversation-group-divider settings-section-divider">
            <span className="conversation-group-label">ActiNet 状态</span>
            <span className="conversation-group-dash" aria-hidden="true" />
          </div>

          <div className="settings-entity-list">
            <p className="summary-muted">尚未登录 ActiNet 云服务。</p>
          </div>
        </section>

        <section className="settings-section">
          <div className="model-tools">
            <button type="button" className="cloud-provider-login-btn" onClick={onCloudLogin}>
              ActiNet 登录
            </button>
          </div>
        </section>
      </>
    )
  }

  return (
    <>
      <section className="settings-section">
        <div className="conversation-group-divider settings-section-divider">
          <span className="conversation-group-label">账户信息</span>
          <span className="conversation-group-dash" aria-hidden="true" />
        </div>

        <div className="settings-entry-list">
          <div className="settings-static-card">
            <div className="settings-entry-title">{cloudAuth.username || 'ActiNet 用户'}</div>
            <div className="summary-bar">
              {cloudAuth.email ? (
                <>
                  <span>{cloudAuth.email}</span>
                  <span className={emailVerified ? 'email-verified' : 'email-unverified'}>
                    {emailVerified ? '✓ 已验证' : '⚠ 未验证'}
                  </span>
                </>
              ) : null}
              <span>已连接</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Email change dialog ── */}
      {emailChangeOpen && (
        <section className="settings-section">
          <div className="conversation-group-divider settings-section-divider">
            <span className="conversation-group-label">更换邮箱</span>
            <span className="conversation-group-dash" aria-hidden="true" />
          </div>

          <div className="settings-entry-list">
            <div className="settings-static-card">
              {emailChangeError && (
                <p className="summary-muted" style={{ color: 'var(--cover-auth-error, #e74c3c)', marginBottom: 12 }}>{emailChangeError}</p>
              )}
              {emailChangeMessage && (
                <p className="summary-muted" style={{ color: 'var(--cover-auth-notice, #27ae60)', marginBottom: 12 }}>{emailChangeMessage}</p>
              )}

              {emailChangeStep === 'input' ? (
                <>
                  <div className="settings-summary-list">
                    <div className="settings-summary-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
                      <label className="settings-summary-row-label">新邮箱</label>
                      <input
                        type="email"
                        className="settings-chat-input"
                        value={newEmail}
                        onChange={(e) => setNewEmail((e.target as HTMLInputElement).value)}
                        placeholder="new@example.com"
                        style={{ width: '100%' }}
                      />
                    </div>
                    <div className="settings-summary-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
                      <label className="settings-summary-row-label">当前密码（确认身份）</label>
                      <input
                        type="password"
                        className="settings-chat-input"
                        value={emailChangePassword}
                        onChange={(e) => setEmailChangePassword((e.target as HTMLInputElement).value)}
                        placeholder="输入当前密码"
                        style={{ width: '100%' }}
                      />
                    </div>
                  </div>
                  <div className="model-tools" style={{ marginTop: 12 }}>
                    <button type="button" onClick={handleRequestEmailChange} disabled={emailChangeLoading}>
                      {emailChangeLoading ? '发送中...' : '发送验证码'}
                    </button>
                    <button type="button" onClick={() => { setEmailChangeOpen(false); resetEmailChange() }} style={{ marginLeft: 8 }}>
                      取消
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="settings-summary-list">
                    <div className="settings-summary-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
                      <label className="settings-summary-row-label">验证码</label>
                      <input
                        type="text"
                        className="settings-chat-input"
                        value={emailChangeToken}
                        onChange={(e) => setEmailChangeToken((e.target as HTMLInputElement).value)}
                        placeholder="输入邮件中的验证码"
                        style={{ width: '100%' }}
                      />
                    </div>
                  </div>
                  <div className="model-tools" style={{ marginTop: 12 }}>
                    <button type="button" onClick={handleConfirmEmailChange} disabled={emailChangeLoading}>
                      {emailChangeLoading ? '确认中...' : '确认更换'}
                    </button>
                    <button type="button" onClick={() => { setEmailChangeOpen(false); resetEmailChange() }} style={{ marginLeft: 8 }}>
                      取消
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </section>
      )}

      <section className="settings-section">
        <div className="conversation-group-divider settings-section-divider">
          <span className="conversation-group-label">连接信息</span>
          <span className="conversation-group-dash" aria-hidden="true" />
        </div>

        <div className="settings-entry-list">
          <div className="settings-static-card">
            <div className="settings-summary-list">
              <div className="settings-summary-row">
                <span className="settings-summary-row-label">服务器地址</span>
                <span className="settings-summary-row-value">{cloudAuth.serverUrl}</span>
              </div>
            </div>
            <div className="model-tools" style={{ marginTop: 10 }}>
              <button type="button" onClick={() => { setEmailChangeOpen(true); resetEmailChange() }}>
                更换邮箱
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="settings-section">
        <div className="conversation-group-divider settings-section-divider">
          <span className="conversation-group-label">API Key</span>
          <span className="conversation-group-dash" aria-hidden="true" />
        </div>

        <div className="settings-entry-list">
          <div className="settings-static-card">
            <div className="settings-summary-list">
              <div className="settings-summary-row">
                <span className="settings-summary-row-label">Key</span>
                <span className="settings-summary-row-value" style={{ fontFamily: 'monospace', fontSize: '0.8em' }}>
                  {apiKeyVisible ? cloudAuth.apiKey : '••••••••••••••••••••••'}
                </span>
              </div>
            </div>
            <div className="model-tools" style={{ marginTop: 10 }}>
              <button type="button" onClick={() => setApiKeyVisible((v) => !v)}>
                {apiKeyVisible ? '隐藏' : '显示'}
              </button>
              <button type="button" onClick={handleCopyApiKey} style={{ marginLeft: 8 }}>
                {copied ? '已复制' : '复制'}
              </button>
            </div>
          </div>
        </div>
      </section>


      {/* ── 高级模型开关 ── */}
      <section className="settings-section">
        <label className="toggle-row">
          <span>高级模型</span>
          <input
            className="toggle-switch"
            type="checkbox"
            checked={actiNetAdvancedModelsEnabled}
            onChange={(event) => onToggleAdvancedModels(event.target.checked)}
          />
        </label>
        <span className="settings-entry-meta">
          开启后可添加和管理更多 ActiNet 模型
        </span>
      </section>

      {/* ── Model management ── */}
      {actiNetAdvancedModelsEnabled && (
      <section className="settings-section">
        <div className="conversation-group-divider settings-section-divider">
          <span className="conversation-group-label">ActiNet 模型</span>
          <span className="conversation-group-dash" aria-hidden="true" />
        </div>

        <div className="settings-entry-list">
          <div className="settings-static-card">
            <div className="summary-bar">
              <span>{effectiveModels.length} 个模型</span>
              <span>{effectiveModels.filter((m) => m.enabled).length} 个启用</span>
            </div>
          </div>
        </div>

        <div className="model-tools">
          <button type="button" onClick={handleFetchModels} disabled={isFetchingModels}>
            {isFetchingModels ? '加载中...' : '拉取模型列表'}
          </button>
        </div>

        <div className="model-add-row">
          <input
            type="text"
            className="settings-chat-input"
            value={manualModelDraft}
            onChange={(e) => setManualModelDraft((e.target as HTMLInputElement).value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addManualModel()
              }
            }}
            placeholder="手动添加模型，例如 gpt-4o-mini"
          />
          <button type="button" onClick={addManualModel}>
            添加
          </button>
        </div>

        <label className="field field-compact">
          <span>搜索模型</span>
          <input
            type="text"
            className="settings-chat-input settings-chat-input-compact"
            value={modelSearch}
            onChange={(e) => setModelSearch((e.target as HTMLInputElement).value)}
            placeholder="输入模型名筛选"
          />
        </label>

        <div className="model-list">
          {effectiveModels.length === 0 ? (
            <p className="summary-muted">暂无模型，请先拉取或手动添加。</p>
          ) : filteredModels.length === 0 ? (
            <p className="summary-muted">没有匹配的模型。</p>
          ) : (
            filteredModels.map((model) => (
              <div
                key={model.id}
                className={`model-row ${model.enabled ? '' : 'is-disabled'}`}
              >
                <span className="model-row-label">{model.id}</span>
                <div className="model-row-actions">
                  <button
                    type="button"
                    className={`model-toggle-button ${model.enabled ? 'is-enabled' : ''}`}
                    onClick={() => toggleModel(model.id, !model.enabled)}
                  >
                    {model.enabled ? '已启用' : '启用'}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      )}

      <section className="settings-section">
        <div className="model-tools">
          <button type="button" className="danger-button" onClick={onCloudLogout}>
            退出 ActiNet 登录
          </button>
        </div>
      </section>
    </>
  )
}
