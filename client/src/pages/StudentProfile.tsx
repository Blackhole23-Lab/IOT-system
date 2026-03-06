import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import {
  GraduationCap, ArrowLeft, TrendingUp, Award, Clock, CheckCircle2,
  AlertCircle, BarChart2, BookOpen, ChevronDown, ChevronUp, Monitor, Calendar
} from 'lucide-react'

interface AnswerDetail {
  answer: unknown
  score: number | null
  maxScore: number
}

interface Submission {
  id: string
  examId: string
  examTitle: string
  score: number
  totalScore: number
  status: 'completed' | 'pending'
  submittedAt: string
  answers?: Record<string, AnswerDetail>
}

interface Attendance {
  id: string
  roomCode: string
  date: string
  joinedAt: string
}

type Tab = 'exam' | 'class'

export default function StudentProfile() {
  const { user, token, logout } = useAuth()
  const navigate = useNavigate()

  const [tab,          setTab]          = useState<Tab>('exam')
  const [submissions,  setSubmissions]  = useState<Submission[]>([])
  const [attendances,  setAttendances]  = useState<Attendance[]>([])
  const [loading,      setLoading]      = useState(true)
  const [expandedId,   setExpandedId]   = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    setLoading(true)
    Promise.all([
      fetch(`/api/test/submissions/${user.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then(r => r.json()),
      fetch(`/api/teach/attend/${user.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then(r => r.json()),
    ]).then(([examData, classData]) => {
      if (examData.success)  setSubmissions(examData.submissions)
      if (classData.success) setAttendances(classData.attendances)
    }).finally(() => setLoading(false))
  }, [user, token])

  const totalExams   = submissions.length
  const avgScore     = totalExams ? Math.round(submissions.reduce((s, x) => s + (x.totalScore ? x.score / x.totalScore * 100 : 0), 0) / totalExams) : 0
  const bestScore    = totalExams ? Math.max(...submissions.map(x => x.totalScore ? Math.round(x.score / x.totalScore * 100) : 0)) : 0
  const pendingCount = submissions.filter(x => x.status === 'pending').length
  const totalClasses = attendances.length

  function scorePct(s: Submission) {
    return s.totalScore ? Math.round(s.score / s.totalScore * 100) : 0
  }

  function scoreColor(pct: number) {
    if (pct >= 90) return 'text-emerald-600'
    if (pct >= 70) return 'text-brand-600'
    if (pct >= 60) return 'text-amber-600'
    return 'text-red-500'
  }

  function barColor(pct: number) {
    if (pct >= 90) return 'bg-emerald-500'
    if (pct >= 70) return 'bg-brand-500'
    if (pct >= 60) return 'bg-amber-500'
    return 'bg-red-500'
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/40">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-slate-100 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/dashboard')}
              className="p-2 rounded-lg hover:bg-slate-100 transition-colors text-slate-500"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-brand-600 flex items-center justify-center">
                <GraduationCap className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="font-bold text-slate-800 text-sm leading-none">我的学习档案</p>
                <p className="text-xs text-slate-500 mt-0.5">{user?.name}</p>
              </div>
            </div>
          </div>
          <button
            onClick={() => { logout(); navigate('/login', { replace: true }) }}
            className="text-xs text-slate-400 hover:text-red-500 transition-colors"
          >
            退出登录
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Hero banner */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-brand-600 to-indigo-600 p-6 text-white shadow-lg shadow-brand-600/20">
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute -top-8 -right-8 w-48 h-48 rounded-full bg-white/10 blur-2xl" />
            <div className="absolute bottom-0 left-1/3 w-32 h-32 rounded-full bg-white/5 blur-xl" />
          </div>
          <div className="relative">
            <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center mb-4 text-2xl">
              {user?.name?.charAt(0) || '同'}
            </div>
            <h2 className="text-xl font-bold mb-0.5">{user?.name}</h2>
            <p className="text-white/70 text-sm">@{user?.username} · 学生</p>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { icon: BookOpen,   label: '参加考试', value: totalExams,     color: 'text-indigo-600',  bg: 'bg-indigo-50' },
            { icon: TrendingUp, label: '平均分',   value: `${avgScore}%`, color: 'text-brand-600',   bg: 'bg-brand-50' },
            { icon: Award,      label: '最高分',   value: `${bestScore}%`,color: 'text-emerald-600', bg: 'bg-emerald-50' },
            { icon: Monitor,    label: '上课次数', value: totalClasses,   color: 'text-purple-600',  bg: 'bg-purple-50' },
          ].map(stat => (
            <div key={stat.label} className="card p-4">
              <div className={`w-9 h-9 rounded-xl ${stat.bg} flex items-center justify-center mb-3`}>
                <stat.icon className={`w-4.5 h-4.5 ${stat.color}`} />
              </div>
              <p className={`text-2xl font-bold ${stat.color} font-mono`}>{stat.value}</p>
              <p className="text-xs text-slate-500 mt-0.5">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Tab switcher */}
        <div className="flex gap-1 p-1 bg-slate-100 rounded-xl">
          <button
            onClick={() => setTab('exam')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition-all ${tab === 'exam' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <BarChart2 className="w-4 h-4" /> 考试记录
            {pendingCount > 0 && <span className="ml-1 px-1.5 py-0.5 rounded-full text-xs bg-amber-100 text-amber-700">{pendingCount}</span>}
          </button>
          <button
            onClick={() => setTab('class')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition-all ${tab === 'class' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <Monitor className="w-4 h-4" /> 上课记录
          </button>
        </div>

        {/* Exam records tab */}
        {tab === 'exam' && (
          <div className="card">
            <div className="flex items-center gap-2 mb-5">
              <BarChart2 className="w-5 h-5 text-indigo-500" />
              <h3 className="font-semibold text-slate-800">考试记录</h3>
              <span className="ml-auto text-xs text-slate-400">{totalExams} 次</span>
            </div>

            {loading ? (
              <div className="space-y-3">
                {[1,2,3].map(i => (
                  <div key={i} className="h-16 rounded-xl bg-slate-100 animate-pulse" />
                ))}
              </div>
            ) : submissions.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
                  <BookOpen className="w-8 h-8 text-slate-300" />
                </div>
                <p className="text-slate-500 font-medium">暂无考试记录</p>
                <p className="text-slate-400 text-sm mt-1">参加考试后成绩将显示在这里</p>
              </div>
            ) : (
              <div className="space-y-3">
                {submissions.map(sub => {
                  const pct      = scorePct(sub)
                  const expanded = expandedId === sub.id
                  return (
                    <div
                      key={sub.id}
                      className="rounded-xl border border-slate-100 overflow-hidden hover:border-slate-200 transition-colors"
                    >
                      <button
                        className="w-full text-left px-4 py-3.5 flex items-center gap-3"
                        onClick={() => setExpandedId(expanded ? null : sub.id)}
                      >
                        {/* Score ring */}
                        <div className="relative w-11 h-11 shrink-0">
                          <svg className="w-11 h-11 -rotate-90" viewBox="0 0 40 40">
                            <circle cx="20" cy="20" r="16" fill="none" stroke="#e2e8f0" strokeWidth="3.5" />
                            <circle
                              cx="20" cy="20" r="16" fill="none"
                              stroke={pct >= 90 ? '#10b981' : pct >= 70 ? '#6366f1' : pct >= 60 ? '#f59e0b' : '#ef4444'}
                              strokeWidth="3.5"
                              strokeDasharray={`${pct} 100`}
                              strokeLinecap="round"
                            />
                          </svg>
                          <span className={`absolute inset-0 flex items-center justify-center text-xs font-bold ${scoreColor(pct)}`}>
                            {pct}
                          </span>
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-slate-800 text-sm truncate">{sub.examTitle}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className={`text-xs font-mono ${scoreColor(pct)}`}>
                              {sub.score} / {sub.totalScore} 分
                            </span>
                            {sub.status === 'pending' ? (
                              <span className="inline-flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">
                                <Clock className="w-2.5 h-2.5" /> 待批改
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">
                                <CheckCircle2 className="w-2.5 h-2.5" /> 已完成
                              </span>
                            )}
                            <span className="text-xs text-slate-400 ml-auto">
                              {new Date(sub.submittedAt).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>

                        <div className="text-slate-400 shrink-0 ml-2">
                          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </div>
                      </button>

                      {/* Score bar */}
                      <div className="px-4 pb-3 -mt-1">
                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${barColor(pct)} rounded-full transition-all duration-700`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>

                      {/* Expanded: per-question detail */}
                      {expanded && sub.answers && (
                        <div className="border-t border-slate-100 px-4 py-3 bg-slate-50/50">
                          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">逐题得分</p>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {Object.entries(sub.answers).map(([qid, detail]) => (
                              <div key={qid} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-slate-100">
                                <span className="text-xs text-slate-400 font-mono">#{qid}</span>
                                {detail.score === null ? (
                                  <span className="text-xs text-amber-600 ml-auto flex items-center gap-1">
                                    <AlertCircle className="w-3 h-3" /> 待批
                                  </span>
                                ) : (
                                  <span className={`text-xs font-semibold ml-auto ${detail.score === detail.maxScore ? 'text-emerald-600' : detail.score > 0 ? 'text-amber-600' : 'text-red-500'}`}>
                                    {detail.score}/{detail.maxScore}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                          {sub.status === 'pending' && (
                            <p className="text-xs text-amber-600 mt-3 flex items-center gap-1.5">
                              <Clock className="w-3 h-3" /> 含主观题（编程题/简答题），等待教师批改后分数将更新
                            </p>
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

        {/* Class attendance tab */}
        {tab === 'class' && (
          <div className="card">
            <div className="flex items-center gap-2 mb-5">
              <Monitor className="w-5 h-5 text-purple-500" />
              <h3 className="font-semibold text-slate-800">上课记录</h3>
              <span className="ml-auto text-xs text-slate-400">{totalClasses} 次</span>
            </div>

            {loading ? (
              <div className="space-y-3">
                {[1,2,3].map(i => (
                  <div key={i} className="h-14 rounded-xl bg-slate-100 animate-pulse" />
                ))}
              </div>
            ) : attendances.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
                  <Monitor className="w-8 h-8 text-slate-300" />
                </div>
                <p className="text-slate-500 font-medium">暂无上课记录</p>
                <p className="text-slate-400 text-sm mt-1">进入老师的演示课堂后记录将显示在这里</p>
              </div>
            ) : (
              <div className="space-y-2">
                {attendances.map((att, idx) => (
                  <div key={att.id} className="flex items-center gap-3 px-4 py-3 rounded-xl border border-slate-100 hover:border-slate-200 transition-colors">
                    <div className="w-9 h-9 rounded-xl bg-purple-50 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-purple-600">#{idx + 1}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800">
                        房间 <span className="font-mono text-purple-600">{att.roomCode}</span>
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(att.joinedAt).toLocaleDateString('zh-CN', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-1 text-xs text-purple-600 bg-purple-50 px-2 py-1 rounded-full font-medium shrink-0">
                      <CheckCircle2 className="w-3 h-3" /> 已签到
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
