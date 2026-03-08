import { useEffect, useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import {
  ArrowLeft, GraduationCap, BarChart2, Monitor, Clock,
  CheckCircle2, AlertCircle, ChevronDown, ChevronUp,
  TrendingUp, Award, BookOpen, Calendar, Save
} from 'lucide-react'

interface AnswerDetail {
  answer: unknown; score: number | null; maxScore: number
  questionText?: string; questionType?: string; options?: string[]; correctAnswer?: string | string[]
}
interface Submission {
  id: string; examId: string; examTitle: string
  score: number; totalScore: number; status: 'completed' | 'pending'
  submittedAt: string; answers?: Record<string, AnswerDetail>
}
interface Attendance { id: string; roomCode: string; date: string; joinedAt: string }
interface StudentInfo { id: string; username: string; name: string }

export default function TeacherStudentRecord() {
  const { studentId }    = useParams<{ studentId: string }>()
  const { token }        = useAuth()
  const navigate         = useNavigate()
  const [searchParams]   = useSearchParams()
  const autoExamId       = searchParams.get('exam')

  const [studentInfo,  setStudentInfo]  = useState<StudentInfo | null>(null)
  const [submissions,  setSubmissions]  = useState<Submission[]>([])
  const [attendances,  setAttendances]  = useState<Attendance[]>([])
  const [loading,      setLoading]      = useState(true)

  const [expandedId,   setExpandedId]   = useState<string | null>(null)
  const [detailData,   setDetailData]   = useState<Record<string, Record<string, AnswerDetail>>>({})
  const [loadingDetail,setLoadingDetail]= useState<string | null>(null)
  const [gradeInputs,  setGradeInputs]  = useState<Record<string, Record<string, string>>>({})
  const [savingGrade,  setSavingGrade]  = useState<string | null>(null)
  const [gradeSaved,   setGradeSaved]   = useState<string | null>(null)

  useEffect(() => {
    if (!studentId) return
    setLoading(true)
    Promise.all([
      fetch('/api/auth/students', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch(`/api/test/submissions/${studentId}`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch(`/api/teach/attend/${studentId}`,     { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
    ]).then(([s, e, a]) => {
      if (s.success) {
        const found = s.students.find((x: StudentInfo) => x.id === studentId)
        setStudentInfo(found || null)
      }
      if (e.success) setSubmissions(e.submissions)
      if (a.success) setAttendances(a.attendances)
    }).finally(() => setLoading(false))
  }, [studentId, token])

  // Auto-expand submission from URL ?exam= param
  useEffect(() => {
    if (!autoExamId || submissions.length === 0) return
    const target = submissions.find(s => s.examId === autoExamId)
    if (target && expandedId !== target.id) {
      loadDetail(target)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoExamId, submissions])

  async function loadDetail(sub: Submission) {
    const isExpanded = expandedId === sub.id
    if (isExpanded) { setExpandedId(null); return }
    setExpandedId(sub.id)
    if (detailData[sub.id]) return
    setLoadingDetail(sub.id)
    try {
      const res = await fetch(`/api/test/submissions/detail/${studentId}/${sub.examId}`, {
        headers: { Authorization: `Bearer ${token}` }
      }).then(r => r.json())
      if (res.success) {
        setDetailData(prev => ({ ...prev, [sub.id]: res.submission.answers }))
      }
    } finally {
      setLoadingDetail(null)
    }
  }

  async function saveGrade(sub: Submission) {
    const inputs = gradeInputs[sub.id] || {}
    const scores: Record<string, number> = {}
    for (const [qid, val] of Object.entries(inputs)) {
      if (val !== '') scores[qid] = Number(val)
    }
    if (Object.keys(scores).length === 0) return
    setSavingGrade(sub.id)
    try {
      const res = await fetch(`/api/test/submissions/grade/${studentId}/${sub.examId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ scores }),
      }).then(r => r.json())
      if (res.success) {
        setSubmissions(prev => prev.map(s => s.id === sub.id
          ? { ...s, score: res.submission.score, status: res.submission.status }
          : s
        ))
        // Refresh detail
        setDetailData(prev => { const n = { ...prev }; delete n[sub.id]; return n })
        setGradeSaved(sub.id)
        setTimeout(() => setGradeSaved(null), 3000)
      }
    } finally {
      setSavingGrade(null)
    }
  }

  const totalExams   = submissions.length
  const totalClasses = attendances.length
  const avgScore     = totalExams ? Math.round(submissions.reduce((s, x) => s + (x.totalScore ? x.score / x.totalScore * 100 : 0), 0) / totalExams) : 0
  const bestScore    = totalExams ? Math.max(...submissions.map(x => x.totalScore ? Math.round(x.score / x.totalScore * 100) : 0)) : 0
  const pendingCount = submissions.filter(x => x.status === 'pending').length

  function pct(s: Submission) { return s.totalScore ? Math.round(s.score / s.totalScore * 100) : 0 }
  function scoreColor(p: number) { return p >= 90 ? 'text-emerald-600' : p >= 70 ? 'text-indigo-600' : p >= 60 ? 'text-amber-600' : 'text-red-500' }

  const TYPE_LABEL: Record<string, string> = { single: '单选', multiple: '多选', judge: '判断', code: '编程', essay: '简答' }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50/30">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-slate-100 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center gap-3">
          <button onClick={() => navigate('/dashboard')}
            className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-brand-600 flex items-center justify-center">
              <GraduationCap className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="font-bold text-slate-800 text-sm leading-none">
                {loading ? '加载中…' : studentInfo?.name || '未知学生'}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                {studentInfo ? `@${studentInfo.username} · 学生档案` : ''}
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Hero */}
        {studentInfo && (
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-brand-600 to-indigo-600 p-6 text-white shadow-lg">
            <div className="absolute -top-8 -right-8 w-48 h-48 rounded-full bg-white/10 blur-2xl pointer-events-none" />
            <div className="relative flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-2xl font-bold">
                {studentInfo.name?.charAt(0) || '同'}
              </div>
              <div>
                <h2 className="text-xl font-bold">{studentInfo.name}</h2>
                <p className="text-white/70 text-sm">@{studentInfo.username}</p>
              </div>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { icon: BookOpen,   label: '参加考试', value: totalExams,      color: 'text-indigo-600',  bg: 'bg-indigo-50' },
            { icon: TrendingUp, label: '平均分',   value: `${avgScore}%`,  color: 'text-brand-600',   bg: 'bg-brand-50' },
            { icon: Award,      label: '最高分',   value: `${bestScore}%`, color: 'text-emerald-600', bg: 'bg-emerald-50' },
            { icon: Clock,      label: '待批改',   value: pendingCount,    color: 'text-amber-600',   bg: 'bg-amber-50' },
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

        {/* Exam records */}
        <div className="card">
          <div className="flex items-center gap-2 mb-5">
            <BarChart2 className="w-5 h-5 text-indigo-500" />
            <h3 className="font-semibold text-slate-800">考试记录</h3>
            <span className="ml-auto text-xs text-slate-400">{totalExams} 次</span>
          </div>
          {loading ? (
            <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 rounded-xl bg-slate-100 animate-pulse" />)}</div>
          ) : submissions.length === 0 ? (
            <div className="text-center py-10">
              <BookOpen className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-slate-500">该学生暂未参加任何考试</p>
            </div>
          ) : (
            <div className="space-y-3">
              {submissions.map(sub => {
                const p        = pct(sub)
                const expanded = expandedId === sub.id
                const detail   = detailData[sub.id]
                return (
                  <div key={sub.id} className="rounded-xl border border-slate-100 overflow-hidden hover:border-slate-200 transition-colors">
                    <button className="w-full text-left px-4 py-3.5 flex items-center gap-3"
                      onClick={() => loadDetail(sub)}>
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
                        {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </div>
                    </button>

                    {/* Score bar */}
                    <div className="px-4 pb-3 -mt-1">
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-700 ${p >= 90 ? 'bg-emerald-500' : p >= 70 ? 'bg-indigo-500' : p >= 60 ? 'bg-amber-500' : 'bg-red-500'}`}
                          style={{ width: `${p}%` }} />
                      </div>
                    </div>

                    {/* Expanded detail */}
                    {expanded && (
                      <div className="border-t border-slate-100 bg-slate-50/50 px-4 py-4 space-y-4">
                        {loadingDetail === sub.id ? (
                          <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-10 bg-slate-200 rounded-lg animate-pulse" />)}</div>
                        ) : detail ? (
                          <>
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">逐题详情 & 评分</p>
                            {Object.entries(detail).map(([qid, d]) => {
                              const isSubjective = d.questionType === 'code' || d.questionType === 'essay'
                              const needsGrading = isSubjective && d.score === null
                              const currentInput = gradeInputs[sub.id]?.[qid] ?? ''
                              return (
                                <div key={qid} className={`rounded-xl border p-3 ${needsGrading ? 'border-amber-200 bg-amber-50/50' : d.score === d.maxScore ? 'border-emerald-200 bg-emerald-50/40' : d.score !== null && d.score < d.maxScore ? 'border-red-200 bg-red-50/40' : 'border-slate-200 bg-white'}`}>
                                  <div className="flex items-start gap-2 mb-2">
                                    <span className="shrink-0 text-xs font-bold px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600">
                                      {TYPE_LABEL[d.questionType || ''] || d.questionType}
                                    </span>
                                    <p className="text-sm text-slate-800 font-medium flex-1">{d.questionText}</p>
                                    <span className={`text-xs font-bold shrink-0 ${needsGrading ? 'text-amber-600' : d.score === d.maxScore ? 'text-emerald-600' : 'text-red-500'}`}>
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
                                    <div>
                                      <span className="text-slate-500">学生答案：</span>
                                      {isSubjective ? (
                                        <pre className="text-xs bg-white rounded-lg p-2 border border-slate-200 text-slate-700 whitespace-pre-wrap font-mono mt-1 overflow-x-auto">{String(d.answer || '（未作答）')}</pre>
                                      ) : (
                                        <span className="font-mono text-slate-700">
                                          {Array.isArray(d.answer)
                                            ? d.answer.map(a => String.fromCharCode(64 + Number(a))).join('、')
                                            : d.questionType === 'judge'
                                              ? (d.answer === 'true' ? '✓ 正确' : '✗ 错误')
                                              : d.questionType === 'single' && d.answer
                                                ? String.fromCharCode(64 + Number(d.answer))
                                                : String(d.answer || '（未作答）')}
                                        </span>
                                      )}
                                    </div>
                                    {!isSubjective && d.correctAnswer !== undefined && (
                                      <span className="text-emerald-700">
                                        正确答案：<span className="font-mono">
                                          {Array.isArray(d.correctAnswer)
                                            ? d.correctAnswer.map(a => String.fromCharCode(64 + Number(a))).join('、')
                                            : d.questionType === 'judge'
                                              ? (d.correctAnswer === 'true' ? '✓ 正确' : '✗ 错误')
                                              : d.questionType === 'single' && d.correctAnswer
                                                ? String.fromCharCode(64 + Number(d.correctAnswer))
                                                : String(d.correctAnswer)}
                                        </span>
                                      </span>
                                    )}
                                    {isSubjective && d.correctAnswer && (
                                      <div className="mt-1">
                                        <span className="text-emerald-700">参考答案：</span>
                                        <pre className="text-xs bg-white rounded-lg p-2 border border-emerald-200 text-slate-700 whitespace-pre-wrap font-mono mt-1 overflow-x-auto">{Array.isArray(d.correctAnswer) ? d.correctAnswer.join('\n') : d.correctAnswer}</pre>
                                      </div>
                                    )}
                                  </div>

                                  {/* Grade input for subjective */}
                                  {isSubjective && (
                                    <div className="mt-2 flex items-center gap-2">
                                      <label className="text-xs text-slate-600 shrink-0">评分（满分 {d.maxScore}）：</label>
                                      <input
                                        type="number" min={0} max={d.maxScore} step={0.5}
                                        className="w-20 px-2 py-1 text-sm border rounded-lg border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-300"
                                        placeholder={d.score !== null ? String(d.score) : '0'}
                                        value={currentInput}
                                        onChange={e => setGradeInputs(prev => ({
                                          ...prev,
                                          [sub.id]: { ...(prev[sub.id] || {}), [qid]: e.target.value }
                                        }))}
                                      />
                                    </div>
                                  )}
                                </div>
                              )
                            })}

                            {/* Save grades button */}
                            {sub.status === 'pending' && (
                              <div className="flex items-center gap-3 pt-1">
                                <button
                                  onClick={() => saveGrade(sub)}
                                  disabled={savingGrade === sub.id}
                                  className="btn-primary gap-2">
                                  {savingGrade === sub.id
                                    ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />保存中…</>
                                    : <><Save className="w-4 h-4" />保存评分</>}
                                </button>
                                {gradeSaved === sub.id && (
                                  <span className="text-xs text-emerald-600 flex items-center gap-1 animate-fade-up">
                                    <CheckCircle2 className="w-3.5 h-3.5" />评分已保存
                                  </span>
                                )}
                              </div>
                            )}
                          </>
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

        {/* Attendance records */}
        <div className="card">
          <div className="flex items-center gap-2 mb-5">
            <Monitor className="w-5 h-5 text-purple-500" />
            <h3 className="font-semibold text-slate-800">上课记录</h3>
            <span className="ml-auto text-xs text-slate-400">{totalClasses} 次</span>
          </div>
          {loading ? (
            <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-12 rounded-xl bg-slate-100 animate-pulse" />)}</div>
          ) : attendances.length === 0 ? (
            <div className="text-center py-8">
              <Monitor className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-500">该学生暂无上课记录</p>
            </div>
          ) : (
            <div className="space-y-2">
              {attendances.map((att, idx) => (
                <div key={att.id} className="flex items-center gap-3 px-4 py-3 rounded-xl border border-slate-100">
                  <div className="w-9 h-9 rounded-xl bg-purple-50 flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-purple-600">#{idx + 1}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800">房间 <span className="font-mono text-purple-600">{att.roomCode}</span></p>
                    <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
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
      </main>
    </div>
  )
}
