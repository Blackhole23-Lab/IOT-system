import { useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { BookOpen, Lock, User, Eye, EyeOff, GraduationCap, AlertCircle, UserPlus, MessageCircle } from 'lucide-react'

type Mode = 'login' | 'register'

// Simulated WeChat OAuth flow
// In a real app this would redirect to wx.qq.com/oauth2
function WechatLoginButton({ onSuccess, redirect }: { onSuccess: (token: string, user: { id: string; username: string; role: 'teacher' | 'student'; name: string }) => void; redirect: string }) {
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState<'idle' | 'scanning' | 'confirm'>('idle')
  const [wxName, setWxName] = useState('')
  const [wxRole, setWxRole] = useState<'student' | 'teacher'>('student')
  const [error, setError] = useState('')

  async function startWxLogin() {
    setLoading(true)
    setStep('scanning')
    // Simulate QR scan delay
    await new Promise(r => setTimeout(r, 1200))
    setStep('confirm')
    setLoading(false)
  }

  async function confirmWxLogin() {
    setLoading(true)
    setError('')
    try {
      // Generate a wx-prefixed unique username
      const wxId = 'wx_' + Math.random().toString(36).slice(2, 8)
      const displayName = wxName.trim() || (wxRole === 'student' ? '微信同学' : '微信老师')
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: wxId, password: wxId + '_wechat_auto', role: wxRole, name: displayName }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message || '微信登录失败')
      localStorage.setItem('iot_token', data.token)
      onSuccess(data.token, data.user)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '微信登录失败')
      setStep('idle')
    } finally {
      setLoading(false)
    }
  }

  if (step === 'idle') {
    return (
      <button
        type="button"
        onClick={startWxLogin}
        className="w-full flex items-center justify-center gap-2.5 py-2.5 px-4 rounded-xl border-2 border-[#07c160]/30 bg-[#07c160]/5 hover:bg-[#07c160]/10 hover:border-[#07c160]/50 text-[#07c160] font-semibold text-sm transition-all duration-150"
      >
        <MessageCircle className="w-4 h-4" />
        微信扫码登录 / 注册
      </button>
    )
  }

  if (step === 'scanning') {
    return (
      <div className="flex flex-col items-center gap-3 py-4">
        {/* Simulated WeChat QR */}
        <div className="relative w-32 h-32 border-2 border-[#07c160]/30 rounded-2xl flex items-center justify-center bg-[#07c160]/5">
          <div className="grid grid-cols-5 gap-0.5 opacity-30">
            {Array.from({ length: 25 }).map((_, i) => (
              <div key={i} className={`w-4 h-4 rounded-sm ${Math.random() > 0.5 ? 'bg-[#07c160]' : 'bg-transparent'}`} />
            ))}
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <MessageCircle className="w-8 h-8 text-[#07c160] animate-pulse" />
          </div>
        </div>
        <p className="text-xs text-slate-500 text-center">正在模拟微信扫码…</p>
        <div className="w-5 h-5 border-2 border-[#07c160]/30 border-t-[#07c160] rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-3 p-4 rounded-2xl border border-[#07c160]/20 bg-[#07c160]/5 animate-fade-up">
      <div className="flex items-center gap-2 text-[#07c160] text-sm font-semibold">
        <MessageCircle className="w-4 h-4" />
        微信账号确认登录
      </div>
      {error && (
        <p className="text-xs text-red-500 flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />{error}
        </p>
      )}
      <div>
        <label className="block text-xs text-slate-600 mb-1">显示名称 <span className="text-slate-400">（选填）</span></label>
        <input
          type="text" placeholder="您的姓名"
          className="input text-sm py-2"
          value={wxName}
          onChange={e => setWxName(e.target.value)}
        />
      </div>
      <div>
        <label className="block text-xs text-slate-600 mb-1.5">身份</label>
        <div className="grid grid-cols-2 gap-2">
          {(['student', 'teacher'] as const).map(r => (
            <button key={r} type="button" onClick={() => setWxRole(r)}
              className={`py-2 rounded-xl border-2 text-xs font-semibold transition-all ${wxRole === r
                ? r === 'student' ? 'border-emerald-400 bg-emerald-50 text-emerald-700' : 'border-brand-400 bg-brand-50 text-brand-700'
                : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}>
              {r === 'student' ? '🎓 学生' : '📚 教师'}
            </button>
          ))}
        </div>
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={() => setStep('idle')}
          className="flex-1 py-2 rounded-xl border border-slate-200 text-sm text-slate-500 hover:bg-slate-50 transition-colors">
          取消
        </button>
        <button type="button" onClick={confirmWxLogin} disabled={loading}
          className="flex-1 py-2 rounded-xl bg-[#07c160] text-white text-sm font-semibold hover:bg-[#06ad56] transition-colors disabled:opacity-60 flex items-center justify-center gap-1.5">
          {loading ? <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />登录中…</> : '确认登录'}
        </button>
      </div>
    </div>
  )
}

export default function LoginPage() {
  const { login, register, user, token: existingToken } = useAuth() as ReturnType<typeof useAuth> & { token: string | null }
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const redirectTo = searchParams.get('redirect') || '/dashboard'

  const [mode,      setMode]     = useState<Mode>('login')
  const [username,  setUsername] = useState('')
  const [password,  setPassword] = useState('')
  const [name,      setName]     = useState('')
  const [role,      setRole]     = useState<'student' | 'teacher'>('student')
  const [showPwd,   setShowPwd]  = useState(false)
  const [loading,   setLoading]  = useState(false)
  const [error,     setError]    = useState('')

  if (user) {
    navigate(redirectTo, { replace: true })
    return null
  }

  function switchMode(m: Mode) {
    setMode(m); setError(''); setUsername(''); setPassword(''); setName('')
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (mode === 'login') {
        await login(username.trim(), password)
      } else {
        await register(username.trim(), password, role, name.trim() || undefined)
      }
      navigate(redirectTo, { replace: true })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : mode === 'login' ? '登录失败，请重试' : '注册失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  function handleWxSuccess(_token: string, _wxUser: { id: string; username: string; role: 'teacher' | 'student'; name: string }) {
    // auth.tsx will pick up from localStorage on next render via useEffect
    // force a page reload to trigger the AuthProvider hydration
    window.location.replace(redirectTo)
  }

  return (
    <div className="page-center">
      {/* Background decoration */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none" aria-hidden>
        <div className="absolute -top-32 -left-32 w-[600px] h-[600px] rounded-full bg-brand-400/10 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 w-[500px] h-[500px] rounded-full bg-indigo-400/10 blur-3xl" />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[300px] h-[300px] rounded-full bg-brand-300/8 blur-2xl" />
      </div>

      <div className="w-full max-w-md relative animate-fade-up">
        {/* Logo / header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-brand-600 shadow-lg shadow-brand-600/30 mb-4">
            <GraduationCap className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800 mb-1">智慧课堂系统</h1>
          <p className="text-slate-500 text-sm">Smart Classroom · Unified Platform</p>
          {redirectTo !== '/dashboard' && (
            <p className="mt-2 text-xs text-brand-600 bg-brand-50 border border-brand-100 rounded-full px-3 py-1 inline-block">
              登录后自动进入：{decodeURIComponent(redirectTo)}
            </p>
          )}
        </div>

        {/* Card */}
        <div className="card shadow-card-lg border-slate-100">
          {/* Mode tabs */}
          <div className="flex gap-1 p-1 rounded-xl bg-slate-100 mb-6">
            <button
              type="button"
              onClick={() => switchMode('login')}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all duration-150 ${mode === 'login' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              账号登录
            </button>
            <button
              type="button"
              onClick={() => switchMode('register')}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all duration-150 ${mode === 'register' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              注册账号
            </button>
          </div>

          {error && (
            <div className="flex items-center gap-2 px-4 py-3 mb-5 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm animate-fade-up">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">用户名</label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                  <User className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  className="input pl-10"
                  placeholder={mode === 'register' ? '3-20个字符' : '输入用户名'}
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  autoComplete="username"
                  autoFocus
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">密码</label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                  <Lock className="w-4 h-4" />
                </span>
                <input
                  type={showPwd ? 'text' : 'password'}
                  className="input pl-10 pr-11"
                  placeholder={mode === 'register' ? '至少6位' : '输入密码'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  required
                />
                <button
                  type="button"
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  onClick={() => setShowPwd(v => !v)}
                  tabIndex={-1}
                  aria-label={showPwd ? '隐藏密码' : '显示密码'}
                >
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Register-only fields */}
            {mode === 'register' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">显示名称 <span className="text-slate-400 font-normal">（选填）</span></label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                      <UserPlus className="w-4 h-4" />
                    </span>
                    <input
                      type="text"
                      className="input pl-10"
                      placeholder="您的姓名"
                      value={name}
                      onChange={e => setName(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">角色</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['student', 'teacher'] as const).map(r => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setRole(r)}
                        className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all duration-150 ${role === r
                          ? r === 'student'
                            ? 'border-emerald-400 bg-emerald-50 text-emerald-700'
                            : 'border-brand-400 bg-brand-50 text-brand-700'
                          : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'}`}
                      >
                        {r === 'student' ? '🎓 学生' : '📚 教师'}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            <button
              type="submit"
              disabled={loading || !username || !password}
              className="btn-primary btn-lg w-full mt-6"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  {mode === 'login' ? '登录中…' : '注册中…'}
                </>
              ) : (
                <>
                  {mode === 'login' ? <BookOpen className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                  {mode === 'login' ? '登录' : '注册并登录'}
                </>
              )}
            </button>
          </form>

          {/* WeChat login */}
          <div className="mt-4 pt-4 border-t border-slate-100">
            <p className="text-xs text-slate-400 mb-3 text-center font-medium">— 或使用其他方式 —</p>
            <WechatLoginButton onSuccess={handleWxSuccess} redirect={redirectTo} />
          </div>

          {/* Demo accounts hint — only in login mode */}
          {mode === 'login' && (
            <div className="mt-5 pt-5 border-t border-slate-100">
              <p className="text-xs text-slate-400 mb-2.5 font-medium uppercase tracking-wider">演示账号</p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { role: '管理员', user: 'admin',   pass: 'admin123'   },
                  { role: '教师',   user: 'teacher', pass: 'teacher123' },
                  { role: '学生',   user: 'student', pass: 'student123' },
                ].map(acc => (
                  <button
                    key={acc.user}
                    type="button"
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-100 bg-slate-50 hover:bg-brand-50 hover:border-brand-200 transition-all duration-150 text-left group"
                    onClick={() => { setUsername(acc.user); setPassword(acc.pass) }}
                  >
                    <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
                      acc.role === '管理员' ? 'bg-red-100 text-red-700' :
                      acc.role === '教师' ? 'bg-brand-100 text-brand-700' : 'bg-emerald-100 text-emerald-700'}`}>
                      {acc.role}
                    </span>
                    <span className="text-xs text-slate-500 font-mono group-hover:text-brand-600 transition-colors">{acc.user}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          IOT-System · Smart Classroom Platform
        </p>
      </div>
    </div>
  )
}
