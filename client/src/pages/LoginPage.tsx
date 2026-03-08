import { useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { BookOpen, Lock, User, Eye, EyeOff, GraduationCap, AlertCircle, UserPlus } from 'lucide-react'

type Mode = 'login' | 'register'

export default function LoginPage() {
  const { login, register, user } = useAuth()
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
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          IOT-System · Smart Classroom Platform
        </p>
      </div>
    </div>
  )
}
