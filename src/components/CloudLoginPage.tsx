import { useState, type FormEvent } from 'react'
import { cloudLogin, type CloudAuthResult } from '../services/cloud-auth.js'

interface CloudLoginPageProps {
  serverUrl: string
  onLoginSuccess: (result: CloudAuthResult) => void
  onCancel: () => void
}

export function CloudLoginPage({ serverUrl, onLoginSuccess, onCancel }: CloudLoginPageProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!username || !password) {
      setError('请输入用户名和密码')
      return
    }
    setError('')
    setLoading(true)
    try {
      const result = await cloudLogin(serverUrl, username, password)
      onLoginSuccess(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="cloud-login-page">
      <div className="cloud-login-card">
        <h2 className="cloud-login-title">云服务登录</h2>
        <p className="cloud-login-desc">登录 ActiNet 云服务以使用代理 API</p>
        <form onSubmit={handleSubmit}>
          {error && <div className="cloud-login-error">{error}</div>}
          <div className="settings-form-group">
            <label className="settings-label">用户名或邮箱</label>
            <input
              type="text"
              className="settings-chat-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="username 或 email@example.com"
              autoFocus
            />
          </div>
          <div className="settings-form-group">
            <label className="settings-label">密码</label>
            <input
              type="password"
              className="settings-chat-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="输入密码"
            />
          </div>
          <div className="cloud-login-actions">
            <button type="submit" className="cloud-login-btn cloud-login-btn-primary" disabled={loading}>
              {loading ? '登录中...' : '登录'}
            </button>
            <button type="button" className="cloud-login-btn" onClick={onCancel}>
              取消
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
