import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { getTestSocket, disconnectTest } from '../lib/socket'
import {
  ClipboardList, Users, Play, Square, Megaphone,
  Wifi, WifiOff, LogOut, Hash, Plus, Trash2, ChevronDown, ChevronUp,
  BookOpen, CheckSquare, BarChart2, Clock, RefreshCw, Upload, Eye,
  FileJson, AlertCircle, CheckCircle2, Pencil, Save
} from 'lucide-react'
import RoomQR from '../components/RoomQR'

type QuestionType = 'single' | 'multiple' | 'judge' | 'code' | 'essay'
interface Question { id: string; type: QuestionType; questionText: string; options: string[]; answer: unknown; score: number }
interface Exam { id: string; title: string; duration: number; totalScore: number; questionIds: string[]; createdAt: string }

interface AnswerDetail {
  answer: unknown
  score: number | null
  maxScore: number
  questionText?: string
  questionType?: string
  options?: string[]
  correctAnswer?: unknown
}
interface Submission {
  id: string; userId: string; username: string; examTitle: string; examId: string
  score: number; totalScore: number; status: string; submittedAt: string
  answers?: Record<string, AnswerDetail>
}

const TYPE_LABELS: Record<QuestionType, string> = {
  single: '单选', multiple: '多选', judge: '判断', code: '编程', essay: '简答'
}

const JSON_EXAMPLE = `[
  {
    "type": "single",
    "questionText": "以下哪种协议最常用于IoT？",
    "options": ["HTTP", "MQTT", "FTP", "SMTP"],
    "answer": "2",
    "score": 5
  },
  {
    "type": "judge",
    "questionText": "HTTPS默认使用443端口",
    "options": [],
    "answer": "true",
    "score": 5
  },
  {
    "type": "multiple",
    "questionText": "以下属于OWASP Top 10的有？",
    "options": ["SQL注入", "XSS", "弱口令", "CSS样式"],
    "answer": ["1","2","3"],
    "score": 10
  },
  {
    "type": "essay",
    "questionText": "简述对称加密与非对称加密的区别",
    "options": [],
    "answer": "参考答案：对称加密使用同一密钥...",
    "score": 15
  }
]`

