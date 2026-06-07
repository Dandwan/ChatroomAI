import { useState } from 'react'
import type { UpdateInfo } from '../services/app-update'
import { downloadUpdate, dismissUpdate } from '../services/app-update'
import { getCloudServerUrl } from '../services/cloud-auth'
import { versionCodeToName } from '../utils/app-version'

interface UpdateDialogProps {
  update: UpdateInfo
  onCancel: () => void
  onInstall: (blob: Blob, fileName: string) => void
}

export default function UpdateDialog({ update, onCancel, onInstall }: UpdateDialogProps) {
  const [downloading, setDownloading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [progressTotal, setProgressTotal] = useState(0)
  const [error, setError] = useState('')

  const handleDismiss = () => {
    dismissUpdate(update.version_code)
    onCancel()
  }

  const handleUpdate = async () => {
    setDownloading(true)
    setError('')
    try {
      const serverUrl = getCloudServerUrl()
      const { blob, fileName } = await downloadUpdate(update, serverUrl, (loaded, total) => {
        setProgress(loaded)
        setProgressTotal(total)
      })

      setProgress(progressTotal)
      onInstall(blob, fileName)
    } catch (err) {
      setError(err instanceof Error ? err.message : '下载失败，请稍后重试')
      setDownloading(false)
    }
  }

  const formatSize = (bytes: number): string => {
    if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`
    if (bytes >= 1_000) return `${(bytes / 1_000).toFixed(1)} KB`
    return `${bytes} B`
  }

  const progressPercent = progressTotal > 0 ? Math.round((progress / progressTotal) * 100) : 0

  return (
    <div className="delete-dialog-overlay" onClick={downloading ? undefined : handleDismiss}>
      <section
        className="delete-dialog frosted-surface"
        onClick={(event) => event.stopPropagation()}
      >
        {downloading ? (
          <>
            <h3>正在下载更新</h3>
            <p className="delete-dialog-text">
              ActiChat {update.version_name}
            </p>
            <div style={{ margin: '12px 0' }}>
              <div style={{
                height: 6,
                borderRadius: 3,
                background: 'var(--border-color)',
                overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%',
                  width: `${progressPercent}%`,
                  borderRadius: 3,
                  background: 'var(--accent-color, #4f8ff7)',
                  transition: 'width 0.3s ease',
                }} />
              </div>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginTop: 4,
                fontSize: 12,
                color: 'var(--text-secondary)',
              }}>
                <span>{formatSize(progress)} / {formatSize(progressTotal)}</span>
                <span>{progressPercent}%</span>
              </div>
            </div>
            {error && (
              <p className="delete-dialog-hint" style={{ color: 'var(--text-danger, #e5484d)' }}>
                {error}
              </p>
            )}
          </>
        ) : (
          <>
            <h3>更新提醒</h3>
            <p className="delete-dialog-text">
              发现新版本 <strong>ActiChat {update.version_name}</strong>（当前 {versionCodeToName(update.base_version_code ?? 0)}）
            </p>
            {update.release_notes && (
              <p className="delete-dialog-hint">
                {update.release_notes}
              </p>
            )}
            <p className="delete-dialog-hint">
              更新大小：{formatSize(update.file_size_bytes)}
              {update.download_type === 'patch' ? '（增量更新）' : '（全量更新）'}
            </p>
            {error && (
              <p className="delete-dialog-hint" style={{ color: 'var(--text-danger, #e5484d)' }}>
                {error}
              </p>
            )}
            <div className="delete-dialog-actions">
              <button type="button" className="ghost-button" onClick={handleDismiss}>
                暂不更新
              </button>
              <button
                type="button"
                className="danger-button"
                style={{ background: 'var(--accent-color, #4f8ff7)', color: '#fff' }}
                onClick={handleUpdate}
              >
                立即更新
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  )
}
