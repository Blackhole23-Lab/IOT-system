import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import {
  GraduationCap, Monitor, ClipboardList, LogOut, Play, Users,
  BarChart2, Hash, ArrowRight, RefreshCw, BookOpen, ChevronRight,
  CheckCircle2, Clock, AlertCircle, Plus, Trash2, UserPlus, X, Pencil
} from 'lucide-react'
import RoomQR from '../components/RoomQR'

type System = 'teach' | 'test'
interface Student { id: string; username: string; name: string; createdAt: string }
interface Submission { id: string; userId: string; username: string; examId: string; examTitle: string; score: number; totalScore: number; status: string; submittedAt: string }
interface Attendance { id: string; userId: string; username: string; roomCode: string; date: string; joinedAt: string }
interface ClassStudent { id: string; name: string; username: string; joinedAt: string }
interface Classroom { id: string; name: string; teacherId: string; studentCount: number; students: ClassStudent[]; createdAt: string }

export default function TeacherDashboard() {
  const { user, token, logout } = useAuth()
  const navigate = useNavigate()

  const [system,      setSystem]      = useState<System | null>(null)
  const [roomCode,    setRoomCode]    = useState('')
  const [generating,  setGenerating]  = useState(false)

  const [students,    setStudents]    = useState<Student[]>([])
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [attendances, setAttendances] = useState<Attendance[]>([])
  const [classrooms,  setClassrooms]  = useState<Classroom[]>([])
  const [loading,     setLoading]     = useState(true)

  // Active tab: 'roster' | 'classrooms'
  const [mainTab, setMainTab] = useState<'roster' | 'classrooms'>('roster')

  // Classroom management state
  const [selectedClass,    setSelectedClass]    = useState<Classroom | null>(null)
  const [newClassName,     setNewClassName]     = useState('')
  const [creatingClass,    setCreatingClass]    = useState(false)
  const [showCreateClass,  setShowCreateClass]  = useState(false)
  const [addStudentOpen,   setAddStudentOpen]   = useState(false)
  const [availStudents,    setAvailStudents]    = useState<Student[]>([])
  const [selectedToAdd,    setSelectedToAdd]    = useState<string[]>([])
  const [addingStudents,   setAddingStudents]   = useState(false)
  const [toast,            setToast]            = useState('')

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const authH = { Authorization: `Bearer ${token}` }

  async function loadAll() {
    setLoading(true)
    try {
      const [sRes, subRes, aRes, cRes] = await Promise.all([
        fetch('/api/auth/students',   { headers: authH }).then(r => r.json()),
        fetch('/api/test/submissions',{ headers: authH }).then(r => r.json()),
        fetch('/api/teach/attend',    { headers: authH }).then(r => r.json()),
        fetch('/api/classrooms',      { headers: authH }).then(r => r.json()),
      ])
      if (sRes.success)   setStudents(sRes.students)
      if (subRes.success) setSubmissions(subRes.submissions)
      if (aRes.success)   setAttendances(aRes.attendances)
      if (cRes.success)   setClassrooms(cRes.classrooms)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadAll() }, [token]) // eslint-disable-line

  async function generateCode(type: System) {
    setSystem(type); setRoomCode(''); setGenerating(true)
    try {
      const res = await fetch('/api/teach/rooms/generate', { headers: authH }).then(r => r.json())
      if (res.success) setRoomCode(res.code)
    } finally { setGenerating(false) }
  }

  function enterRoom() {
    if (!system || !roomCode) return
    navigate(`/${system}/teacher/${roomCode}`)
  }

  // ── Classroom actions ───────────────────────────────────────────────────────
  async function createClassroom() {
    if (!newClassName.trim()) return
    setCreatingClass(true)
    try {
      const res = await fetch('/api/classrooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authH },
        body: JSON.stringify({ name: newClassName.trim() }),
      }).then(r => r.json())
      if (!res.success) throw new Error(res.error)
      setClassrooms(prev => [res.classroom, ...prev])
      setNewClassName('')
      setShowCreateClass(false)
      showToast('班级创建成功')
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : '创建失败')
    } finally { setCreatingClass(false) }
  }

  async function deleteClassroom(id: string) {
    try {
      const res = await fetch(`/api/classrooms/${id}`, { method: 'DELETE', headers: authH }).then(r => r.json())
      if (!res.success) throw new Error(res.error)
      setClassrooms(prev => prev.filter(c => c.id !== id))
      if (selectedClass?.id === id) setSelectedClass(null)
      showToast('班级已删除')
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : '删除失败')
    }
  }

  async function openAddStudents(cls: Classroom) {
    setSelectedClass(cls)
    setAddStudentOpen(true)
    setSelectedToAdd([])
    try {
      const res = await fetch(`/api/classrooms/${cls.id}/students/available`, { headers: authH }).then(r => r.json())
      if (res.success) setAvailStudents(res.students)
    } catch { setAvailStudents([]) }
  }

  async function addStudents() {
    if (!selectedClass || selectedToAdd.length === 0) return
    setAddingStudents(true)
    try {
      const res = await fetch(`/api/classrooms/${selectedClass.id}/students`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authH },
        body: JSON.stringify({ studentIds: selectedToAdd }),
      }).then(r => r.json())
      if (!res.success) throw new Error(res.error)
      // Refresh classroom
      const updated = await fetch(`/api/classrooms/${selectedClass.id}`, { headers: authH }).then(r => r.json())
      if (updated.success) {
        setClassrooms(prev => prev.map(c => c.id === selectedClass.id ? updated.classroom : c))
        setSelectedClass(updated.classroom)
      }
      setAddStudentOpen(false)
      showToast(`已添加 ${res.added} 名学生`)
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : '添加失败')
    } finally { setAddingStudents(false) }
  }

  async function removeStudent(cls: Classroom, studentId: string) {
    try {
      const res = await fetch(`/api/classrooms/${cls.id}/students/${studentId}`, {
        method: 'DELETE', headers: authH,
      }).then(r => r.json())
      if (!res.success) throw new Error(res.error)
      const updatedStudents = cls.students.filter(s => s.id !== studentId)
      const updated = { ...cls, students: updatedStudents, studentCount: updatedStudents.length }
      setClassrooms(prev => prev.map(c => c.id === cls.id ? updated : c))
      if (selectedClass?.id === cls.id) setSelectedClass(updated)
      showToast('已移出学生')
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : '操作失败')
    }
  }

  // ── Stats ───────────────────────────────────────────────────────────────────
  const totalStudents  = students.length
  const totalExams     = new Set(submissions.map(s => s.examId)).size
  const pendingGrading = submissions.filter(s => s.status === 'pending').length
  const totalClasses   = new Set(attendances.map(a => a.roomCode)).size

  function studentStats(sid: string) {
    const subs = submissions.filter(s => s.userId === sid)
    const atts = attendances.filter(a => a.userId === sid)
    const avg  = subs.length ? Math.round(subs.reduce((acc, s) => acc + (s.totalScore ? s.score / s.totalScore * 100 : 0), 0) / subs.length) : null
    return { exams: subs.length, classes: atts.length, avg }
  }

  const recentSubmissions = submissions.slice(0, 5)

  // Students in teacher's classrooms (deduplicated)
  const myClassStudentIds = new Set(classrooms.flatMap(c => c.students.map(s => s.id)))
  const rosterStudents = classrooms.length > 0
    ? students.filter(s => myClassStudentIds.has(s.id))
    : students

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/30">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 animate-fade-up">
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 text-white text-sm shadow-lg">
            <CheckCircle2 className="w-4 h-4 text-emerald-400"/>{toast}
          </div>
        </div>
      )}

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
            { icon: Users,       label: '学生人数',   value: totalStudents,      color: 'text-brand-600',   bg: 'bg-brand-50' },
            { icon: BarChart2,   label: '考试场次',   value: totalExams,          color: 'text-indigo-600',  bg: 'bg-indigo-50' },
            { icon: AlertCircle, label: '待批卷',     value: pendingGrading,      color: 'text-amber-600',   bg: 'bg-amber-50' },
            { icon: BookOpen,    label: '我的班级',   value: classrooms.length,   color: 'text-purple-600',  bg: 'bg-purple-50' },
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
            <div className="grid grid-cols-2 gap-3">
              {([
                { id: 'teach' as const, icon: Monitor,       label: '演示课堂', sub: 'PDF 实时演示',  color: 'brand' },
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
                  <p className="text-xs text-brand-600 mt-2 font-semibold flex items-center gap-1">点击生成房间码 <ArrowRight className="w-3 h-3" /></p>
                </button>
              ))}
            </div>
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
                      <span key={i} className="w-10 h-12 flex items-center justify-center rounded-xl bg-brand-50 border-2 border-brand-200 font-mono text-xl font-bold text-brand-700 shadow-sm">{ch}</span>
                    ))}
                  </div>
                  <p className="text-center text-xs text-slate-400 mt-2">学生输入此房间码加入</p>
                </div>
                <div className="flex justify-center">
                  <RoomQR code={roomCode} type={system!} size={140} />
                </div>
                <button onClick={enterRoom} className="btn-primary btn-lg w-full">
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
            </div>
            {loading ? (
              <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-12 rounded-xl bg-slate-100 animate-pulse" />)}</div>
            ) : recentSubmissions.length === 0 ? (
              <div className="text-center py-8"><BookOpen className="w-8 h-8 text-slate-300 mx-auto mb-2" /><p className="text-sm text-slate-500">暂无答卷</p></div>
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

        {/* ── Student Roster + Classrooms ── */}
        <div className="card">
          {/* Tab switcher */}
          <div className="flex items-center gap-2 mb-5">
            <div className="flex gap-1 p-1 rounded-xl bg-slate-100">
              <button onClick={() => setMainTab('roster')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${mainTab === 'roster' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                <Users className="w-3.5 h-3.5 text-brand-500"/>学生名册
                <span className="text-slate-400">({rosterStudents.length})</span>
              </button>
              <button onClick={() => setMainTab('classrooms')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${mainTab === 'classrooms' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                <BookOpen className="w-3.5 h-3.5 text-purple-500"/>班级管理
                <span className="text-slate-400">({classrooms.length})</span>
              </button>
            </div>
            <button onClick={loadAll} className="ml-auto p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors" title="刷新">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}/>
            </button>
          </div>

          {/* ── Student Roster tab ── */}
          {mainTab === 'roster' && (
            loading ? (
              <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-14 rounded-xl bg-slate-100 animate-pulse" />)}</div>
            ) : rosterStudents.length === 0 ? (
              <div className="text-center py-8">
                <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-500">{classrooms.length > 0 ? '您的班级暂无学生' : '暂无学生注册'}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {rosterStudents.map(stu => {
                  const stats = studentStats(stu.id)
                  // Which class(es) does this student belong to?
                  const stuClasses = classrooms.filter(c => c.students.some(s => s.id === stu.id))
                  return (
                    <div key={stu.id} className="flex items-center gap-3 px-4 py-3 rounded-xl border border-slate-100 hover:border-brand-200 hover:bg-brand-50/30 transition-all cursor-pointer"
                      onClick={() => navigate(`/teacher/student/${stu.id}`)}>
                      <div className="w-9 h-9 rounded-xl bg-brand-100 flex items-center justify-center shrink-0 text-sm font-bold text-brand-700">
                        {stu.name?.charAt(0) || stu.username?.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800">{stu.name}</p>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-xs text-slate-400">@{stu.username}</p>
                          {stuClasses.map(c => (
                            <span key={c.id} className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full">{c.name}</span>
                          ))}
                        </div>
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
            )
          )}

          {/* ── Classrooms tab ── */}
          {mainTab === 'classrooms' && (
            <div className="space-y-4">
              {/* Create class button */}
              {!showCreateClass ? (
                <button onClick={() => setShowCreateClass(true)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed border-slate-200 hover:border-brand-400 text-slate-400 hover:text-brand-600 text-sm w-full transition-all">
                  <Plus className="w-4 h-4"/>新建班级
                </button>
              ) : (
                <div className="flex gap-2 animate-fade-up">
                  <input autoFocus type="text" placeholder="班级名称，如「2024级计算机1班」"
                    className="input flex-1 text-sm py-2"
                    value={newClassName} onChange={e => setNewClassName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') createClassroom(); if (e.key === 'Escape') setShowCreateClass(false) }}/>
                  <button onClick={createClassroom} disabled={creatingClass || !newClassName.trim()}
                    className="btn-primary text-sm py-2 px-4 disabled:opacity-50">
                    {creatingClass ? <RefreshCw className="w-4 h-4 animate-spin"/> : '创建'}
                  </button>
                  <button onClick={() => { setShowCreateClass(false); setNewClassName('') }}
                    className="p-2 rounded-xl hover:bg-slate-100 text-slate-500"><X className="w-4 h-4"/></button>
                </div>
              )}

              {loading ? (
                <div className="space-y-2">{[1,2].map(i => <div key={i} className="h-20 rounded-xl bg-slate-100 animate-pulse" />)}</div>
              ) : classrooms.length === 0 ? (
                <div className="text-center py-10 text-slate-400">
                  <BookOpen className="w-10 h-10 mx-auto mb-2 opacity-30"/>
                  <p className="text-sm">还没有班级，点击上方新建</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {classrooms.map(cls => (
                    <div key={cls.id} className="border border-slate-100 rounded-2xl overflow-hidden">
                      {/* Class header */}
                      <div className="flex items-center gap-3 px-4 py-3 bg-slate-50">
                        <div className="w-9 h-9 rounded-xl bg-purple-100 flex items-center justify-center shrink-0">
                          <BookOpen className="w-4 h-4 text-purple-600"/>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-slate-800">{cls.name}</p>
                          <p className="text-xs text-slate-400">{cls.studentCount} 名学生</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button onClick={() => openAddStudents(cls)}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-medium transition-colors">
                            <UserPlus className="w-3.5 h-3.5"/>添加学生
                          </button>
                          <button onClick={() => deleteClassroom(cls.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                            <Trash2 className="w-3.5 h-3.5"/>
                          </button>
                        </div>
                      </div>
                      {/* Students in class */}
                      {cls.students.length === 0 ? (
                        <div className="px-4 py-3 text-xs text-slate-400 italic">暂无学生，点击「添加学生」</div>
                      ) : (
                        <div className="divide-y divide-slate-50">
                          {cls.students.map(stu => {
                            const stats = studentStats(stu.id)
                            return (
                              <div key={stu.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors">
                                <div className="w-7 h-7 rounded-lg bg-brand-100 flex items-center justify-center shrink-0 text-xs font-bold text-brand-700">
                                  {stu.name?.charAt(0)}
                                </div>
                                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => navigate(`/teacher/student/${stu.id}`)}>
                                  <p className="text-sm font-medium text-slate-800">{stu.name}</p>
                                  <p className="text-xs text-slate-400">@{stu.username}</p>
                                </div>
                                <div className="flex items-center gap-3 text-xs text-slate-500 shrink-0">
                                  <span>{stats.exams}次考</span>
                                  <span>{stats.classes}次课</span>
                                  {stats.avg !== null && (
                                    <span className={`font-bold font-mono ${stats.avg >= 90 ? 'text-emerald-600' : stats.avg >= 70 ? 'text-indigo-600' : stats.avg >= 60 ? 'text-amber-600' : 'text-red-500'}`}>
                                      {stats.avg}%
                                    </span>
                                  )}
                                </div>
                                <button onClick={() => removeStudent(cls, stu.id)}
                                  className="p-1 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors">
                                  <X className="w-3.5 h-3.5"/>
                                </button>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* ── Add Students Modal ── */}
      {addStudentOpen && selectedClass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl flex flex-col max-h-[80vh]">
            <div className="flex items-center gap-3 p-5 border-b border-slate-100">
              <UserPlus className="w-5 h-5 text-brand-600"/>
              <div>
                <p className="font-bold text-slate-800">添加学生</p>
                <p className="text-xs text-slate-400">{selectedClass.name}</p>
              </div>
              <button onClick={() => setAddStudentOpen(false)} className="ml-auto p-2 rounded-lg hover:bg-slate-100 text-slate-500">
                <X className="w-4 h-4"/>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-1">
              {availStudents.length === 0 ? (
                <p className="text-center text-sm text-slate-400 py-8">所有学生均已加入此班级</p>
              ) : availStudents.map(s => (
                <label key={s.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 cursor-pointer transition-colors">
                  <input type="checkbox" className="w-4 h-4 rounded text-brand-600"
                    checked={selectedToAdd.includes(s.id)}
                    onChange={e => setSelectedToAdd(prev => e.target.checked ? [...prev, s.id] : prev.filter(id => id !== s.id))}/>
                  <div className="w-8 h-8 rounded-lg bg-brand-100 flex items-center justify-center text-xs font-bold text-brand-700 shrink-0">
                    {s.name?.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-800">{s.name}</p>
                    <p className="text-xs text-slate-400">@{s.username}</p>
                  </div>
                </label>
              ))}
            </div>
            <div className="p-4 border-t border-slate-100">
              <button onClick={addStudents} disabled={selectedToAdd.length === 0 || addingStudents}
                className="btn-primary w-full disabled:opacity-50">
                {addingStudents ? <RefreshCw className="w-4 h-4 animate-spin"/> : <UserPlus className="w-4 h-4"/>}
                添加 {selectedToAdd.length > 0 ? `${selectedToAdd.length} 名` : ''}学生
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
