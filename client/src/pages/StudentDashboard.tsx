import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import {
  GraduationCap, Monitor, ClipboardList, LogOut, ArrowRight,
  BarChart2, Clock, CheckCircle2, AlertCircle, BookOpen,
  TrendingUp, Award, Calendar, ChevronDown, ChevronUp,
  Hash, Wifi
} from 'lucide-react'

interface Submission {
  id: string; examId: string; examTitle: string
  score: number; totalScore: number
  status: 'completed' | 'pending'; submittedAt: string
  answers?: Record<string, { answer: unknown; score: number | null; maxScore: number; questionText?: string; questionType?: string; options?: string[]; correctAnswer?: string | string[] }>
}
interface Attendance { id: string; roomCode: string; date: string; joinedAt: string }
type Tab = 'home' | 'exam' | 'class'

export default function StudentDashboard() {
  const { user, token, logout } = useAuth()
  const navigate = useNavigate()

  const [tab, setTab]               = useState<Tab>('home')
  const [joinCode, setJoinCode]     = useState('')
  const [joinType, setJoinType]     = useState<'teach' | 'test'>('teach')
  const [joinError, setJoinError]   = useState('')

  const [submissions,  setSubmissions]  = useState<Submission[]>([])
  const [attendances,  setAttendances]  = useState<Attendance[]>([])
  const [loading,      setLoading]      = useState(true)
  const [expandedId,   setExpandedId]   = useState<string | null>(null)
  const [reviewData,   setReviewData]   = useState<Record<string, Submission['answers']>>({})
  const [loadingReview, setLoadingReview] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    setLoading(true)
    Promise.all([
      fetch(`/api/test/submissions/${user.id}`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch(`/api/teach/attend/${user.id}`,     { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
    ]).then(([e, c]) => {
      if (e.success) setSubmissions(e.submissions)
      if (c.success) setAttendances(c.attendances)
    }).finally(() => setLoading(false))
  }, [user, token])

  const totalExams   = submissions.length
  const totalClasses = attendances.length
  const avgScore     = totalExams ? Math.round(submissions.reduce((s, x) => s + (x.totalScore ? x.score / x.totalScore * 100 : 0), 0) / totalExams) : 0
  const bestScore    = totalExams ? Math.max(...submissions.map(x => x.totalScore ? Math.round(x.score / x.totalScore * 100) : 0)) : 0
  const pendingCount = submissions.filter(x => x.status === 'pending').length

  function pct(s: Submission) { return s.totalScore ? Math.round(s.score / s.totalScore * 100) : 0 }
  function scoreColor(p: number) { return p >= 90 ? 'text-emerald-600' : p >= 70 ? 'text-indigo-600' : p >= 60 ? 'text-amber-600' : 'text-red-500' }
  function barColor(p: number)   { return p >= 90 ? 'bg-emerald-500' : p >= 70 ? 'bg-indigo-500' : p >= 60 ? 'bg-amber-500' : 'bg-red-500' }

  function handleJoin() {
    const code = joinCode.trim().toUpperCase()
    if (code.length < 4) { setJoinError('请输入至少4位房间码'); return }
    setJoinError('')
    navigate(`/${joinType}/student/${code}`)
  }

  async function loadReview(sub: Submission) {
    if (sub.status !== 'completed') return
    if (reviewData[sub.id]) {
      setExpandedId(expandedId === sub.id ? null : sub.id)
      return
    }
    setExpandedId(sub.id)
    setLoadingReview(sub.id)
    try {
      const res = await fetch(`/api/test/submissions/review/${user!.id}/${sub.examId}`, {
        headers: { Authorization: `Bearer ${token}` }
      }).then(r => r.json())
      if (res.success) setReviewData(prev => ({ ...prev, [sub.id]: res.submission.answers }))
    } finally {
      setLoadingReview(null)
    }
  }

  const recentExams    = submissions.slice(0, 3)
  const recentClasses  = attendances.slice(0, 3)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/40">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-slate-100 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-brand-600 flex items-center justify-center">
              <GraduationCap className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-brand-800">智慧课堂</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="badge badge-green text-xs">学生</span>
            <span className="text-sm text-slate-600 font-medium hidden sm:block">{user?.name}</span>
            <button onClick={() => { logout(); navigate('/login', { replace: true }) }}
              className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-red-500 transition-colors">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Tab nav */}
      <div className="bg-white border-b border-slate-100">
        <div className="max-w-4xl mx-auto px-4 flex gap-0">
          {([
            { id: 'home',  label: '首页',     icon: GraduationCap },
            { id: 'exam',  label: '考试记录', icon: BarChart2,  badge: pendingCount },
            { id: 'class', label: '上课记录', icon: Monitor },
          ] as const).map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${tab === t.id ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
              <t.icon className="w-4 h-4" />
              {t.label}
              {'badge' in t && t.badge > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-xs bg-amber-100 text-amber-700">{t.badge}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">

        {/* ── HOME TAB ── */}
        {tab === 'home' && (
          <>
            {/* Hero */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-brand-600 to-indigo-600 p-6 text-white shadow-lg">
              <div className="absolute -top-8 -right-8 w-48 h-48 rounded-full bg-white/10 blur-2xl pointer-events-none" />
              <div className="relative">
                <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center mb-3 text-xl font-bold">
                  {user?.name?.charAt(0) || '同'}
                </div>
                <h2 className="text-xl font-bold">欢迎回来，{user?.name}</h2>
                <p className="text-white/70 text-sm mt-0.5">@{user?.username} · 学生</p>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { icon: BookOpen,   label: '参加考试', value: totalExams,      color: 'text-indigo-600', bg: 'bg-indigo-50' },
                { icon: TrendingUp, label: '平均分',   value: `${avgScore}%`,  color: 'text-brand-600',  bg: 'bg-brand-50' },
                { icon: Award,      label: '最高分',   value: `${bestScore}%`, color: 'text-emerald-600',bg: 'bg-emerald-50' },
                { icon: Monitor,    label: '上课次数', value: totalClasses,    color: 'text-purple-600', bg: 'bg-purple-50' },
              ].map(s => (
                <div key={s.label} className="card p-4">
                  <div className={`w-9 h-9 rounded-xl ${s.bg} flex items-center justify-center mb-3`}>
                    <s.icon className={`w-4 h-4 ${s.color}`} />
                  </div>
                  <p className={`text-2xl font-bold ${s.color} font-mono`}>{s.value}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Join room */}
            <div className="card shadow-card-lg">
              <h3 className="font-bold text-slate-800 mb-1">
                {joinType === 'test' ? '进入考试' : '进入课堂'}
              </h3>
              <p className="text-sm text-slate-500 mb-5">输入老师提供的6位房间码加入</p>

              <div className="flex gap-1 p-1 bg-slate-100 rounded-xl mb-4">
                {[
                  { id: 'teach' as const, label: '演示课堂', icon: Monitor },
                  { id: 'test'  as const, label: '在线考试', icon: ClipboardList },
                ].map(opt => (
                  <button key={opt.id} onClick={() => setJoinType(opt.id)}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition-all ${joinType === opt.id ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                    <opt.icon className="w-3.5 h-3.5" />{opt.label}
                  </button>
                ))}
              </div>

              <div className="relative mb-4">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-sm">#</span>
                <input type="text" className="input-lg pl-9 uppercase font-mono tracking-widest w-full"
                  placeholder="输入6位房间码" maxLength={8}
                  value={joinCode}
                  onChange={e => { setJoinCode(e.target.value.toUpperCase()); setJoinError('') }}
                  onKeyDown={e => e.key === 'Enter' && handleJoin()}
                  autoComplete="off" spellCheck={false} />
              </div>
              {joinError && <p className="text-xs text-red-500 mb-3 flex items-center gap-1">⚠ {joinError}</p>}
              <button onClick={handleJoin} disabled={!joinCode}
                className="btn-primary btn-lg w-full">
                <ArrowRight className="w-4 h-4" />
                {joinType === 'test' ? '进入考试' : '进入课堂'}
              </button>
            </div>

            {/* Recent exams preview */}
            {recentExams.length > 0 && (
              <div className="card">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-slate-800 flex items-center gap-2"><BarChart2 className="w-4 h-4 text-indigo-500" />最近考试</h3>
                  <button onClick={() => setTab('exam')} className="text-xs text-brand-600 hover:underline">查看全部</button>
                </div>
                <div className="space-y-2">
                  {recentExams.map(sub => {
                    const p = pct(sub)
                    return (
                      <div key={sub.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-slate-100">
                        <div className="relative w-9 h-9 shrink-0">
                          <svg className="w-9 h-9 -rotate-90" viewBox="0 0 40 40">
                            <circle cx="20" cy="20" r="16" fill="none" stroke="#e2e8f0" strokeWidth="4" />
                            <circle cx="20" cy="20" r="16" fill="none"
                              stroke={p >= 90 ? '#10b981' : p >= 70 ? '#6366f1' : p >= 60 ? '#f59e0b' : '#ef4444'}
                              strokeWidth="4" strokeDasharray={`${p} 100`} strokeLinecap="round" />
                          </svg>
                          <span className={`absolute inset-0 flex items-center justify-center text-xs font-bold ${scoreColor(p)}`}>{p}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-800 truncate">{sub.examTitle}</p>
                          <p className={`text-xs font-mono ${scoreColor(p)}`}>{sub.score}/{sub.totalScore} 分</p>
                        </div>
                        {sub.status === 'pending'
                          ? <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full flex items-center gap-1"><Clock className="w-3 h-3" />待批</span>
                          : <span className="text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />完成</span>
                        }
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Recent classes preview */}
            {recentClasses.length > 0 && (
              <div className="card">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-slate-800 flex items-center gap-2"><Monitor className="w-4 h-4 text-purple-500" />最近上课</h3>
                  <button onClick={() => setTab('class')} className="text-xs text-brand-600 hover:underline">查看全部</button>
                </div>
                <div className="space-y-2">
                  {recentClasses.map(att => (
                    <div key={att.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-slate-100">
                      <div className="w-9 h-9 rounded-xl bg-purple-50 flex items-center justify-center shrink-0">
                        <Wifi className="w-4 h-4 text-purple-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800">房间 <span className="font-mono text-purple-600">{att.roomCode}</span></p>
                        <p className="text-xs text-slate-400 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(att.joinedAt).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* ── EXAM TAB ── */}
        {tab === 'exam' && (
          <div className="card">
            <div className="flex items-center gap-2 mb-5">
              <BarChart2 className="w-5 h-5 text-indigo-500" />
              <h3 className="font-semibold text-slate-800">考试记录</h3>
              <span className="ml-auto text-xs text-slate-400">{totalExams} 次</span>
            </div>
            {loading ? (
              <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 rounded-xl bg-slate-100 animate-pulse" />)}</div>
            ) : submissions.length === 0 ? (
              <div className="text-center py-12">
                <BookOpen className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500 font-medium">暂无考试记录</p>
              </div>
            ) : (
              <div className="space-y-3">
                {submissions.map(sub => {
                  const p = pct(sub)
                  const expanded = expandedId === sub.id
                  const review = reviewData[sub.id]
                  return (
                    <div key={sub.id} className="rounded-xl border border-slate-100 overflow-hidden hover:border-slate-200 transition-colors">
                      <button className="w-full text-left px-4 py-3.5 flex items-center gap-3"
                        onClick={() => sub.status === 'completed' ? loadReview(sub) : setExpandedId(expanded ? null : sub.id)}>
                        <div className="relative w-11 h-11 shrink-0">
                          <svg className="w-11 h-11 -rotate-90" viewBox="0 0 40 40">
                            <circle cx="20" cy="20" r="16" fill="none" stroke="#e2e8f0" strokeWidth="3.5" />
                            <circle cx="20" cy="20" r="16" fill="none"
                              stroke={p >= 90 ? '#10b981' : p >= 70 ? '#6366f1' : p >= 60 ? '#f59e0b' : '#ef4444'}
                              strokeWidth="3.5" strokeDasharray={`${p} 100`} strokeLinecap="round" />
                          </svg>
                          <span className={`absolute inset-0 flex items-center justify-center text-xs font-bold ${scoreColor(p)}`}>{p}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-slate-800 text-sm truncate">{sub.examTitle}</p>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className={`text-xs font-mono ${scoreColor(p)}`}>{sub.score} / {sub.totalScore} 分</span>
                            {sub.status === 'pending'
                              ? <span className="inline-flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full"><Clock className="w-2.5 h-2.5" />待批改</span>
                              : <span className="inline-flex items-center gap-1 text-xs text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full"><CheckCircle2 className="w-2.5 h-2.5" />已完成</span>}
                            <span className="text-xs text-slate-400 ml-auto">
                              {new Date(sub.submittedAt).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>
                        <div className="text-slate-400 shrink-0 ml-2">
                          {sub.status === 'completed'
                            ? (expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />)
                            : <Clock className="w-4 h-4 text-amber-400" />}
                        </div>
                      </button>

                      {/* Score bar */}
                      <div className="px-4 pb-3 -mt-1">
                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className={`h-full ${barColor(p)} rounded-full transition-all duration-700`} style={{ width: `${p}%` }} />
                        </div>
                      </div>

                      {/* Expanded review */}
                      {expanded && (
                        <div className="border-t border-slate-100 bg-slate-50/50 px-4 py-4">
                          {loadingReview === sub.id ? (
                            <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-10 bg-slate-200 rounded-lg animate-pulse" />)}</div>
                          ) : review ? (
                            <div className="space-y-4">
                              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">逐题详情</p>
                              {Object.entries(review).map(([qid, d]) => {
                                const correct = d.score === d.maxScore
                                const wrong   = typeof d.score === 'number' && d.score < d.maxScore
                                return (
                                  <div key={qid} className={`rounded-xl border p-3 ${correct ? 'border-emerald-200 bg-emerald-50/50' : wrong ? 'border-red-200 bg-red-50/50' : 'border-slate-200 bg-white'}`}>
                                    <div className="flex items-start gap-2 mb-2">
                                      <span className={`shrink-0 text-xs font-bold px-1.5 py-0.5 rounded-md ${correct ? 'bg-emerald-100 text-emerald-700' : wrong ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'}`}>
                                        {d.questionType === 'single' ? '单选' : d.questionType === 'multiple' ? '多选' : d.questionType === 'judge' ? '判断' : d.questionType === 'code' ? '编程' : '简答'}
                                      </span>
                                      <p className="text-sm text-slate-800 font-medium flex-1">{d.questionText}</p>
                                      <span className={`text-xs font-bold shrink-0 ${correct ? 'text-emerald-600' : wrong ? 'text-red-500' : 'text-amber-600'}`}>
                                        {d.score === null ? '待批' : `${d.score}/${d.maxScore}`}
                                      </span>
                                    </div>
                                    {d.options && d.options.length > 0 && (
                                      <div className="grid grid-cols-2 gap-1 mb-2 ml-1">
                                        {d.options.map((opt, i) => (
                                          <span key={i} className="text-xs text-slate-500">{String.fromCharCode(65+i)}. {opt}</span>
                                        ))}
                                      </div>
                                    )}
                                    <div className="flex flex-col gap-1 text-xs ml-1">
                                      <span className="text-slate-500">
                                        你的答案：<span className="font-mono text-slate-700">{Array.isArray(d.answer) ? d.answer.map(a => String.fromCharCode(64+Number(a))).join('、') : d.questionType === 'judge' ? (d.answer === 'true' ? '✓ 正确' : '✗ 错误') : d.questionType === 'single' && d.answer ? String.fromCharCode(64+Number(d.answer)) : String(d.answer || '（未作答）')}</span>
                                      </span>
                                      {d.questionType !== 'essay' && d.questionType !== 'code' && (
                                        <span className="text-emerald-700">
                                          正确答案：<span className="font-mono">{Array.isArray(d.correctAnswer) ? d.correctAnswer.map(a => String.fromCharCode(64+Number(a))).join('、') : d.questionType === 'judge' ? (d.correctAnswer === 'true' ? '✓ 正确' : '✗ 错误') : d.questionType === 'single' && d.correctAnswer ? String.fromCharCode(64+Number(d.correctAnswer)) : String(d.correctAnswer)}</span>
                                        </span>
                                      )}
                                      {(d.questionType === 'essay' || d.questionType === 'code') && d.correctAnswer && (
                                        <div className="mt-1">
                                          <span className="text-emerald-700 block mb-1">参考答案：</span>
                                          <pre className="text-xs bg-white rounded-lg p-2 border border-emerald-200 text-slate-700 whitespace-pre-wrap font-mono overflow-x-auto">{Array.isArray(d.correctAnswer) ? d.correctAnswer.join('\n') : d.correctAnswer}</pre>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          ) : (
                            <div className="text-center py-4">
                              <AlertCircle className="w-5 h-5 text-slate-300 mx-auto mb-1" />
                              <p className="text-xs text-slate-500">暂无详情</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ── CLASS TAB ── */}
        {tab === 'class' && (
          <div className="card">
            <div className="flex items-center gap-2 mb-5">
              <Monitor className="w-5 h-5 text-purple-500" />
              <h3 className="font-semibold text-slate-800">上课记录</h3>
              <span className="ml-auto text-xs text-slate-400">{totalClasses} 次</span>
            </div>
            {loading ? (
              <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-14 rounded-xl bg-slate-100 animate-pulse" />)}</div>
            ) : attendances.length === 0 ? (
              <div className="text-center py-12">
                <Monitor className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500 font-medium">暂无上课记录</p>
                <p className="text-slate-400 text-sm mt-1">进入老师的演示课堂后，记录将显示在这里</p>
              </div>
            ) : (
              <div className="space-y-2">
                {attendances.map((att, idx) => (
                  <div key={att.id} className="flex items-center gap-3 px-4 py-3 rounded-xl border border-slate-100 hover:border-slate-200 transition-colors">
                    <div className="w-9 h-9 rounded-xl bg-purple-50 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-purple-600">#{idx + 1}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800">房间 <span className="font-mono text-purple-600">{att.roomCode}</span></p>
                      <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(att.joinedAt).toLocaleDateString('zh-CN', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-1 text-xs text-purple-600 bg-purple-50 px-2 py-1 rounded-full font-medium shrink-0">
                      <CheckCircle2 className="w-3 h-3" />已签到
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </main>
    </div>
  )
}