export default function TestTeacher() {
  const { code }   = useParams<{ code: string }>()
  const { user, token }   = useAuth()
  const navigate   = useNavigate()

  // Socket state
  const [connected,    setConnected]    = useState(false)
  const [viewerCount,  setViewerCount]  = useState(0)
  const [examStarted,  setExamStarted]  = useState(false)
  const [announcement, setAnnouncement] = useState('')
  const [announceSent, setAnnounceSent] = useState(false)

  // Data
  const [questions,   setQuestions]   = useState<Question[]>([])
  const [exams,       setExams]       = useState<Exam[]>([])
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [activeExamId,setActiveExamId]= useState<string>('')
  const [activeTab,   setActiveTab]   = useState<'control' | 'questions' | 'exams' | 'results'>('control')

  // Create exam form
  const [newExamTitle,    setNewExamTitle]    = useState('')
  const [newExamDuration, setNewExamDuration] = useState(30)
  const [selectedQIds,    setSelectedQIds]    = useState<Set<string>>(new Set())
  const [showCreateExam,  setShowCreateExam]  = useState(false)

  // JSON import
  const [importJson,      setImportJson]      = useState('')
  const [importError,     setImportError]     = useState('')
  const [importSuccess,   setImportSuccess]   = useState('')
  const [showImport,      setShowImport]      = useState(false)
  const [showExample,     setShowExample]     = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Grading
  const [expandedSub,  setExpandedSub]  = useState<string | null>(null)
  const [subDetail,    setSubDetail]    = useState<Record<string, Submission>>({})
  const [gradeScores,  setGradeScores]  = useState<Record<string, Record<string, string>>>({})
  const [saving,       setSaving]       = useState<string | null>(null)

  const socket = getTestSocket()

  const fetchData = useCallback(async () => {
    const headers = { Authorization: `Bearer ${token}` }
    const [qRes, eRes, sRes] = await Promise.all([
      fetch('/api/test/questions', { headers }).then(r => r.json()),
      fetch('/api/test/exams',     { headers }).then(r => r.json()),
      fetch('/api/test/submissions', { headers }).then(r => r.json()),
    ])
    if (qRes.success) setQuestions(qRes.questions)
    if (eRes.success) setExams(eRes.exams)
    if (sRes.success) setSubmissions(sRes.submissions)
  }, [token])

  useEffect(() => {
    fetchData()
    socket.on('connect', () => { setConnected(true); socket.emit('join-room', { code, role: 'teacher' }) })
    socket.on('disconnect',   () => setConnected(false))
    socket.on('room-status',   ({ viewerCount: vc }: { viewerCount: number }) => setViewerCount(vc))
    socket.on('current-state', ({ viewerCount: vc, examStarted: es, examId: eid }: { viewerCount: number; examStarted: boolean; examId?: string }) => {
      setViewerCount(vc); setExamStarted(es); if (eid) setActiveExamId(eid)
    })
    if (socket.connected) socket.emit('join-room', { code, role: 'teacher' })
    return () => {
      socket.off('connect'); socket.off('disconnect'); socket.off('room-status'); socket.off('current-state')
      disconnectTest()
    }
  }, []) // eslint-disable-line

  function startExam() {
    const exam = exams.find(e => e.id === activeExamId)
    if (!exam) return
    setExamStarted(true)
    socket.emit('exam-start', { code, title: exam.title, examId: exam.id })
  }
  function endExam() { setExamStarted(false); socket.emit('exam-end', { code }) }
  function sendAnnouncement() {
    if (!announcement.trim()) return
    socket.emit('announce', { code, message: announcement.trim() })
    setAnnounceSent(true); setAnnouncement('')
    setTimeout(() => setAnnounceSent(false), 3000)
  }

  async function createExam() {
    if (!newExamTitle.trim() || selectedQIds.size === 0) return
    const res = await fetch('/api/test/exams', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ title: newExamTitle.trim(), duration: newExamDuration, questionIds: [...selectedQIds] }),
    }).then(r => r.json())
    if (res.success) {
      setExams(prev => [...prev, res.exam])
      setShowCreateExam(false); setNewExamTitle(''); setSelectedQIds(new Set()); setNewExamDuration(30)
      setActiveExamId(res.exam.id); setActiveTab('control')
    }
  }

  async function deleteExam(id: string) {
    await fetch(`/api/test/exams/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
    setExams(prev => prev.filter(e => e.id !== id))
    if (activeExamId === id) setActiveExamId('')
  }

  async function deleteQuestion(id: string) {
    await fetch(`/api/test/questions/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
    setQuestions(prev => prev.filter(q => q.id !== id))
  }

  // ── JSON import ────────────────────────────────────────────────────
  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => { setImportJson((ev.target?.result as string) || '') }
    reader.readAsText(file)
    e.target.value = ''
  }

  async function doImport() {
    setImportError(''); setImportSuccess('')
    let parsed: unknown
    try { parsed = JSON.parse(importJson) } catch { setImportError('JSON 格式错误，请检查语法'); return }
    if (!Array.isArray(parsed)) { setImportError('JSON 应为数组 [...]'); return }
    const res = await fetch('/api/test/questions/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(parsed),
    }).then(r => r.json())
    if (res.success) {
      setImportSuccess(`成功导入 ${res.imported} 道题目${res.errors?.length ? `，${res.errors.length} 条错误` : ''}`)
      setImportJson(''); setShowImport(false)
      await fetchData()
    } else {
      setImportError(res.error || '导入失败')
    }
  }

  // ── Grading ────────────────────────────────────────────────────────
  async function loadSubDetail(sub: Submission) {
    const key = `${sub.userId}_${sub.examId}`
    if (subDetail[key]) return
    const res = await fetch(`/api/test/submissions/detail/${sub.userId}/${sub.examId}`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then(r => r.json())
    if (res.success) {
      setSubDetail(prev => ({ ...prev, [key]: res.submission }))
      // pre-fill grade inputs for pending subjective answers
      const init: Record<string, string> = {}
      for (const [qid, d] of Object.entries(res.submission.answers as Record<string, AnswerDetail>)) {
        if (d.score === null) init[qid] = ''
        else init[qid] = String(d.score)
      }
      setGradeScores(prev => ({ ...prev, [key]: init }))
    }
  }

  async function saveGrades(sub: Submission) {
    const key = `${sub.userId}_${sub.examId}`
    setSaving(key)
    const scores: Record<string, number> = {}
    for (const [qid, val] of Object.entries(gradeScores[key] || {})) {
      if (val !== '') scores[qid] = Number(val)
    }
    const res = await fetch(`/api/test/submissions/grade/${sub.userId}/${sub.examId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ scores }),
    }).then(r => r.json())
    if (res.success) {
      setSubmissions(prev => prev.map(s =>
        s.userId === sub.userId && s.examId === sub.examId
          ? { ...s, score: res.submission.score, status: res.submission.status }
          : s
      ))
      setSubDetail(prev => {
        const updated = { ...prev[key] }
        if (updated.answers) {
          for (const [qid, pts] of Object.entries(scores)) {
            if (updated.answers[qid]) updated.answers[qid] = { ...updated.answers[qid], score: pts }
          }
          updated.score = res.submission.score; updated.status = res.submission.status
        }
        return { ...prev, [key]: updated }
      })
    }
    setSaving(null)
  }

  const tabs = [
    { id: 'control',   label: '控制台',             icon: ClipboardList },
    { id: 'questions', label: `题库 (${questions.length})`, icon: BookOpen },
    { id: 'exams',     label: `考试 (${exams.length})`,     icon: CheckSquare },
    { id: 'results',   label: `成绩 (${submissions.length})`, icon: BarChart2 },
  ] as const

  const activeExam = exams.find(e => e.id === activeExamId)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50/40">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-slate-100 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center">
              <ClipboardList className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="font-bold text-slate-800 text-sm leading-none">考试系统控制台</p>
              <p className="text-xs text-slate-500 mt-0.5">{user?.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {connected
              ? <span className="badge-green"><Wifi className="w-3 h-3" /> 已连接</span>
              : <span className="badge-red"><WifiOff className="w-3 h-3" /> 已断开</span>}
            <button onClick={() => navigate('/dashboard')} className="btn-ghost px-2.5 py-2 text-slate-500">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="sticky top-14 z-30 bg-white/90 backdrop-blur border-b border-slate-100">
        <div className="max-w-5xl mx-auto px-4">
          <div className="flex gap-1 py-2">
            {tabs.map(t => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${activeTab === t.id ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'}`}
              >
                <t.icon className="w-3.5 h-3.5" />
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 py-6">

        {/* ── Control tab ── */}
        {activeTab === 'control' && (
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="space-y-5">
              <div className="card">
                <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Hash className="w-3.5 h-3.5" /> 房间码
                </p>
                <div className="flex gap-1.5 mb-4">
                  {(code || '').split('').map((ch, i) => (
                    <span key={i} className="w-9 h-10 flex items-center justify-center rounded-lg bg-indigo-50 border-2 border-indigo-200 font-mono text-lg font-bold text-indigo-700">{ch}</span>
                  ))}
                </div>
                <RoomQR code={code!} type="test" size={140} />
              </div>
              <div className="card">
                <div className="flex items-center gap-2 mb-1">
                  <Users className="w-4 h-4 text-indigo-500" />
                  <p className="text-sm font-semibold text-slate-700">在线考生</p>
                </div>
                <p className="text-3xl font-bold text-indigo-600 font-mono">{viewerCount}</p>
                <p className="text-xs text-slate-400 mt-1">实时连接人数</p>
              </div>
            </div>

            <div className="lg:col-span-2 space-y-5">
              <div className="card">
                <h2 className="font-semibold text-slate-800 mb-4">选择考试</h2>
                {exams.length === 0 ? (
                  <div className="text-center py-6 border-2 border-dashed border-slate-200 rounded-xl">
                    <p className="text-slate-400 text-sm mb-3">尚无考试，请先创建</p>
                    <button onClick={() => { setActiveTab('exams'); setShowCreateExam(true) }} className="btn-primary">
                      <Plus className="w-4 h-4" /> 创建考试
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2 mb-4">
                    {exams.map(e => (
                      <label key={e.id} className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all duration-150 ${activeExamId === e.id ? 'border-indigo-400 bg-indigo-50' : 'border-slate-100 hover:border-slate-200'}`}>
                        <input type="radio" name="activeExam" value={e.id} checked={activeExamId === e.id}
                          onChange={() => setActiveExamId(e.id)} className="sr-only" />
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${activeExamId === e.id ? 'border-indigo-500 bg-indigo-500' : 'border-slate-300'}`}>
                          {activeExamId === e.id && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-slate-800 text-sm truncate">{e.title}</p>
                          <p className="text-xs text-slate-400">{e.questionIds.length} 题 · {e.totalScore} 分 · {e.duration} 分钟</p>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-3 flex-wrap">
                  <span className={`badge text-sm ${examStarted ? 'badge-green' : 'badge-slate'}`}>
                    {examStarted ? '考试进行中' : '等待开始'}
                  </span>
                  {!examStarted ? (
                    <button onClick={startExam} disabled={!activeExamId} className="btn-primary gap-2 disabled:opacity-50">
                      <Play className="w-4 h-4" /> 开始考试
                    </button>
                  ) : (
                    <button onClick={endExam} className="btn-danger gap-2">
                      <Square className="w-4 h-4" /> 结束考试
                    </button>
                  )}
                  {activeExam && examStarted && (
                    <span className="text-sm text-slate-600 font-medium">当前：{activeExam.title}</span>
                  )}
                </div>
              </div>

              <div className="card">
                <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                  <Megaphone className="w-4 h-4 text-amber-500" /> 广播通知
                </h3>
                <div className="flex gap-2">
                  <input type="text" className="input flex-1" placeholder="输入通知内容…"
                    value={announcement} onChange={e => setAnnouncement(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && sendAnnouncement()} />
                  <button onClick={sendAnnouncement} disabled={!announcement.trim()}
                    className={`btn px-4 transition-all ${announceSent ? 'bg-emerald-500 text-white border-emerald-500' : 'btn-secondary'}`}>
                    {announceSent ? '✓ 已发送' : '发送'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Questions tab ── */}
        {activeTab === 'questions' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h2 className="font-semibold text-slate-800">题目银行</h2>
              <div className="flex gap-2">
                <button onClick={() => setShowImport(v => !v)} className="btn-primary gap-2">
                  <FileJson className="w-4 h-4" />
                  {showImport ? '收起' : 'JSON 导入'}
                </button>
                <button onClick={fetchData} className="btn-ghost px-2 py-1.5 text-slate-500 text-sm gap-1.5">
                  <RefreshCw className="w-3.5 h-3.5" /> 刷新
                </button>
              </div>
            </div>

            {/* JSON import panel */}
            {showImport && (
              <div className="card border-indigo-100 bg-indigo-50/20 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                    <Upload className="w-4 h-4 text-indigo-600" /> 批量导入题目 (JSON)
                  </h3>
                  <button
                    onClick={() => setShowExample(v => !v)}
                    className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    {showExample ? '隐藏示例' : '查看格式示例'}
                  </button>
                </div>

                {showExample && (
                  <div className="rounded-xl bg-slate-900 p-4 overflow-x-auto">
                    <pre className="text-xs text-emerald-400 font-mono whitespace-pre">{JSON_EXAMPLE}</pre>
                  </div>
                )}

                <div className="text-xs text-slate-500 bg-slate-50 rounded-xl p-3 space-y-1">
                  <p className="font-semibold text-slate-600 mb-1">字段说明：</p>
                  <p><code className="bg-white px-1 rounded">type</code>: single / multiple / judge / code / essay</p>
                  <p><code className="bg-white px-1 rounded">answer</code>: 单选/判断填字符串，多选填字符串数组 (如 ["1","2"])</p>
                  <p><code className="bg-white px-1 rounded">options</code>: 选择题填选项数组，判断/编程/简答填 []</p>
                  <p><code className="bg-white px-1 rounded">score</code>: 该题分值（数字）</p>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="btn-secondary gap-2 text-sm"
                  >
                    <Upload className="w-3.5 h-3.5" /> 上传 .json 文件
                  </button>
                  <input ref={fileInputRef} type="file" accept=".json,application/json" className="hidden" onChange={handleFileUpload} />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">或粘贴 JSON 内容</label>
                  <textarea
                    className="w-full h-40 p-3 rounded-xl border border-slate-200 font-mono text-xs text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-y"
                    placeholder='[{"type":"single","questionText":"...","options":[...],"answer":"1","score":5}]'
                    value={importJson}
                    onChange={e => { setImportJson(e.target.value); setImportError(''); setImportSuccess('') }}
                  />
                </div>

                {importError && (
                  <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-xl">
                    <AlertCircle className="w-4 h-4 shrink-0" /> {importError}
                  </div>
                )}
                {importSuccess && (
                  <div className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50 px-3 py-2 rounded-xl">
                    <CheckCircle2 className="w-4 h-4 shrink-0" /> {importSuccess}
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={doImport}
                    disabled={!importJson.trim()}
                    className="btn-primary disabled:opacity-50 gap-2"
                  >
                    <FileJson className="w-4 h-4" /> 确认导入
                  </button>
                  <button onClick={() => { setShowImport(false); setImportJson(''); setImportError(''); setImportSuccess('') }} className="btn-secondary">取消</button>
                </div>
              </div>
            )}

            {questions.length === 0 ? (
              <div className="card text-center py-12 border-dashed">
                <BookOpen className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500 mb-2">暂无题目</p>
                <p className="text-xs text-slate-400">点击「JSON 导入」批量添加题目</p>
              </div>
            ) : (
              questions.map((q, idx) => (
                <div key={q.id} className="card">
                  <div className="flex items-start gap-3">
                    <span className="text-sm font-mono text-slate-400 mt-0.5 shrink-0">{idx + 1}.</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700">{TYPE_LABELS[q.type]}</span>
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">{q.score} 分</span>
                      </div>
                      <p className="text-sm text-slate-800 mb-2">{q.questionText}</p>
                      {q.options.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-1">
                          {q.options.map((opt, i) => (
                            <span key={i} className="text-xs px-2 py-1 bg-slate-50 border border-slate-100 rounded-lg text-slate-600">
                              {String.fromCharCode(65+i)}. {opt}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <button onClick={() => deleteQuestion(q.id)} className="text-red-400 hover:text-red-600 transition-colors p-1 shrink-0">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ── Exams tab ── */}
        {activeTab === 'exams' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-slate-800">考试管理</h2>
              <button onClick={() => setShowCreateExam(v => !v)} className="btn-primary gap-2">
                {showCreateExam ? <ChevronUp className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                {showCreateExam ? '收起' : '创建考试'}
              </button>
            </div>

            {showCreateExam && (
              <div className="card border-indigo-100 bg-indigo-50/30 space-y-4">
                <h3 className="font-semibold text-slate-800">新建考试</h3>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">考试标题</label>
                    <input type="text" className="input" placeholder="输入考试名称" value={newExamTitle}
                      onChange={e => setNewExamTitle(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">时长（分钟）</label>
                    <input type="number" className="input" min={5} max={300} value={newExamDuration}
                      onChange={e => setNewExamDuration(Number(e.target.value))} />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    选择题目 <span className="text-slate-400 font-normal">({selectedQIds.size} 已选，共 {questions.reduce((s, q) => selectedQIds.has(q.id) ? s + q.score : s, 0)} 分)</span>
                  </label>
                  {questions.length === 0 ? (
                    <p className="text-sm text-amber-600 bg-amber-50 px-3 py-2 rounded-xl">题库为空，请先到「题库」标签导入题目</p>
                  ) : (
                    <div className="max-h-64 overflow-y-auto space-y-1.5 border border-slate-200 rounded-xl p-3 bg-white">
                      {questions.map(q => (
                        <label key={q.id} className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-colors ${selectedQIds.has(q.id) ? 'bg-indigo-50' : 'hover:bg-slate-50'}`}>
                          <input type="checkbox" checked={selectedQIds.has(q.id)}
                            onChange={e => { setSelectedQIds(prev => { const n = new Set(prev); e.target.checked ? n.add(q.id) : n.delete(q.id); return n }) }}
                            className="w-4 h-4 text-indigo-600 rounded" />
                          <span className="text-xs px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 font-semibold shrink-0">{TYPE_LABELS[q.type]}</span>
                          <span className="text-sm text-slate-700 flex-1 truncate">{q.questionText}</span>
                          <span className="text-xs text-slate-400 shrink-0">{q.score}分</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <button onClick={createExam} disabled={!newExamTitle.trim() || selectedQIds.size === 0} className="btn-primary disabled:opacity-50">创建考试</button>
                  <button onClick={() => setShowCreateExam(false)} className="btn-secondary">取消</button>
                </div>
              </div>
            )}

            {exams.length === 0 && !showCreateExam ? (
              <div className="card text-center py-12 border-dashed">
                <CheckSquare className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500">暂无考试</p>
              </div>
            ) : (
              exams.map(e => (
                <div key={e.id} className="card">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="font-semibold text-slate-800">{e.title}</h4>
                      <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                        <span className="text-xs text-slate-500 flex items-center gap-1"><Clock className="w-3 h-3" />{e.duration} 分钟</span>
                        <span className="text-xs text-slate-500 flex items-center gap-1"><BookOpen className="w-3 h-3" />{e.questionIds.length} 道题</span>
                        <span className="text-xs text-slate-500 flex items-center gap-1"><BarChart2 className="w-3 h-3" />{e.totalScore} 总分</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button onClick={() => { setActiveExamId(e.id); setActiveTab('control') }} className="text-xs btn-ghost px-2 py-1 text-indigo-600">使用</button>
                      <button onClick={() => deleteExam(e.id)} className="text-red-400 hover:text-red-600 transition-colors p-1">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ── Results tab ── */}
        {activeTab === 'results' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-slate-800">成绩总览</h2>
              <button onClick={fetchData} className="btn-ghost px-2 py-1.5 text-slate-500 text-sm gap-1.5">
                <RefreshCw className="w-3.5 h-3.5" /> 刷新
              </button>
            </div>
            {submissions.length === 0 ? (
              <div className="card text-center py-12 border-dashed">
                <BarChart2 className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500">暂无提交记录</p>
              </div>
            ) : (
              <div className="space-y-3">
                {submissions.map((s) => {
                  const key = `${s.userId}_${s.examId}`
                  const pct = s.totalScore ? Math.round(s.score / s.totalScore * 100) : 0
                  const isExpanded = expandedSub === key
                  const detail = subDetail[key]
                  const gScores = gradeScores[key] || {}

                  return (
                    <div key={s.id} className="card overflow-hidden">
                      {/* Row header */}
                      <button
                        className="w-full flex items-center gap-3 text-left"
                        onClick={async () => {
                          if (!isExpanded) { await loadSubDetail(s) }
                          setExpandedSub(isExpanded ? null : key)
                        }}
                      >
                        <div className="flex-1 grid grid-cols-[1fr_1fr_auto_auto_auto] items-center gap-3">
                          <span className="font-medium text-slate-800 text-sm truncate">{s.username}</span>
                          <span className="text-slate-500 text-sm truncate">{s.examTitle}</span>
                          <span className={`font-bold font-mono text-sm ${pct >= 90 ? 'text-emerald-600' : pct >= 70 ? 'text-indigo-600' : pct >= 60 ? 'text-amber-600' : 'text-red-500'}`}>
                            {s.score}<span className="text-slate-400 font-normal text-xs">/{s.totalScore}</span>
                          </span>
                          {s.status === 'pending'
                            ? <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full whitespace-nowrap">待批改</span>
                            : <span className="text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full whitespace-nowrap">已完成</span>
                          }
                          <span className="text-xs text-slate-400 whitespace-nowrap">
                            {new Date(s.submittedAt).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <div className="text-slate-400 shrink-0 ml-2">
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </div>
                      </button>

                      {/* Expanded detail + grading */}
                      {isExpanded && (
                        <div className="mt-4 border-t border-slate-100 pt-4 space-y-4">
                          {!detail ? (
                            <div className="text-center py-4 text-slate-400 text-sm">加载中…</div>
                          ) : (
                            <>
                              {Object.entries(detail.answers || {}).map(([qid, d]) => {
                                const isSubjective = d.questionType === 'code' || d.questionType === 'essay'
                                const isNeedGrade = d.score === null
                                const displayAnswer = Array.isArray(d.answer)
                                  ? (d.answer as string[]).join('、')
                                  : String(d.answer ?? '（未作答）')
                                const correct = Array.isArray(d.correctAnswer)
                                  ? (d.correctAnswer as string[]).join('、')
                                  : String(d.correctAnswer ?? '')

                                return (
                                  <div key={qid} className={`p-4 rounded-xl border ${isNeedGrade ? 'border-amber-200 bg-amber-50/40' : 'border-slate-100 bg-slate-50/30'}`}>
                                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                                        {TYPE_LABELS[(d.questionType as QuestionType) || 'essay']}
                                      </span>
                                      <span className="text-xs text-slate-400">题号 #{qid}</span>
                                      {isNeedGrade && <span className="text-xs text-amber-600 font-semibold ml-auto">待评分 (满分 {d.maxScore})</span>}
                                      {!isNeedGrade && (
                                        <span className={`text-xs font-semibold ml-auto ${d.score === d.maxScore ? 'text-emerald-600' : d.score! > 0 ? 'text-amber-600' : 'text-red-500'}`}>
                                          {d.score} / {d.maxScore} 分
                                        </span>
                                      )}
                                    </div>

                                    <p className="text-sm font-medium text-slate-800 mb-3">{d.questionText}</p>

                                    {/* Options for choice questions */}
                                    {d.options && d.options.length > 0 && (
                                      <div className="flex flex-wrap gap-2 mb-3">
                                        {d.options.map((opt: string, i: number) => (
                                          <span key={i} className="text-xs px-2 py-1 bg-white border border-slate-200 rounded-lg text-slate-600">
                                            {String.fromCharCode(65+i)}. {opt}
                                          </span>
                                        ))}
                                      </div>
                                    )}

                                    <div className="grid sm:grid-cols-2 gap-3">
                                      <div>
                                        <p className="text-xs font-semibold text-slate-500 mb-1">学生答案</p>
                                        {isSubjective ? (
                                          <pre className="text-xs text-slate-700 bg-white border border-slate-200 rounded-lg p-2.5 whitespace-pre-wrap font-mono max-h-40 overflow-y-auto">{displayAnswer}</pre>
                                        ) : (
                                          <p className="text-sm text-slate-700 bg-white border border-slate-200 rounded-lg px-3 py-2">{displayAnswer}</p>
                                        )}
                                      </div>
                                      {!isSubjective && (
                                        <div>
                                          <p className="text-xs font-semibold text-slate-500 mb-1">参考答案</p>
                                          <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">{correct}</p>
                                        </div>
                                      )}
                                      {isSubjective && (
                                        <div>
                                          <p className="text-xs font-semibold text-slate-500 mb-1">参考答案 / 评分要点</p>
                                          <pre className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg p-2.5 whitespace-pre-wrap max-h-40 overflow-y-auto">{correct}</pre>
                                        </div>
                                      )}
                                    </div>

                                    {/* Grade input for subjective */}
                                    {isSubjective && (
                                      <div className="mt-3 flex items-center gap-3">
                                        <Pencil className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                        <label className="text-xs font-semibold text-slate-600">给分：</label>
                                        <input
                                          type="number" min={0} max={d.maxScore}
                                          className="w-20 px-2 py-1.5 rounded-lg border border-slate-200 text-sm font-mono text-center focus:outline-none focus:ring-2 focus:ring-indigo-300"
                                          placeholder={`0-${d.maxScore}`}
                                          value={gScores[qid] ?? ''}
                                          onChange={e => setGradeScores(prev => ({ ...prev, [key]: { ...prev[key], [qid]: e.target.value } }))}
                                        />
                                        <span className="text-xs text-slate-400">满分 {d.maxScore}</span>
                                      </div>
                                    )}
                                  </div>
                                )
                              })}

                              {/* Save button if any subjective pending */}
                              {Object.values(detail.answers || {}).some(d => d.questionType === 'code' || d.questionType === 'essay') && (
                                <div className="flex justify-end pt-2">
                                  <button
                                    onClick={() => saveGrades(s)}
                                    disabled={saving === key}
                                    className="btn-primary gap-2"
                                  >
                                    {saving === key
                                      ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> 保存中…</>
                                      : <><Save className="w-4 h-4" /> 保存评分</>
                                    }
                                  </button>
                                </div>
                              )}
                            </>
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
      </main>
    </div>
  )
}
