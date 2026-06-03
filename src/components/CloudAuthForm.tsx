import { useState, type FormEvent } from 'react'
import { cloudLogin, cloudRegister, getCloudServerUrl, type CloudAuthResult } from '../services/cloud-auth.js'

type AuthMode = 'login' | 'register'

interface CloudAuthFormProps {
  initialMode?: AuthMode
  onAuthSuccess: (result: CloudAuthResult) => void
}

export default function CloudAuthForm({ initialMode = 'login', onAuthSuccess }: CloudAuthFormProps) {
  const [mode, setMode] = useState<AuthMode>(initialMode)
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')

    if (!username.trim()) {
      setError(mode === 'login' ? '请输入用户名或邮箱' : '请输入用户名')
      return
    }
    if (mode === 'register' && !email.trim()) {
      setError('请输入邮箱')
      return
    }
    if (!password) {
      setError('请输入密码')
      return
    }

    setLoading(true)
    try {
      let result: CloudAuthResult
      if (mode === 'login') {
        result = await cloudLogin(getCloudServerUrl(), username, password)
      } else {
        result = await cloudRegister(getCloudServerUrl(), username, email, password)
      }
      onAuthSuccess(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : '请求失败')
    } finally {
      setLoading(false)
    }
  }

  function switchMode(nextMode: AuthMode) {
    setError('')
    setMode(nextMode)
  }

  return (
    <section className="cover-empty-state has-cover">
      <div className="cover-empty-state-content">
        <div className="cover-empty-state-kicker">
          <span>01</span>
          <span className="cover-empty-state-rule" />
          <span>ActiNet</span>
        </div>

        <h2 className="cover-empty-state-title">
          <span>连接云服务，</span>
          <span className="is-italic">unlock</span>
          <span>代理 API。</span>
        </h2>

        <p className="cover-empty-state-byline">
          {mode === 'login' ? '登录 ActiChat 云服务器以使用代理 API' : '注册 ActiNet 账号以开始使用云服务'}
        </p>

        <form className="cover-auth-form" onSubmit={handleSubmit}>
          {error ? <div className="cover-auth-error">{error}</div> : null}

          {mode === 'register' ? (
            <>
              <div className="cover-auth-field">
                <label className="cover-auth-label">用户名</label>
                <input
                  type="text"
                  className="cover-auth-input"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="选择用户名"
                  autoFocus
                />
              </div>
              <div className="cover-auth-field">
                <label className="cover-auth-label">邮箱</label>
                <input
                  type="email"
                  className="cover-auth-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@example.com"
                />
              </div>
            </>
          ) : (
            <div className="cover-auth-field">
              <label className="cover-auth-label">用户名或邮箱</label>
              <input
                type="text"
                className="cover-auth-input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="username 或 email@example.com"
                autoFocus
              />
            </div>
          )}

          <div className="cover-auth-field">
            <label className="cover-auth-label">密码</label>
            <input
              type="password"
              className="cover-auth-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="输入密码"
            />
          </div>

          <div className="cover-auth-actions">
            <button
              type="submit"
              className="cover-auth-btn cover-auth-btn-primary"
              disabled={loading}
            >
              {loading ? (mode === 'login' ? '登录中...' : '注册中...') : (mode === 'login' ? '登录' : '注册')}
            </button>
            {mode === 'login' ? (
              <button
                type="button"
                className="cover-auth-btn cover-auth-btn-secondary"
                onClick={() => switchMode('register')}
              >
                注册
              </button>
            ) : (
              <button
                type="button"
                className="cover-auth-btn cover-auth-btn-secondary"
                onClick={() => switchMode('login')}
              >
                返回登录
              </button>
            )}
          </div>
        </form>
      </div>
    </section>
  )
}
