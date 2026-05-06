import type { RefObject } from 'react'
import type { RuntimeRecord } from '../../services/skills/types'

interface RuntimeSettingsProps {
  runtimeArchiveInputRef: RefObject<HTMLInputElement | null>
  isInstallingRuntimeArchive: boolean
  isLoadingExtensions: boolean
  runtimeRecords: RuntimeRecord[]
  onRefresh: () => void
  onSetEnabled: (id: string, enabled: boolean) => void
  onTest: (id: string) => void
  onSetDefault: (runtime: RuntimeRecord) => void
  onDelete: (id: string) => void
}

export default function RuntimeSettings({
  runtimeArchiveInputRef,
  isInstallingRuntimeArchive,
  isLoadingExtensions,
  runtimeRecords,
  onRefresh,
  onSetEnabled,
  onTest,
  onSetDefault,
  onDelete,
}: RuntimeSettingsProps) {
  return (
    <>
      <section className="settings-section">
        <div className="conversation-group-divider settings-section-divider">
          <span className="conversation-group-label">运行时包管理</span>
          <span className="conversation-group-dash" aria-hidden="true" />
        </div>

        <div className="model-tools">
          <button
            type="button"
            onClick={() => runtimeArchiveInputRef.current?.click()}
            disabled={isInstallingRuntimeArchive}
          >
            {isInstallingRuntimeArchive ? '安装中...' : '安装 Python / Node ZIP'}
          </button>
          <button type="button" onClick={() => void onRefresh()}>
            刷新
          </button>
        </div>

      </section>

      <section className="settings-section">
        <div className="conversation-group-divider settings-section-divider">
          <span className="conversation-group-label">已安装运行时</span>
          <span className="conversation-group-dash" aria-hidden="true" />
        </div>

        <div className="settings-entity-list">
          {isLoadingExtensions ? (
            <p className="summary-muted">正在加载运行时...</p>
          ) : runtimeRecords.length === 0 ? (
            <p className="summary-muted">尚未安装运行时。</p>
          ) : (
            runtimeRecords.map((runtime) => (
              <article key={runtime.id} className="settings-entity-card">
                <div className="settings-entity-main">
                  <div className="settings-entity-title-row">
                    <strong>{runtime.displayName || runtime.id}</strong>
                    <div className="summary-bar">
                      <span>{runtime.id}</span>
                      <span>{runtime.type}</span>
                      <span>{runtime.version || '未知版本'}</span>
                      {runtime.isDefault ? <span>默认</span> : null}
                    </div>
                  </div>

                  <p className="summary-muted">
                    {runtime.executablePath
                      ? `执行入口：${runtime.executablePath}`
                      : '未识别到可执行入口'}
                  </p>

                  {runtime.testMessage ? (
                    <p className="summary-muted">检测结果：{runtime.testMessage}</p>
                  ) : null}
                </div>

                <div className="settings-entity-actions">
                  <label className="toggle-row settings-inline-toggle">
                    <span>启用</span>
                    <input
                      className="toggle-switch"
                      type="checkbox"
                      checked={runtime.enabled}
                      onChange={(event) =>
                        void onSetEnabled(runtime.id, event.target.checked)
                      }
                    />
                  </label>

                  <div className="settings-inline-buttons">
                    <button
                      type="button"
                      className="tiny-button"
                      onClick={() => void onTest(runtime.id)}
                    >
                      检测
                    </button>
                    {runtime.type === 'python' || runtime.type === 'node' ? (
                      <button
                        type="button"
                        className="tiny-button"
                        onClick={() => void onSetDefault(runtime)}
                      >
                        设为默认
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="tiny-button danger-button"
                      onClick={() => onDelete(runtime.id)}
                    >
                      删除
                    </button>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </>
  )
}
