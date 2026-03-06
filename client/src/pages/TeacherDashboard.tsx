import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import {
  GraduationCap, Monitor, ClipboardList, LogOut, Play, Users,
  BarChart2, Hash, ArrowRight, RefreshCw, BookOpen, ChevronRight,
  CheckCircle2, Clock, AlertCircle
} from 'lucide-react'
import RoomQR from '../components/RoomQR'

type System = 'teach' | 'test'
interface Student { id: string; username: string; name: string; createdAt: string }
interface Submission { id: string; userId: string; username: string; examId: string; examTitle: string; score: number; totalScore: number; status: string; submittedAt: string }
interface Attendance { id: string; userId: string; username: string; roomCode: string; date: string; joinedAt: string }

export default function TeacherDashboard() {
  const { user, token, logout } = useAuth()
  const navigate = useNavigate()

  // Room creation state
  const [system,      setSystem]      = useState<System | null>(null)
  const [roomCode,    setRoomCode]    = useState('')
  const [generating,  setGenerating]  = useState(false)

  // Overview data
  const [students,    setStudents]    = useState<Student[]>([])
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [attendances, setAttendances] = useState<Attendance[]>([])
  const [loading,     setLoading]     = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      fetch('/api/auth/students',   { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch('/api/test/submissions',{ headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch('/api/teach/attend',    { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
    ]).then(([s, e, a]) => {
      if (s.success) setStudents(s.students)
      if (e.success) setSubmissions(e.submissions)
      if (a.success) setAttendances(a.attendances)
    }).finally(() => setLoading(false))
  }, [token])

  async function generateCode(type: System) {
    setSystem(type)
    setRoomCode('')
    setGenerating(true)
    try {
      const res = await fetch('/api/teach/rooms/generate', {
        headers: { Authorization: `Bearer ${token}` }
      }).then(r => r.json())
      if (res.success) setRoomCode(res.code)
    } finally {
      setGenerating(false)
    }
  }

  function enterRoom() {
    if (!system || !roomCode) return
    navigate(`/${system}/teacher/${roomCode}`)
  }

  const totalStudents  = students.length
  const totalExams     = new Set(submissions.map(s => s.examId)).size
  const pendingGrading = submissions.filter(s => s.status === 'pending').length
  const totalClasses   = new Set(attendances.map(a => a.roomCode)).size

  // Per-student stats
  function studentStats(sid: string) {
    const subs = submissions.filter(s => s.userId === sid)
    const atts = attendances.filter(a => a.userId === sid)
    const avg  = subs.length ? Math.round(subs.reduce((acc, s) => acc + (s.totalScore ? s.score / s.totalScore * 100 : 0), 0) / subs.length) : null
    return { exams: subs.length, classes: atts.length, avg }
  }

  const recentSubmissions = submissions.slice(0, 5)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/30">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-slate-100 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-brand-600 flex items-center justify-center">
              <GraduationCap className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-brand-800">智慧课堂 · 教师端</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="badge badge-blue text-xs hidden sm:inline-flex">教师</span>
            <span className="text-sm text-slate-600 font-medium hidden sm:block">{user?.name}</span>
            <button onClick={() => { logout(); navigate('/login', { replace: true }) }}
              className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-red-500 transition-colors">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { icon: Users,       label: '学生人数',   value: totalStudents,  color: 'text-brand-600',   bg: 'bg-brand-50' },
            { icon: BarChart2,   label: '考试场次',   value: totalExams,     color: 'text-indigo-600',  bg: 'bg-indigo-50' },
            { icon: AlertCircle, label: '待批卷',     value: pendingGrading, color: 'text-amber-600',   bg: 'bg-amber-50' },
            { icon: Monitor,     label: '开课次数',   value: totalClasses,   color: 'text-purple-600',  bg: 'bg-purple-50' },
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

        <div className="grid lg:grid-cols-2 gap-6">
          {/* ── Create Room panel ── */}
          <div className="card space-y-4">
            <h3 className="font-bold text-slate-800 text-base">开启新房间</h3>

            {/* System selector */}
            <div className="grid grid-cols-2 gap-3">
              {([
                { id: 'teach' as const, icon: Monitor,      label: '演示课堂', sub: 'PDF 实时演示',  color: 'brand' },
                { id: 'test'  as const, icon: ClipboardList, label: '在线考试', sub: '在线答题评分', color: 'indigo' },
              ]).map(s => (
                <button key={s.id} onClick={() => generateCode(s.id)}
                  className={`group text-left p-4 rounded-2xl border-2 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md
                    ${system === s.id && roomCode ? `border-${s.color}-300 bg-${s.color}-50` : 'border-slate-100 hover:border-slate-200 bg-white'}`}>
                  <div className={`w-10 h-10 rounded-xl bg-${s.color}-100 flex items-center justify-center mb-3 text-${s.color}-600`}>
                    <s.icon className="w-5 h-5" />
                  </div>
                  <p className="font-bold text-slate-800 text-sm">{s.label}</p>
                  <p className={`text-xs text-${s.color}-600 mt-0.5`}>{s.sub}</p>
                  <p className="text-xs text-brand-600 mt-2 font-semibold flex items-center gap-1">
                    点击生成房间码 <ArrowRight className="w-3 h-3" />
                  </p>
                </button>
              ))}
            </div>

            {/* Room code display */}
            {generating && (
              <div className="flex items-center justify-center py-4">
                <RefreshCw className="w-5 h-5 text-slate-400 animate-spin" />
                <span className="text-sm text-slate-500 ml-2">生成中…</span>
              </div>
            )}

            {roomCode && !generating && (
              <div className="space-y-4 animate-fade-up">
                <div>
                  <p className="text-xs text-slate-500 font-medium flex items-center gap-1.5 mb-2">
                    <Hash className="w-3.5 h-3.5" />房间码
                    <button onClick={() => generateCode(system!)} className="ml-auto text-brand-600 hover:text-brand-800 flex items-center gap-1">
                      <RefreshCw className="w-3 h-3" />换一个
                    </button>
                  </p>
                  <div className="flex gap-2 justify-center">
                    {roomCode.split('').map((ch, i) => (
                      <span key={i} className="w-10 h-12 flex items-center justify-center rounded-xl bg-brand-50 border-2 border-brand-200 font-mono text-xl font-bold text-brand-700 shadow-sm">
                        {ch}
                      </span>
                    ))}
                  </div>
                  <p className="text-center text-xs text-slate-400 mt-2">学生输入此房间码加入</p>
                </div>

                <div className="flex justify-center">
                  <RoomQR code={roomCode} type={system!} size={140} />
                </div>

                <button onClick={enterRoom}
                  className="btn-primary btn-lg w-full">
                  <Play className="w-4 h-4" />
                  进入{system === 'teach' ? '演示课堂' : '考试系统'}控制台
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {!roomCode && !generating && (
              <div className="text-center py-6 text-slate-400">
                <Hash className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">点击上方系统卡片生成房间码</p>
              </div>
            )}
          </div>

          {/* ── Recent submissions ── */}
          <div className="card">
            <div className="flex items-center gap-2 mb-4">
              <BarChart2 className="w-5 h-5 text-indigo-500" />
              <h3 className="font-semibold text-slate-800">最新答卷</h3>
              <button onClick={() => navigate('/teacher/exams')} className="ml-auto text-xs text-brand-600 hover:underline flex items-center gap-1">
                考试管理 <ChevronRight className="w-3 h-3" />
              </button>
            </div>
            {loading ? (
              <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-12 rounded-xl bg-slate-100 animate-pulse" />)}</div>
            ) : recentSubmissions.length === 0 ? (
              <div className="text-center py-8">
                <BookOpen className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-500">暂无答卷</p>
              </div>
            ) : (
              <div className="space-y-2">
                {recentSubmissions.map(sub => {
                  const p = sub.totalScore ? Math.round(sub.score / sub.totalScore * 100) : 0
                  return (
                    <div key={sub.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-slate-100 hover:border-brand-200 hover:bg-brand-50/30 transition-colors cursor-pointer"
                      onClick={() => navigate(`/teacher/student/${sub.userId}?exam=${sub.examId}`)}>
                      <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 text-xs font-bold text-slate-500">
                        {sub.username?.charAt(0) || '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800 truncate">{sub.username}</p>
                        <p className="text-xs text-slate-400 truncate">{sub.examTitle}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`text-sm font-bold font-mono ${p >= 90 ? 'text-emerald-600' : p >= 70 ? 'text-indigo-600' : p >= 60 ? 'text-amber-600' : 'text-red-500'}`}>
                          {sub.score}/{sub.totalScore}
                        </p>
                        {sub.status === 'pending'
                          ? <span className="text-xs text-amber-600 flex items-center gap-0.5 justify-end"><Clock className="w-3 h-3" />待批</span>
                          : <span className="text-xs text-emerald-600 flex items-center gap-0.5 justify-end"><CheckCircle2 className="w-3 h-3" />完成</span>}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Student roster ── */}
        <div className="card">
          <div className="flex items-center gap-2 mb-5">
            <Users className="w-5 h-5 text-brand-500" />
            <h3 className="font-semibold text-slate-800">学生名册</h3>
            <span className="ml-auto text-xs text-slate-400">{totalStudents} 人</span>
          </div>
          {loading ? (
            <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-14 rounded-xl bg-slate-100 animate-pulse" />)}</div>
          ) : students.length === 0 ? (
            <div className="text-center py-8">
              <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-500">暂无学生注册</p>
            </div>
          ) : (
            <div className="space-y-2">
              {students.map(stu => {
                const stats = studentStats(stu.id)
                return (
                  <div key={stu.id} className="flex items-center gap-3 px-4 py-3 rounded-xl border border-slate-100 hover:border-brand-200 hover:bg-brand-50/30 transition-all cursor-pointer"
                    onClick={() => navigate(`/teacher/student/${stu.id}`)}>
                    <div className="w-9 h-9 rounded-xl bg-brand-100 flex items-center justify-center shrink-0 text-sm font-bold text-brand-700">
                      {stu.name?.charAt(0) || stu.username?.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800">{stu.name}</p>
                      <p className="text-xs text-slate-400">@{stu.username}</p>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-slate-500 shrink-0">
                      <span className="flex items-center gap-1"><BarChart2 className="w-3 h-3 text-indigo-400" />{stats.exams} 次考试</span>
                      <span className="flex items-center gap-1"><Monitor className="w-3 h-3 text-purple-400" />{stats.classes} 次上课</span>
                      {stats.avg !== null && (
                        <span className={`font-bold font-mono ${stats.avg >= 90 ? 'text-emerald-600' : stats.avg >= 70 ? 'text-indigo-600' : stats.avg >= 60 ? 'text-amber-600' : 'text-red-500'}`}>
                          均 {stats.avg}%
                        </span>
                      )}
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
