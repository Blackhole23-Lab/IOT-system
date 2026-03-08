import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import {
  Shield, Users, GraduationCap, BookOpen, LogOut,
  Plus, Pencil, Trash2, Save, X, Search, RefreshCw,
  CheckCircle2, AlertCircle, ChevronDown, ChevronUp,
  BarChart2, Monitor, Lock, UserPlus
} from 'lucide-react'

interface UserRow {
  id: string; username: string; name: string
  role: 'teacher' | 'student' | 'admin'
  email: string; createdAt: string
}
interface Submission { userId: string; score: number; totalScore: number; status: string }
interface Attendance { userId: string }
interface ClassStudent { id: string; name: string; username: string; joinedAt: string }
interface Classroom { id: string; name: string; teacherId: string; teacher: { id: string; name: string; username: string }; studentCount: number; students: ClassStudent[]; createdAt: string }

type Tab = 'overview' | 'students' | 'teachers' | 'admins' | 'classrooms'

const ROLE_LABEL: Record<string, string> = { admin: '管理员', teacher: '教师', student: '学生' }
const ROLE_COLOR: Record<string, string> = {
  admin:   'bg-red-100 text-red-700',
  teacher: 'bg-brand-100 text-brand-700',
  student: 'bg-emerald-100 text-emerald-700',
}

