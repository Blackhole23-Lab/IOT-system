import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { getTestSocket, disconnectTest } from '../lib/socket'
import {
  ClipboardList, Wifi, WifiOff, AlertTriangle, CheckCircle2,
  Users, Clock, Send, ChevronRight
} from 'lucide-react'

type QuestionType = 'single' | 'multiple' | 'judge' | 'code' | 'essay'
interface Question { id: string; type: QuestionType; questionText: string; options: string[]; score: number }
type Answers = Record<string, string | string[]>

const TYPE_LABELS: Record<QuestionType, string> = {
  single: '单选题', multiple: '多选题', judge: '判断题', code: '编程题', essay: '简答题'
}

export default function TestStudent() {
  const { code }   = useParams<{ code: string }>()
  const { user, token } = useAuth()
  const navigate   = useNavigate()

  const [connected,    setConnected]    = useState(false)
  const [examStarted,  setExamStarted]  = useState(false)
  const [examEnded,    setExamEnded]    = useState(false)
  const [examTitle,    setExamTitle]    = useState('')
  const [examId,       setExamId]       = useState<string | null>(null)
  const [viewerCount,  setViewerCount]  = useState(0)
  const [announcement, setAnnouncement] = useState<string | null>(null)
  const [teacherLeft,  setTeacherLeft]  = useState(false)

  // Exam questions & answers
  const [questions,  setQuestions]  = useState<Question[]>([])
  const [answers,    setAnswers]    = useState<Answers>({})
  const [submitted,  setSubmitted]  = useState(false)
  const [result,     setResult]     = useState<{ score: number; totalScore: number; status: string } | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [loadingQ,   setLoadingQ]   = useState(false)

  // Countdown timer (seconds)
  const [timeLeft,   setTimeLeft]   = useState(0)
  const timerRef    = useRef<ReturnType<typeof setInterval> | null>(null)
  const submittedRef = useRef(false)

  const socket = getTestSocket()

  // Start a countdown from `seconds`
  const startTimer = useCallback((seconds: number) => {
    if (timerRef.current) clearInterval(timerRef.current)
    setTimeLeft(seconds)
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!)
          timerRef.current = null
          if (!submittedRef.current) {
            submittedRef.current = true
            // auto-submit via ref to avoid stale closure
            doSubmit(true)
          }
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }, []) // eslint-disable-line

  const loadExam = useCallback(async (eid: string) => {
    setLoadingQ(true)
    try {
      const res = await fetch(`/api/test/exams/${eid}`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then(r => r.json())
      if (res.success) {
        setQuestions(res.exam.questions || [])
        const durationSecs = (res.exam.duration || 30) * 60
        startTimer(durationSecs)
      }
    } finally {
      setLoadingQ(false)
    }
  }, [token, startTimer])

  useEffect(() => {
    socket.on('connect', () => {
      setConnected(true)
      socket.emit('join-room', { code, role: 'student' })
    })
    socket.on('disconnect',   () => setConnected(false))
    socket.on('room-status',   ({ viewerCount: vc }: { viewerCount: number }) => setViewerCount(vc))
    socket.on('teacher-left',  () => setTeacherLeft(true))
    socket.on('current-state', ({ examStarted: es, examTitle: et, examId: eid, viewerCount: vc }: {
      examStarted: boolean; examTitle: string; examId?: string; viewerCount: number
    }) => {
      setViewerCount(vc)
      if (es && eid) {
        setExamStarted(true); setExamTitle(et || '考试'); setExamId(eid)
        loadExam(eid)
      }
    })
    socket.on('exam-started', ({ title, examId: eid }: { title: string; examId?: string }) => {
      setExamStarted(true); setExamTitle(title); setExamEnded(false)
      if (eid) { setExamId(eid); loadExam(eid) }
    })
    socket.on('exam-ended', () => {
      setExamEnded(true)
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    })
    socket.on('announcement', ({ message }: { message: string }) => {
      setAnnouncement(message)
      setTimeout(() => setAnnouncement(null), 6000)
    })

    if (socket.connected) socket.emit('join-room', { code, role: 'student' })

    return () => {
      socket.off('connect'); socket.off('disconnect'); socket.off('room-status')
      socket.off('teacher-left'); socket.off('current-state')
      socket.off('exam-started'); socket.off('exam-ended'); socket.off('announcement')
      if (timerRef.current) clearInterval(timerRef.current)
      disconnectTest()
    }
  }, []) // eslint-disable-line

  function setAnswer(qid: string, val: string | string[]) {
    setAnswers(prev => ({ ...prev, [qid]: val }))
  }

  function toggleMultiple(qid: string, opt: string) {
    setAnswers(prev => {
      const cur = (prev[qid] as string[] | undefined) || []
      const next = cur.includes(opt) ? cur.filter(v => v !== opt) : [...cur, opt]
      return { ...prev, [qid]: next }
    })
  }

  // Separate submit function usable from timer callback
  async function doSubmit(auto = false) {
    // Read examId/user from refs to avoid stale closures when called from timer
    const eid  = examIdRef.current
    const usr  = userRef.current
    const tkn  = tokenRef.current
    const ans  = answersRef.current
    if (!eid || !usr) return
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    setSubmitting(true)
    try {
      const res = await fetch('/api/test/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tkn}` },
        body: JSON.stringify({ userId: usr.id, username: usr.name, examId: eid, answers: ans }),
      }).then(r => r.json())
      if (res.success) {
        setSubmitted(true)
        setResult(res.submission)
      } else {
        if (!auto) alert(res.error || '提交失败，请重试')
      }
    } catch {
      if (!auto) alert('网络错误，请重试')
    } finally {
      setSubmitting(false)
    }
  }

  // Stable refs so timer callback can access latest values
  const examIdRef  = useRef(examId)
  const userRef    = useRef(user)
  const tokenRef   = useRef(token)
  const answersRef = useRef(answers)
  useEffect(() => { examIdRef.current  = examId  }, [examId])
  useEffect(() => { userRef.current    = user    }, [user])
  useEffect(() => { tokenRef.current   = token   }, [token])
  useEffect(() => { answersRef.current = answers }, [answers])

  async function handleSubmit(auto = false) {
    if (submitting || submitted || !examId || !user) return
    if (!auto) {
      if (!window.confirm('确定提交答卷吗？提交后不可修改！')) return
    }
    submittedRef.current = true
    await doSubmit(auto)
  }

  const mins = Math.floor(timeLeft / 60)
  const secs = timeLeft % 60
  const timerUrgent  = timeLeft > 0 && timeLeft <= 60
  const timerWarning = timeLeft > 0 && timeLeft <= 300

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50/30">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-slate-100 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center">
              <ClipboardList className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="font-bold text-slate-800 text-sm leading-none">{examTitle || '在线考试'}</p>
              <p className="text-xs text-slate-500 mt-0.5 font-mono">#{code}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Timer */}
            {examStarted && !submitted && timeLeft > 0 && (
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono text-sm font-bold transition-colors ${
                timerUrgent  ? 'bg-red-100 text-red-600 animate-pulse' :
                timerWarning ? 'bg-amber-100 text-amber-600' :
                'bg-indigo-50 text-indigo-600'
              }`}>
                <Clock className="w-3.5 h-3.5" />
                {String(mins).padStart(2,'0')}:{String(secs).padStart(2,'0')}
              </div>
            )}
            <div className="flex items-center gap-1 text-xs text-slate-500">
              <Users className="w-3.5 h-3.5" />
              <span className="font-mono">{viewerCount}</span>
            </div>
            {connected
              ? <span className="badge-green text-xs"><Wifi className="w-3 h-3" /> 已连接</span>
              : <span className="badge-red text-xs"><WifiOff className="w-3 h-3" /> 已断开</span>}
            <button onClick={() => navigate('/dashboard')} className="text-xs text-slate-400 hover:text-slate-600 transition-colors">
              退出
            </button>
          </div>
        </div>
      </header>

      {/* Announcements toast */}
      {announcement && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-5 py-3 rounded-2xl bg-amber-500 text-white text-sm font-semibold shadow-lg animate-fade-up max-w-sm text-center">
          📢 {announcement}
        </div>
      )}

      <main className="max-w-3xl mx-auto px-4 py-8">
        {teacherLeft && (
          <div className="card border-amber-200 bg-amber-50 mb-6 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
            <p className="text-sm text-amber-700 font-medium">老师已离开考场，请等待老师重新连接。</p>
          </div>
        )}

        {/* Submitted result */}
        {submitted && result ? (
          <div className="card text-center py-12">
            <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-slate-800 mb-2">提交成功！</h2>
            {result.status === 'pending' ? (
              <p className="text-slate-500 text-sm mb-2">含主观题，等待教师批改后公布成绩</p>
            ) : (
              <div className="mb-4">
                <p className="text-5xl font-bold text-indigo-600 font-mono my-4">
                  {result.score} <span className="text-2xl text-slate-400">/ {result.totalScore}</span>
                </p>
                <p className="text-slate-500 text-sm">
                  正确率 {result.totalScore ? Math.round(result.score / result.totalScore * 100) : 0}%
                </p>
              </div>
            )}
            <div className="flex gap-3 justify-center mt-6">
              <button onClick={() => navigate('/profile')} className="btn-primary gap-2">
                <ChevronRight className="w-4 h-4" /> 查看详细成绩
              </button>
              <button onClick={() => navigate('/dashboard')} className="btn-secondary">返回主页</button>
            </div>
          </div>
        ) : examEnded ? (
          <div className="card text-center py-12">
            <CheckCircle2 className="w-14 h-14 text-slate-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-slate-800 mb-2">考试已结束</h2>
            <p className="text-slate-500 text-sm mb-6">感谢参与，请等待老师公布成绩</p>
            <button onClick={() => navigate('/dashboard')} className="btn-primary mx-auto">返回主页</button>
          </div>
        ) : !examStarted ? (
          <div className="card text-center py-12">
            <div className="w-20 h-20 rounded-3xl bg-indigo-100 flex items-center justify-center mx-auto mb-6">
              <ClipboardList className="w-10 h-10 text-indigo-500 animate-pulse" />
            </div>
            <h2 className="text-xl font-semibold text-slate-800 mb-2">等待考试开始</h2>
            <p className="text-slate-500 text-sm">老师开启考试后将自动通知您</p>
            <div className="flex justify-center gap-2 mt-6">
              {[0,1,2].map(i => (
                <span key={i} className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" style={{ animationDelay: `${i*200}ms` }} />
              ))}
            </div>
          </div>
        ) : loadingQ ? (
          <div className="space-y-4">
            {[1,2,3].map(i => <div key={i} className="h-32 rounded-2xl bg-slate-100 animate-pulse" />)}
          </div>
        ) : (
          <div className="space-y-5">
            {/* Exam header */}
            <div className="card border-indigo-100 bg-indigo-50/50">
              <div className="flex items-center gap-2 mb-1">
                <span className="badge-blue">考试进行中</span>
                <span className="text-sm font-semibold text-slate-700">{examTitle}</span>
              </div>
              <p className="text-xs text-slate-500">共 {questions.length} 题，请认真作答，时间到自动提交</p>
            </div>

            {/* Questions */}
            {questions.map((q, idx) => (
              <div key={q.id} className="card">
                <div className="flex items-start gap-3 mb-3">
                  <span className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg bg-indigo-100 text-indigo-700 font-bold text-sm">{idx+1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700">{TYPE_LABELS[q.type]}</span>
                      <span className="text-xs text-slate-400">{q.score} 分</span>
                    </div>
                    <p className="text-sm font-medium text-slate-800 whitespace-pre-wrap">{q.questionText}</p>
                  </div>
                </div>

                {/* Single choice */}
                {q.type === 'single' && (
                  <div className="space-y-2 ml-10">
                    {q.options.map((opt, i) => {
                      const val = String(i + 1)
                      const checked = answers[q.id] === val
                      return (
                        <label key={i} className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all duration-150 ${checked ? 'border-indigo-400 bg-indigo-50' : 'border-slate-100 hover:border-slate-200'}`}>
                          <input type="radio" name={`q_${q.id}`} value={val} checked={checked}
                            onChange={() => setAnswer(q.id, val)} className="sr-only" />
                          <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${checked ? 'border-indigo-500 bg-indigo-500' : 'border-slate-300'}`}>
                            {checked && <span className="w-2 h-2 bg-white rounded-full" />}
                          </span>
                          <span className="text-sm text-slate-700">{String.fromCharCode(65+i)}. {opt}</span>
                        </label>
                      )
                    })}
                  </div>
                )}

                {/* Multiple choice */}
                {q.type === 'multiple' && (
                  <div className="space-y-2 ml-10">
                    <p className="text-xs text-slate-400 mb-1">可多选</p>
                    {q.options.map((opt, i) => {
                      const val = String(i + 1)
                      const cur = (answers[q.id] as string[] | undefined) || []
                      const checked = cur.includes(val)
                      return (
                        <label key={i} className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all duration-150 ${checked ? 'border-indigo-400 bg-indigo-50' : 'border-slate-100 hover:border-slate-200'}`}>
                          <input type="checkbox" value={val} checked={checked}
                            onChange={() => toggleMultiple(q.id, val)} className="sr-only" />
                          <span className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 ${checked ? 'border-indigo-500 bg-indigo-500' : 'border-slate-300'}`}>
                            {checked && <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 12 12"><path d="M10 3L5 8.5 2 5.5l-1 1L5 10.5 11 4z"/></svg>}
                          </span>
                          <span className="text-sm text-slate-700">{String.fromCharCode(65+i)}. {opt}</span>
                        </label>
                      )
                    })}
                  </div>
                )}

                {/* Judge */}
                {q.type === 'judge' && (
                  <div className="flex gap-3 ml-10">
                    {[{ label: '✓ 正确', value: 'true' }, { label: '✗ 错误', value: 'false' }].map(opt => {
                      const checked = answers[q.id] === opt.value
                      return (
                        <label key={opt.value} className={`flex items-center gap-2 px-5 py-2.5 rounded-xl border-2 cursor-pointer transition-all duration-150 font-medium ${checked ? 'border-indigo-400 bg-indigo-50 text-indigo-700' : 'border-slate-100 hover:border-slate-200 text-slate-600'}`}>
                          <input type="radio" name={`q_${q.id}`} value={opt.value} checked={checked}
                            onChange={() => setAnswer(q.id, opt.value)} className="sr-only" />
                          {opt.label}
                        </label>
                      )
                    })}
                  </div>
                )}

                {/* Code */}
                {q.type === 'code' && (
                  <div className="ml-10">
                    <textarea
                      className="w-full min-h-[200px] p-3 rounded-xl border border-slate-200 bg-slate-50 font-mono text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-transparent resize-y"
                      placeholder="请在此输入代码…"
                      value={(answers[q.id] as string) || ''}
                      onChange={e => setAnswer(q.id, e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Tab') {
                          e.preventDefault()
                          const el = e.currentTarget
                          const s = el.selectionStart; const en = el.selectionEnd
                          const v = el.value
                          el.value = v.substring(0, s) + '    ' + v.substring(en)
                          el.selectionStart = el.selectionEnd = s + 4
                          setAnswer(q.id, el.value)
                        }
                      }}
                    />
                  </div>
                )}

                {/* Essay */}
                {q.type === 'essay' && (
                  <div className="ml-10">
                    <textarea
                      className="w-full min-h-[120px] p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-transparent resize-y text-sm text-slate-800"
                      placeholder="请在此输入答案…"
                      value={(answers[q.id] as string) || ''}
                      onChange={e => setAnswer(q.id, e.target.value)}
                    />
                  </div>
                )}
              </div>
            ))}

            {/* Submit */}
            {questions.length > 0 && (
              <div className="card border-indigo-100 bg-indigo-50/30">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <p className="text-sm font-medium text-slate-700">已作答 {Object.keys(answers).length} / {questions.length} 题</p>
                    <p className="text-xs text-slate-500">请确认作答完毕后提交</p>
                  </div>
                  <button
                    onClick={() => handleSubmit(false)}
                    disabled={submitting}
                    className="btn-primary gap-2"
                  >
                    {submitting
                      ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> 提交中…</>
                      : <><Send className="w-4 h-4" /> 提交答卷</>
                    }
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
