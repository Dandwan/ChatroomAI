import { useState, type FormEvent } from 'react'
import {
  cloudLogin,
  cloudRegister,
  resendCloudVerification,
  requestCloudPasswordReset,
  resetCloudPassword,
  getCloudServerUrl,
  type CloudAuthResult,
  type CloudRegisterResult,
} from '../services/cloud-auth.js'

type AuthMode = 'login' | 'register' | 'forgot' | 'forgotSent' | 'reset'

interface CloudAuthFormProps {
  initialMode?: AuthMode
  onAuthSuccess: (result: CloudAuthResult) => void
}

export default function CloudAuthForm({ initialMode = 'login', onAuthSuccess }: CloudAuthFormProps) {
  const [mode, setMode] = useState<AuthMode>(initialMode)
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [resetToken, setResetToken] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  /** Registration result, shown after successful registration */
  const [registerResult, setRegisterResult] = useState<CloudRegisterResult | null>(null)
  const [resendLoading, setResendLoading] = useState(false)
  const [resendMessage, setResendMessage] = useState('')

  /** Email used for password reset (preserved across forgot → forgotSent → reset) */
  const [resetEmail, setResetEmail] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setMessage('')

    switch (mode) {
      case 'login':
        return handleLogin()
      case 'register':
        return handleRegister()
      case 'forgot':
        return handleForgotPassword()
      case 'reset':
        return handleResetPassword()
    }
  }

  async function handleLogin() {
    if (!username.trim()) {
      setError('请输入用户名或邮箱')
      return
    }
    if (!password) {
      setError('请输入密码')
      return
    }

    setLoading(true)
    try {
      const result = await cloudLogin(getCloudServerUrl(), username, password)
      onAuthSuccess(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : '请求失败')
    } finally {
      setLoading(false)
    }
  }

  async function handleRegister() {
    if (!username.trim()) {
      setError('请输入用户名')
      return
    }
    if (!email.trim()) {
      setError('请输入邮箱')
      return
    }
    if (!password) {
      setError('请输入密码')
      return
    }

    setLoading(true)
    try {
      const result = await cloudRegister(getCloudServerUrl(), username, email, password)
      setRegisterResult(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : '请求失败')
    } finally {
      setLoading(false)
    }
  }

  async function handleForgotPassword() {
    if (!email.trim()) {
      setError('请输入邮箱地址')
      return
    }

    setLoading(true)
    try {
      const result = await requestCloudPasswordReset(getCloudServerUrl(), email.trim())
      setResetEmail(email.trim())
      setMessage(result.message)
      setMode('forgotSent')
    } catch (err) {
      setError(err instanceof Error ? err.message : '请求失败')
    } finally {
      setLoading(false)
    }
  }

  async function handleResetPassword() {
    if (!resetToken.trim()) {
      setError('请输入重置码')
      return
    }
    if (!password) {
      setError('请输入新密码')
      return
    }
    if (password.length < 4) {
      setError('密码长度至少 4 位')
      return
    }
    if (password !== confirmPassword) {
      setError('两次输入的密码不一致')
      return
    }

    setLoading(true)
    try {
      const result = await resetCloudPassword(getCloudServerUrl(), resetToken.trim(), password)
      setMessage(result.message)
      // After successful reset, go back to login
      setMode('login')
      setError('')
      setTimeout(() => setMessage(result.message), 100)
    } catch (err) {
      setError(err instanceof Error ? err.message : '请求失败')
    } finally {
      setLoading(false)
    }
  }

  async function handleResendVerification() {
    if (!email.trim()) return
    setResendLoading(true)
    setResendMessage('')
    try {
      const result = await resendCloudVerification(getCloudServerUrl(), email.trim())
      setResendMessage(result.message)
    } catch (err) {
      setResendMessage(err instanceof Error ? err.message : '重发失败')
    } finally {
      setResendLoading(false)
    }
  }

  function switchMode(nextMode: AuthMode) {
    setError('')
    setMessage('')
    setRegisterResult(null)
    setResendMessage('')
    setResetToken('')
    setPassword('')
    setConfirmPassword('')
    setMode(nextMode)
  }

  // ── After successful registration: show verification instructions ──
  if (registerResult) {
    return (
      <section className="cover-empty-state has-cover">
        <div className="cover-empty-state-content">
          <div className="cover-empty-state-kicker">
            <span>01</span>
            <span className="cover-empty-state-rule" />
            <span>ActiNet</span>
          </div>

          <h2 className="cover-empty-state-title">
            <span>验证你的</span>
            <span className="is-italic">邮箱</span>
          </h2>

          <p className="cover-empty-state-byline">
            {registerResult.message}
          </p>

          {registerResult.user.email && (
            <div className="cover-auth-form">
              {resendMessage ? (
                <div className={resendMessage.includes('失败') ? 'cover-auth-error' : 'cover-auth-notice'}>
                  {resendMessage}
                </div>
              ) : null}
              <p style={{ fontSize: 14, opacity: 0.64, marginTop: 16 }}>
                没有收到邮件？检查垃圾邮件文件夹，或点击下方按钮重新发送。
              </p>
              <div className="cover-auth-actions">
                <button
                  type="button"
                  className="cover-auth-btn cover-auth-btn-primary"
                  onClick={handleResendVerification}
                  disabled={resendLoading}
                >
                  {resendLoading ? '发送中...' : '重新发送验证邮件'}
                </button>
                <button
                  type="button"
                  className="cover-auth-btn cover-auth-btn-secondary"
                  onClick={() => switchMode('login')}
                >
                  返回登录
                </button>
              </div>
            </div>
          )}
        </div>
      </section>
    )
  }

  // ── Forgot password: request reset ──
  if (mode === 'forgot') {
    return (
      <section className="cover-empty-state has-cover">
        <div className="cover-empty-state-content">
          <div className="cover-empty-state-kicker">
            <span>01</span>
            <span className="cover-empty-state-rule" />
            <span>ActiNet</span>
          </div>

          <h2 className="cover-empty-state-title">
            <span>重置密码</span>
          </h2>

          <p className="cover-empty-state-byline">
            输入注册时使用的邮箱，我们将向你发送密码重置码。
          </p>

          <form className="cover-auth-form" onSubmit={handleSubmit}>
            {error ? <div className="cover-auth-error">{error}</div> : null}

            <div className="cover-auth-field">
              <label className="cover-auth-label">邮箱</label>
              <input
                type="email"
                className="cover-auth-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@example.com"
                autoFocus
              />
            </div>

            <div className="cover-auth-actions">
              <button
                type="submit"
                className="cover-auth-btn cover-auth-btn-primary"
                disabled={loading}
              >
                {loading ? '发送中...' : '发送重置邮件'}
              </button>
              <button
                type="button"
                className="cover-auth-btn cover-auth-btn-secondary"
                onClick={() => switchMode('login')}
              >
                返回登录
              </button>
            </div>
          </form>
        </div>
      </section>
    )
  }

  // ── Forgot password sent: show instructions ──
  if (mode === 'forgotSent') {
    return (
      <section className="cover-empty-state has-cover">
        <div className="cover-empty-state-content">
          <div className="cover-empty-state-kicker">
            <span>01</span>
            <span className="cover-empty-state-rule" />
            <span>ActiNet</span>
          </div>

          <h2 className="cover-empty-state-title">
            <span>邮件已发送</span>
          </h2>

          {message ? (
            <p className="cover-empty-state-byline">{message}</p>
          ) : null}

          <div className="cover-auth-form">
            <p style={{ fontSize: 14, opacity: 0.64, marginTop: 16 }}>
              收到邮件后，请点击下方「输入重置码」设置新密码。如未收到邮件，请检查垃圾邮件文件夹或点击重新发送。
            </p>
            <div className="cover-auth-actions">
              <button
                type="button"
                className="cover-auth-btn cover-auth-btn-primary"
                onClick={() => switchMode('reset')}
              >
                我已有重置码
              </button>
              <button
                type="button"
                className="cover-auth-btn cover-auth-btn-secondary"
                onClick={async () => {
                  if (!resetEmail) return
                  setResendLoading(true)
                  setResendMessage('')
                  try {
                    const result = await requestCloudPasswordReset(getCloudServerUrl(), resetEmail)
                    setResendMessage(result.message)
                  } catch (err) {
                    setResendMessage(err instanceof Error ? err.message : '重发失败')
                  } finally {
                    setResendLoading(false)
                  }
                }}
                disabled={resendLoading}
              >
                {resendLoading ? '发送中...' : '重新发送'}
              </button>
            </div>
            {resendMessage ? (
              <div className={resendMessage.includes('失败') ? 'cover-auth-error' : 'cover-auth-notice'} style={{ marginTop: 12 }}>
                {resendMessage}
              </div>
            ) : null}
            <div className="cover-auth-actions" style={{ marginTop: 8 }}>
              <button
                type="button"
                className="cover-auth-btn cover-auth-btn-secondary"
                onClick={() => switchMode('login')}
              >
                返回登录
              </button>
            </div>
          </div>
        </div>
      </section>
    )
  }

  // ── Reset password: enter token + new password ──
  if (mode === 'reset') {
    return (
      <section className="cover-empty-state has-cover">
        <div className="cover-empty-state-content">
          <div className="cover-empty-state-kicker">
            <span>01</span>
            <span className="cover-empty-state-rule" />
            <span>ActiNet</span>
          </div>

          <h2 className="cover-empty-state-title">
            <span>设置新密码</span>
          </h2>

          <p className="cover-empty-state-byline">
            输入邮件中的重置码和新密码。
          </p>

          <form className="cover-auth-form" onSubmit={handleSubmit}>
            {error ? <div className="cover-auth-error">{error}</div> : null}
            {message ? <div className="cover-auth-notice">{message}</div> : null}

            <div className="cover-auth-field">
              <label className="cover-auth-label">重置码</label>
              <input
                type="text"
                className="cover-auth-input"
                value={resetToken}
                onChange={(e) => setResetToken(e.target.value)}
                placeholder="输入邮件中的 6 位重置码"
                autoFocus
              />
            </div>

            <div className="cover-auth-field">
              <label className="cover-auth-label">新密码</label>
              <input
                type="password"
                className="cover-auth-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="输入新密码（至少 4 位）"
              />
            </div>

            <div className="cover-auth-field">
              <label className="cover-auth-label">确认密码</label>
              <input
                type="password"
                className="cover-auth-input"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="再次输入新密码"
              />
            </div>

            <div className="cover-auth-actions">
              <button
                type="submit"
                className="cover-auth-btn cover-auth-btn-primary"
                disabled={loading}
              >
                {loading ? '重置中...' : '重置密码'}
              </button>
              <button
                type="button"
                className="cover-auth-btn cover-auth-btn-secondary"
                onClick={() => switchMode('login')}
              >
                返回登录
              </button>
            </div>
          </form>
        </div>
      </section>
    )
  }

  // ── Login / Register ──
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
          {mode === 'login' ? '登录 ActiNet 云服务以使用代理 API' : '注册 ActiNet 账号以开始使用云服务'}
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

          {mode === 'login' && (
            <div className="cover-auth-actions" style={{ justifyContent: 'center', marginTop: 8 }}>
              <button
                type="button"
                className="cover-auth-btn cover-auth-btn-link"
                onClick={() => switchMode('forgot')}
              >
                忘记密码？
              </button>
            </div>
          )}
        </form>
      </div>
    </section>
  )
}