export default function AdminDashboard() {
  const { user, token, logout } = useAuth()
  const navigate = useNavigate()

  const [tab, setTab] = useState<Tab>('overview')
  const [users, setUsers] = useState<UserRow[]>([])
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [attendances, setAttendances] = useState<Attendance[]>([])
  const [classrooms, setClassrooms] = useState<Classroom[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  // Edit modal state
  const [editUser, setEditUser] = useState<UserRow | null>(null)
  const [editForm, setEditForm] = useState({ name: '', email: '', password: '', role: '' })
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState('')

  // Create modal state
  const [showCreate, setShowCreate] = useState(false)
  const [createForm, setCreateForm] = useState({ username: '', password: '', name: '', email: '', role: 'student' })
  const [createSaving, setCreateSaving] = useState(false)
  const [createError, setCreateError] = useState('')

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null)
  const [deleteSaving, setDeleteSaving] = useState(false)

  // Classroom state
  const [showCreateClass, setShowCreateClass] = useState(false)
  const [newClassName, setNewClassName] = useState('')
  const [newClassTeacherId, setNewClassTeacherId] = useState('')
  const [creatingClass, setCreatingClass] = useState(false)
  const [deleteClassTarget, setDeleteClassTarget] = useState<Classroom | null>(null)
  const [addStudentOpen, setAddStudentOpen] = useState(false)
  const [addStudentClass, setAddStudentClass] = useState<Classroom | null>(null)
  const [availStudents, setAvailStudents] = useState<UserRow[]>([])
  const [selectedToAdd, setSelectedToAdd] = useState<string[]>([])
  const [addingStudents, setAddingStudents] = useState(false)

  const [toast, setToast] = useState('')

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  const authH = { Authorization: `Bearer ${token}` }

  async function loadData() {
    setLoading(true)
    try {
      const [uRes, sRes, aRes, cRes] = await Promise.all([
        fetch('/api/auth/admin/users', { headers: authH }).then(r => r.json()),
        fetch('/api/test/submissions',  { headers: authH }).then(r => r.json()),
        fetch('/api/teach/attend',      { headers: authH }).then(r => r.json()),
        fetch('/api/classrooms',        { headers: authH }).then(r => r.json()),
      ])
      if (uRes.success) setUsers(uRes.users)
      if (sRes.success) setSubmissions(sRes.submissions)
      if (aRes.success) setAttendances(aRes.attendances)
      if (cRes.success) setClassrooms(cRes.classrooms)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [token]) // eslint-disable-line

  // ── Classroom actions ───────────────────────────────────────────────────────
  async function createClassroom() {
    if (!newClassName.trim() || !newClassTeacherId) return
    setCreatingClass(true)
    try {
      const res = await fetch('/api/classrooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authH },
        body: JSON.stringify({ name: newClassName.trim(), teacherId: newClassTeacherId }),
      }).then(r => r.json())
      if (!res.success) throw new Error(res.error)
      setClassrooms(prev => [res.classroom, ...prev])
      setNewClassName(''); setNewClassTeacherId(''); setShowCreateClass(false)
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
      setDeleteClassTarget(null)
      showToast('班级已删除')
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : '删除失败')
    }
  }

  async function openAddStudents(cls: Classroom) {
    setAddStudentClass(cls); setAddStudentOpen(true); setSelectedToAdd([])
    try {
      const res = await fetch(`/api/classrooms/${cls.id}/students/available`, { headers: authH }).then(r => r.json())
      if (res.success) setAvailStudents(res.students)
    } catch { setAvailStudents([]) }
  }

  async function addStudents() {
    if (!addStudentClass || selectedToAdd.length === 0) return
    setAddingStudents(true)
    try {
      const res = await fetch(`/api/classrooms/${addStudentClass.id}/students`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authH },
        body: JSON.stringify({ studentIds: selectedToAdd }),
      }).then(r => r.json())
      if (!res.success) throw new Error(res.error)
      const updated = await fetch(`/api/classrooms/${addStudentClass.id}`, { headers: authH }).then(r => r.json())
      if (updated.success) setClassrooms(prev => prev.map(c => c.id === addStudentClass.id ? updated.classroom : c))
      setAddStudentOpen(false)
      showToast(`已添加 ${res.added} 名学生`)
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : '添加失败')
    } finally { setAddingStudents(false) }
  }

  async function removeStudentFromClass(cls: Classroom, studentId: string) {
    try {
      await fetch(`/api/classrooms/${cls.id}/students/${studentId}`, { method: 'DELETE', headers: authH })
      const updatedStudents = cls.students.filter(s => s.id !== studentId)
      const updated = { ...cls, students: updatedStudents, studentCount: updatedStudents.length }
      setClassrooms(prev => prev.map(c => c.id === cls.id ? updated : c))
      showToast('已移出学生')
    } catch { showToast('操作失败') }
  }

  function openEdit(u: UserRow) {
    setEditUser(u)
    setEditForm({ name: u.name, email: u.email, password: '', role: u.role })
    setEditError('')
  }

  async function saveEdit() {
    if (!editUser) return
    setEditSaving(true); setEditError('')
    try {
      const body: Record<string, string> = { name: editForm.name, email: editForm.email, role: editForm.role }
      if (editForm.password) body.password = editForm.password
      const res = await fetch(`/api/auth/admin/users/${editUser.username}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      }).then(r => r.json())
      if (!res.success) throw new Error(res.message)
      setUsers(prev => prev.map(u => u.username === editUser.username ? res.user : u))
      setEditUser(null)
      showToast('用户信息已更新')
    } catch (e: unknown) {
      setEditError(e instanceof Error ? e.message : '保存失败')
    } finally {
      setEditSaving(false)
    }
  }

  async function doCreate() {
    setCreateSaving(true); setCreateError('')
    try {
      const res = await fetch('/api/auth/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(createForm),
      }).then(r => r.json())
      if (!res.success) throw new Error(res.message)
      setUsers(prev => [...prev, res.user])
      setShowCreate(false)
      setCreateForm({ username: '', password: '', name: '', email: '', role: 'student' })
      showToast('用户创建成功')
    } catch (e: unknown) {
      setCreateError(e instanceof Error ? e.message : '创建失败')
    } finally {
      setCreateSaving(false)
    }
  }

  async function doDelete() {
    if (!deleteTarget) return
    setDeleteSaving(true)
    try {
      const res = await fetch(`/api/auth/admin/users/${deleteTarget.username}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      }).then(r => r.json())
      if (!res.success) throw new Error(res.message)
      setUsers(prev => prev.filter(u => u.username !== deleteTarget.username))
      setDeleteTarget(null)
      showToast('用户已删除')
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : '删除失败')
      setDeleteTarget(null)
    } finally {
      setDeleteSaving(false)
    }
  }

  // Computed stats per user
  function userStats(uid: string) {
    const subs = submissions.filter(s => s.userId === uid)
    const atts = attendances.filter(a => a.userId === uid)
    const avg = subs.length ? Math.round(subs.reduce((acc, s) => acc + (s.totalScore ? s.score / s.totalScore * 100 : 0), 0) / subs.length) : null
    return { exams: subs.length, classes: atts.length, avg, pending: subs.filter(s => s.status === 'pending').length }
  }

  const teachers = users.filter(u => u.role === 'teacher')
  const students = users.filter(u => u.role === 'student')
  const admins   = users.filter(u => u.role === 'admin')

  function filteredUsers(list: UserRow[]) {
    if (!search) return list
    const q = search.toLowerCase()
    return list.filter(u => u.name.toLowerCase().includes(q) || u.username.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
  }

  const tabList: { key: Tab; label: string; icon: typeof Users; count: number; color: string }[] = [
    { key: 'overview',   label: '总览',   icon: BarChart2,    count: users.length,      color: 'text-slate-600' },
    { key: 'students',   label: '学生',   icon: GraduationCap,count: students.length,   color: 'text-emerald-600' },
    { key: 'teachers',   label: '教师',   icon: BookOpen,     count: teachers.length,   color: 'text-brand-600' },
    { key: 'admins',     label: '管理员', icon: Shield,       count: admins.length,     color: 'text-red-600' },
    { key: 'classrooms', label: '班级',   icon: Users,        count: classrooms.length, color: 'text-purple-600' },
  ]

  function UserTable({ list, showStats }: { list: UserRow[]; showStats?: boolean }) {
    const filtered = filteredUsers(list)
    if (loading) return <div className="space-y-2">{[1,2,3].map(i=><div key={i} className="h-14 rounded-xl bg-slate-100 animate-pulse"/>)}</div>
    if (filtered.length === 0) return (
      <div className="text-center py-12 text-slate-400">
        <Users className="w-10 h-10 mx-auto mb-2 opacity-30"/>
        <p className="text-sm">暂无数据</p>
      </div>
    )
    return (
      <div className="space-y-2">
        {filtered.map(u => {
          const stats = showStats ? userStats(u.id) : null
          return (
            <div key={u.id} className="flex items-center gap-3 px-4 py-3 rounded-xl border border-slate-100 hover:border-slate-200 transition-colors">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-sm font-bold ${
                u.role === 'admin' ? 'bg-red-100 text-red-700' : u.role === 'teacher' ? 'bg-brand-100 text-brand-700' : 'bg-emerald-100 text-emerald-700'
              }`}>
                {u.name?.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-slate-800">{u.name}</p>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${ROLE_COLOR[u.role]}`}>{ROLE_LABEL[u.role]}</span>
                </div>
                <p className="text-xs text-slate-400">@{u.username}{u.email ? ` · ${u.email}` : ''}</p>
              </div>
              {showStats && stats && u.role === 'student' && (
                <div className="hidden sm:flex items-center gap-3 text-xs text-slate-500 shrink-0">
                  <span className="flex items-center gap-1"><BarChart2 className="w-3 h-3 text-indigo-400"/>{stats.exams}次考试</span>
                  <span className="flex items-center gap-1"><Monitor className="w-3 h-3 text-purple-400"/>{stats.classes}次上课</span>
                  {stats.avg !== null && (
                    <span className={`font-bold font-mono ${stats.avg >= 90 ? 'text-emerald-600' : stats.avg >= 70 ? 'text-indigo-600' : stats.avg >= 60 ? 'text-amber-600' : 'text-red-500'}`}>
                      均{stats.avg}%
                    </span>
                  )}
                  {stats.pending > 0 && <span className="text-amber-600">待批{stats.pending}</span>}
                </div>
              )}
              {showStats && stats && u.role === 'teacher' && (
                <div className="hidden sm:flex items-center gap-3 text-xs text-slate-500 shrink-0">
                  <span>管理{students.length}名学生</span>
                </div>
              )}
              <div className="flex items-center gap-1 shrink-0">
                {u.role === 'student' && (
                  <button onClick={() => navigate(`/teacher/student/${u.id}`)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors" title="查看档案">
                    <BarChart2 className="w-3.5 h-3.5"/>
                  </button>
                )}
                <button onClick={() => openEdit(u)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors" title="编辑">
                  <Pencil className="w-3.5 h-3.5"/>
                </button>
                <button onClick={() => setDeleteTarget(u)} disabled={u.username === 'admin'}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed" title="删除">
                  <Trash2 className="w-3.5 h-3.5"/>
                </button>
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-red-50/20 to-indigo-50/20">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 animate-fade-up">
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 text-white text-sm shadow-lg">
            <CheckCircle2 className="w-4 h-4 text-emerald-400"/>
            {toast}
          </div>
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-slate-100 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-red-600 flex items-center justify-center">
              <Shield className="w-4 h-4 text-white"/>
            </div>
            <div>
              <span className="font-bold text-slate-800">智慧课堂 · 管理后台</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="badge text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-semibold hidden sm:inline-flex">超级管理员</span>
            <span className="text-sm text-slate-600 font-medium hidden sm:block">{user?.name}</span>
            <button onClick={() => { logout(); navigate('/login', { replace: true }) }}
              className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-red-500 transition-colors">
              <LogOut className="w-4 h-4"/>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { icon: Users,       label: '总用户数', value: users.length,      color: 'text-slate-600',   bg: 'bg-slate-100' },
            { icon: GraduationCap,label: '学生数',  value: students.length,   color: 'text-emerald-600', bg: 'bg-emerald-50' },
            { icon: BookOpen,    label: '教师数',   value: teachers.length,   color: 'text-brand-600',   bg: 'bg-brand-50' },
            { icon: BarChart2,   label: '总答卷数', value: submissions.length, color: 'text-indigo-600',  bg: 'bg-indigo-50' },
          ].map(s => (
            <div key={s.label} className="card p-4">
              <div className={`w-9 h-9 rounded-xl ${s.bg} flex items-center justify-center mb-3`}>
                <s.icon className={`w-4 h-4 ${s.color}`}/>
              </div>
              <p className={`text-2xl font-bold ${s.color} font-mono`}>{s.value}</p>
              <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Main card */}
        <div className="card">
          {/* Tabs + actions */}
          <div className="flex flex-wrap items-center gap-2 mb-5">
            <div className="flex gap-1 p-1 rounded-xl bg-slate-100 flex-1 min-w-0 overflow-x-auto">
              {tabList.map(t => (
                <button key={t.key} onClick={() => setTab(t.key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                    tab === t.key ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                  <t.icon className={`w-3.5 h-3.5 ${tab === t.key ? t.color : ''}`}/>
                  {t.label}
                  <span className={`ml-0.5 text-xs ${tab === t.key ? t.color : 'text-slate-400'}`}>({t.count})</span>
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={loadData} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors" title="刷新">
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}/>
              </button>
              {tab !== 'classrooms' && (
                <button onClick={() => { setShowCreate(true); setCreateError('') }}
                  className="btn-primary gap-1.5 text-sm py-2">
                  <Plus className="w-3.5 h-3.5"/>新建用户
                </button>
              )}
              {tab === 'classrooms' && (
                <button onClick={() => setShowCreateClass(true)}
                  className="btn-primary gap-1.5 text-sm py-2">
                  <Plus className="w-3.5 h-3.5"/>新建班级
                </button>
              )}
            </div>
          </div>

          {/* Search */}
          {tab !== 'overview' && (
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"/>
              <input type="text" placeholder="搜索姓名、用户名、邮箱…"
                className="input pl-9 text-sm py-2"
                value={search} onChange={e => setSearch(e.target.value)}/>
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4"/>
                </button>
              )}
            </div>
          )}

          {/* Tab content */}
          {tab === 'overview' && (
            <div className="space-y-6">
              <section>
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <GraduationCap className="w-3.5 h-3.5 text-emerald-500"/>学生列表
                </h4>
                <UserTable list={students} showStats/>
              </section>
              <section>
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-brand-500"/>教师列表
                </h4>
                <UserTable list={teachers} showStats/>
              </section>
            </div>
          )}
          {tab === 'students' && <UserTable list={students} showStats/>}
          {tab === 'teachers' && <UserTable list={teachers} showStats/>}
          {tab === 'admins'   && <UserTable list={admins}/>}
          {tab === 'classrooms' && (
            <div className="space-y-3">
              {loading ? (
                <div className="space-y-2">{[1,2,3].map(i=><div key={i} className="h-20 rounded-xl bg-slate-100 animate-pulse"/>)}</div>
              ) : classrooms.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <Users className="w-10 h-10 mx-auto mb-2 opacity-30"/>
                  <p className="text-sm">暂无班级，点击「新建班级」创建</p>
                </div>
              ) : classrooms.map(cls => (
                <div key={cls.id} className="border border-slate-100 rounded-2xl overflow-hidden">
                  <div className="flex items-center gap-3 px-4 py-3 bg-slate-50">
                    <div className="w-9 h-9 rounded-xl bg-purple-100 flex items-center justify-center shrink-0">
                      <BookOpen className="w-4 h-4 text-purple-600"/>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-800">{cls.name}</p>
                      <p className="text-xs text-slate-400">
                        教师：{cls.teacher?.name || '未分配'} · {cls.studentCount} 名学生
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => openAddStudents(cls)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-medium transition-colors">
                        <UserPlus className="w-3.5 h-3.5"/>添加学生
                      </button>
                      <button onClick={() => setDeleteClassTarget(cls)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                        <Trash2 className="w-3.5 h-3.5"/>
                      </button>
                    </div>
                  </div>
                  {cls.students.length === 0 ? (
                    <div className="px-4 py-3 text-xs text-slate-400 italic">暂无学生</div>
                  ) : (
                    <div className="divide-y divide-slate-50">
                      {cls.students.map(stu => (
                        <div key={stu.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors">
                          <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0 text-xs font-bold text-emerald-700">
                            {stu.name?.charAt(0)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-800">{stu.name}</p>
                            <p className="text-xs text-slate-400">@{stu.username}</p>
                          </div>
                          <button onClick={() => removeStudentFromClass(cls, stu.id)}
                            className="p-1 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors">
                            <X className="w-3.5 h-3.5"/>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* ── Edit Modal ── */}
      {editUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-up">
          <div className="w-full max-w-md card shadow-2xl">
            <div className="flex items-center gap-3 mb-5">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-base font-bold ${ROLE_COLOR[editUser.role]}`}>
                {editUser.name?.charAt(0)}
              </div>
              <div>
                <p className="font-bold text-slate-800">{editUser.name}</p>
                <p className="text-xs text-slate-400">@{editUser.username}</p>
              </div>
              <button onClick={() => setEditUser(null)} className="ml-auto p-2 rounded-lg hover:bg-slate-100 text-slate-500">
                <X className="w-4 h-4"/>
              </button>
            </div>
            {editError && (
              <div className="flex items-center gap-2 px-3 py-2 mb-4 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm">
                <AlertCircle className="w-4 h-4 shrink-0"/>{editError}
              </div>
            )}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">姓名</label>
                <input className="input text-sm py-2" value={editForm.name}
                  onChange={e => setEditForm(p=>({...p, name: e.target.value}))}/>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">邮箱</label>
                <input className="input text-sm py-2" value={editForm.email} type="email"
                  onChange={e => setEditForm(p=>({...p, email: e.target.value}))}/>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  新密码 <span className="text-slate-400 font-normal">（留空则不修改）</span>
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400"/>
                  <input className="input pl-8 text-sm py-2" type="password" placeholder="至少6位"
                    value={editForm.password}
                    onChange={e => setEditForm(p=>({...p, password: e.target.value}))}/>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">角色</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['student','teacher','admin'] as const).map(r => (
                    <button key={r} type="button" onClick={() => setEditForm(p=>({...p, role: r}))}
                      disabled={editUser.username === 'admin' && r !== 'admin'}
                      className={`py-2 rounded-xl border-2 text-xs font-semibold transition-all disabled:opacity-40 ${editForm.role === r
                        ? r === 'admin' ? 'border-red-400 bg-red-50 text-red-700'
                          : r === 'teacher' ? 'border-brand-400 bg-brand-50 text-brand-700'
                          : 'border-emerald-400 bg-emerald-50 text-emerald-700'
                        : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                      {ROLE_LABEL[r]}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setEditUser(null)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors">
                取消
              </button>
              <button onClick={saveEdit} disabled={editSaving}
                className="flex-1 btn-primary gap-2">
                {editSaving ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>保存中…</> : <><Save className="w-4 h-4"/>保存</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Create Modal ── */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-up">
          <div className="w-full max-w-md card shadow-2xl">
            <div className="flex items-center gap-2 mb-5">
              <div className="w-9 h-9 rounded-xl bg-brand-100 flex items-center justify-center">
                <Plus className="w-4 h-4 text-brand-600"/>
              </div>
              <h3 className="font-bold text-slate-800">新建用户</h3>
              <button onClick={() => setShowCreate(false)} className="ml-auto p-2 rounded-lg hover:bg-slate-100 text-slate-500">
                <X className="w-4 h-4"/>
              </button>
            </div>
            {createError && (
              <div className="flex items-center gap-2 px-3 py-2 mb-4 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm">
                <AlertCircle className="w-4 h-4 shrink-0"/>{createError}
              </div>
            )}
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">用户名 *</label>
                  <input className="input text-sm py-2" placeholder="3-20位字符" value={createForm.username}
                    onChange={e => setCreateForm(p=>({...p, username: e.target.value}))}/>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">密码 *</label>
                  <input className="input text-sm py-2" type="password" placeholder="至少6位" value={createForm.password}
                    onChange={e => setCreateForm(p=>({...p, password: e.target.value}))}/>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">姓名</label>
                  <input className="input text-sm py-2" placeholder="显示名称" value={createForm.name}
                    onChange={e => setCreateForm(p=>({...p, name: e.target.value}))}/>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">邮箱</label>
                  <input className="input text-sm py-2" type="email" placeholder="可选" value={createForm.email}
                    onChange={e => setCreateForm(p=>({...p, email: e.target.value}))}/>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">角色 *</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['student','teacher','admin'] as const).map(r => (
                    <button key={r} type="button" onClick={() => setCreateForm(p=>({...p, role: r}))}
                      className={`py-2 rounded-xl border-2 text-xs font-semibold transition-all ${createForm.role === r
                        ? r === 'admin' ? 'border-red-400 bg-red-50 text-red-700'
                          : r === 'teacher' ? 'border-brand-400 bg-brand-50 text-brand-700'
                          : 'border-emerald-400 bg-emerald-50 text-emerald-700'
                        : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                      {ROLE_LABEL[r]}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setShowCreate(false)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors">
                取消
              </button>
              <button onClick={doCreate} disabled={createSaving || !createForm.username || !createForm.password}
                className="flex-1 btn-primary gap-2 disabled:opacity-50">
                {createSaving ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>创建中…</> : <><Plus className="w-4 h-4"/>创建</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirm Modal ── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-up">
          <div className="w-full max-w-sm card shadow-2xl text-center">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-5 h-5 text-red-600"/>
            </div>
            <h3 className="font-bold text-slate-800 mb-1">确认删除用户？</h3>
            <p className="text-sm text-slate-500 mb-6">
              将永久删除 <span className="font-semibold text-slate-700">{deleteTarget.name}</span>（@{deleteTarget.username}），此操作不可撤销。
            </p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors">
                取消
              </button>
              <button onClick={doDelete} disabled={deleteSaving}
                className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                {deleteSaving ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>删除中…</> : '确认删除'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Create Classroom Modal ── */}
      {showCreateClass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-up">
          <div className="w-full max-w-md card shadow-2xl">
            <div className="flex items-center gap-2 mb-5">
              <div className="w-9 h-9 rounded-xl bg-purple-100 flex items-center justify-center">
                <BookOpen className="w-4 h-4 text-purple-600"/>
              </div>
              <h3 className="font-bold text-slate-800">新建班级</h3>
              <button onClick={() => { setShowCreateClass(false); setNewClassName(''); setNewClassTeacherId('') }}
                className="ml-auto p-2 rounded-lg hover:bg-slate-100 text-slate-500"><X className="w-4 h-4"/></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">班级名称 *</label>
                <input className="input text-sm py-2" placeholder="如「2024级计算机1班」"
                  value={newClassName} onChange={e => setNewClassName(e.target.value)}/>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">分配教师 *</label>
                <select className="input text-sm py-2" value={newClassTeacherId}
                  onChange={e => setNewClassTeacherId(e.target.value)}>
                  <option value="">-- 选择教师 --</option>
                  {teachers.map(t => (
                    <option key={t.id} value={t.id}>{t.name} (@{t.username})</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => { setShowCreateClass(false); setNewClassName(''); setNewClassTeacherId('') }}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors">取消</button>
              <button onClick={createClassroom} disabled={creatingClass || !newClassName.trim() || !newClassTeacherId}
                className="flex-1 btn-primary gap-2 disabled:opacity-50">
                {creatingClass ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>创建中…</> : <><Plus className="w-4 h-4"/>创建</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Classroom Confirm ── */}
      {deleteClassTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-up">
          <div className="w-full max-w-sm card shadow-2xl text-center">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-5 h-5 text-red-600"/>
            </div>
            <h3 className="font-bold text-slate-800 mb-1">确认删除班级？</h3>
            <p className="text-sm text-slate-500 mb-6">
              将删除班级 <span className="font-semibold text-slate-700">「{deleteClassTarget.name}」</span>，学生不会被删除。
            </p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteClassTarget(null)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50">取消</button>
              <button onClick={() => deleteClassroom(deleteClassTarget.id)}
                className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors">确认删除</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Students to Class Modal ── */}
      {addStudentOpen && addStudentClass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl flex flex-col max-h-[80vh]">
            <div className="flex items-center gap-3 p-5 border-b border-slate-100">
              <UserPlus className="w-5 h-5 text-brand-600"/>
              <div>
                <p className="font-bold text-slate-800">添加学生</p>
                <p className="text-xs text-slate-400">{addStudentClass.name}</p>
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
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-xs font-bold text-emerald-700 shrink-0">
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
                {addingStudents ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/> : <UserPlus className="w-4 h-4"/>}
                添加 {selectedToAdd.length > 0 ? `${selectedToAdd.length} 名` : ''}学生
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
