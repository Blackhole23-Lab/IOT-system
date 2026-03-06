import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { generateRoomCode } from '../lib/socket'
import {
  Monitor, ClipboardList, LogOut, ChevronRight,
  Play, Users, Hash, GraduationCap, BookOpen, ArrowRight
} from 'lucide-react'
import RoomQR from '../components/RoomQR'

type System = 'teach' | 'test' | null

export default function Dashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  // Teacher state
  const [activeSystem, setActiveSystem] = useState<System>(null)
  const [roomCode,     setRoomCode]     = useState<string>('')
  const [roomCreated,  setRoomCreated]  = useState(false)

  // Student state
  const [joinCode,  setJoinCode]  = useState('')
  const [joinType,  setJoinType]  = useState<'teach' | 'test'>('teach')
  const [joinError, setJoinError] = useState('')

  const isTeacher = user?.role === 'teacher'

  function startRoom(type: System) {
    if (!type) return
    const code = generateRoomCode()
    setActiveSystem(type)
    setRoomCode(code)
    setRoomCreated(true)
  }

  function enterRoom() {
    if (!activeSystem || !roomCode) return
    navigate(`/${activeSystem}/teacher/${roomCode}`)
  }

  function handleJoin() {
    const code = joinCode.trim().toUpperCase()
    if (code.length < 4) {
      setJoinError('请输入至少4位房间码')
      return
    }
    setJoinError('')
    navigate(`/${joinType}/student/${code}`)
  }

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/40 to-indigo-50/30">
      {/* Top Nav */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-100 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-brand-600 flex items-center justify-center shadow-sm">
              <GraduationCap className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-brand-800 text-base">智慧课堂</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2">
              <span className={`badge ${isTeacher ? 'badge-blue' : 'badge-green'}`}>
                {isTeacher ? '教师' : '学生'}
              </span>
              <span className="text-sm text-slate-600 font-medium">{user?.name}</span>
            </div>
            <button
              onClick={handleLogout}
              className="btn-ghost text-slate-500 hover:text-red-500 px-2.5 py-2"
              title="退出登录"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {/* Welcome banner */}
        <div className="mb-8 animate-fade-up">
          <h1 className="text-2xl font-bold text-slate-800">
            欢迎回来，<span className="text-brand-600">{user?.name}</span> 👋
          </h1>
          <p className="text-slate-500 mt-1 text-sm">
            {isTeacher ? '选择系统并开启一个房间，开始课堂' : '输入房间码加入老师的课堂'}
          </p>
        </div>

        {isTeacher ? (
          <TeacherView
            activeSystem={activeSystem}
            roomCode={roomCode}
            roomCreated={roomCreated}
            onSelectSystem={setActiveSystem}
            onStartRoom={startRoom}
            onEnterRoom={enterRoom}
            onReset={() => { setActiveSystem(null); setRoomCreated(false); setRoomCode('') }}
          />
        ) : (
          <StudentView
            joinCode={joinCode}
            joinType={joinType}
            joinError={joinError}
            onCodeChange={(v) => { setJoinCode(v); setJoinError('') }}
            onTypeChange={setJoinType}
            onJoin={handleJoin}
          />
        )}
      </main>
    </div>
  )
}

// ── Teacher sub-view ───────────────────────────────────────────────
interface TeacherViewProps {
  activeSystem: System
  roomCode: string
  roomCreated: boolean
  onSelectSystem: (s: System) => void
  onStartRoom: (s: System) => void
  onEnterRoom: () => void
  onReset: () => void
}

function TeacherView({ activeSystem, roomCode, roomCreated, onSelectSystem, onStartRoom, onEnterRoom, onReset }: TeacherViewProps) {
  const systems = [
    {
      id: 'teach' as const,
      icon: <Monitor className="w-7 h-7" />,
      label: '演示系统',
      sub: 'PDF 课件实时演示',
      desc: '上传 PDF 教案，Reveal.js 渲染翻页，激光指针、画板实时同步给学生',
      color: 'brand',
      gradient: 'from-brand-600 to-brand-700',
      lightBg: 'bg-brand-50',
      border: 'border-brand-200',
      textColor: 'text-brand-700',
      iconBg: 'bg-brand-100',
    },
    {
      id: 'test' as const,
      icon: <ClipboardList className="w-7 h-7" />,
      label: '考试系统',
      sub: '在线考试管理',
      desc: '创建考试房间，管理在线答题，实时查看考生进度与考场状态',
      color: 'indigo',
      gradient: 'from-indigo-600 to-indigo-700',
      lightBg: 'bg-indigo-50',
      border: 'border-indigo-200',
      textColor: 'text-indigo-700',
      iconBg: 'bg-indigo-100',
    },
  ]

  if (!roomCreated) {
    return (
      <div className="space-y-6 animate-fade-up">
        <h2 className="text-base font-semibold text-slate-700">选择要开启的系统</h2>
        <div className="grid sm:grid-cols-2 gap-5">
          {systems.map(sys => (
            <button
              key={sys.id}
              onClick={() => onStartRoom(sys.id)}
              className={`group text-left p-6 rounded-2xl border-2 bg-white transition-all duration-200
                hover:shadow-card-lg hover:-translate-y-1 focus:outline-none
                ${activeSystem === sys.id ? `${sys.border} shadow-card-lg` : 'border-slate-100 hover:border-slate-200'}`}
            >
              <div className={`w-14 h-14 rounded-2xl ${sys.iconBg} flex items-center justify-center mb-5 ${sys.textColor} transition-transform duration-200 group-hover:scale-110`}>
                {sys.icon}
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-0.5">{sys.label}</h3>
              <p className={`text-xs font-semibold mb-3 ${sys.textColor}`}>{sys.sub}</p>
              <p className="text-sm text-slate-500 leading-relaxed mb-5">{sys.desc}</p>
              <div className={`inline-flex items-center gap-1.5 text-sm font-semibold ${sys.textColor}`}>
                开启房间
                <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </button>
          ))}
        </div>
      </div>
    )
  }

  // Room created: show QR + code
  const sys = systems.find(s => s.id === activeSystem)!
  return (
    <div className="max-w-lg mx-auto animate-fade-up">
      <div className="card shadow-card-lg border-slate-100">
        {/* Header */}
        <div className={`-m-6 mb-6 p-6 rounded-t-2xl bg-gradient-to-r ${sys.gradient} text-white`}>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                {sys.icon}
                <span className="font-bold text-lg">{sys.label}</span>
              </div>
              <p className="text-white/70 text-sm">{sys.sub}</p>
            </div>
            <button
              onClick={onReset}
              className="text-white/60 hover:text-white text-xs px-3 py-1.5 rounded-lg border border-white/20 hover:bg-white/10 transition-all"
            >
              重新选择
            </button>
          </div>
        </div>

        {/* Room code display */}
        <div className="mb-6">
          <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-3 flex items-center gap-2">
            <Hash className="w-3.5 h-3.5" />
            课堂房间码
          </p>
          <div className="flex gap-2 justify-center mb-1">
            {roomCode.split('').map((ch, i) => (
              <span
                key={i}
                className="w-10 h-12 flex items-center justify-center rounded-xl bg-brand-50 border-2 border-brand-200
                           font-mono text-xl font-bold text-brand-700 shadow-sm"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                {ch}
              </span>
            ))}
          </div>
          <p className="text-center text-xs text-slate-400 mt-2">学生扫码或输入房间码加入</p>
        </div>

        {/* QR Code */}
        <div className="flex justify-center mb-6">
          <RoomQR
            code={roomCode}
            type={activeSystem as 'teach' | 'test'}
            size={180}
          />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="rounded-xl bg-slate-50 border border-slate-100 p-3 text-center">
            <Users className="w-4 h-4 text-slate-400 mx-auto mb-1" />
            <p className="text-lg font-bold text-slate-700">0</p>
            <p className="text-xs text-slate-500">在线学生</p>
          </div>
          <div className={`rounded-xl ${sys.lightBg} border ${sys.border} p-3 text-center`}>
            <BookOpen className={`w-4 h-4 ${sys.textColor} mx-auto mb-1`} />
            <p className={`text-lg font-bold ${sys.textColor}`}>准备中</p>
            <p className={`text-xs ${sys.textColor} opacity-70`}>课堂状态</p>
          </div>
        </div>

        {/* CTA */}
        <button
          onClick={onEnterRoom}
          className={`btn-primary btn-lg w-full bg-gradient-to-r ${sys.gradient}`}
        >
          <Play className="w-4 h-4" />
          进入{sys.label}控制台
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

// ── Student sub-view ───────────────────────────────────────────────
interface StudentViewProps {
  joinCode: string
  joinType: 'teach' | 'test'
  joinError: string
  onCodeChange: (v: string) => void
  onTypeChange: (t: 'teach' | 'test') => void
  onJoin: () => void
}

function StudentView({ joinCode, joinType, joinError, onCodeChange, onTypeChange, onJoin }: StudentViewProps) {
  return (
    <div className="max-w-md mx-auto animate-fade-up space-y-6">
      <div className="card shadow-card-lg">
        <h2 className="font-bold text-slate-800 text-base mb-1">
          {joinType === 'test' ? '进入考试' : '加入课堂'}
        </h2>
        <p className="text-sm text-slate-500 mb-6">
          {joinType === 'test' ? '输入老师提供的考试房间码，开始在线答题' : '输入老师提供的房间码，跟随老师演示'}
        </p>

        {/* System type toggle */}
        <div className="mb-5">
          <p className="text-xs text-slate-500 font-medium mb-2">系统类型</p>
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
            {[
              { id: 'teach' as const, label: '演示课堂', icon: <Monitor className="w-3.5 h-3.5" /> },
              { id: 'test'  as const, label: '在线考试', icon: <ClipboardList className="w-3.5 h-3.5" /> },
            ].map(opt => (
              <button
                key={opt.id}
                onClick={() => onTypeChange(opt.id)}
                className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition-all duration-200
                  ${joinType === opt.id
                    ? 'bg-white text-brand-700 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'}`}
              >
                {opt.icon}
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Room code input */}
        <div className="mb-2">
          <label className="block text-xs text-slate-500 font-medium mb-2">房间码</label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-sm">#</span>
            <input
              type="text"
              className="input-lg pl-9 uppercase font-mono tracking-widest"
              placeholder="输入6位房间码"
              maxLength={8}
              value={joinCode}
              onChange={e => onCodeChange(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && onJoin()}
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          {joinError && (
            <p className="text-xs text-red-500 mt-1.5 flex items-center gap-1">
              <span className="w-3.5 h-3.5 inline-block text-red-500">⚠</span>
              {joinError}
            </p>
          )}
        </div>

        <button
          onClick={onJoin}
          disabled={!joinCode}
          className="btn-primary btn-lg w-full mt-5"
        >
          <ArrowRight className="w-4 h-4" />
          {joinType === 'test' ? '进入考试' : '进入课堂'}
        </button>
      </div>

      {/* Tips */}
      <div className="card border-brand-100 bg-brand-50/50 shadow-none">
        <p className="text-xs font-semibold text-brand-700 mb-2 uppercase tracking-wide">使用提示</p>
        <ul className="text-sm text-slate-600 space-y-1.5">
          <li className="flex items-start gap-2"><span className="text-brand-400 mt-0.5">•</span> 向老师获取6位房间码或扫描二维码</li>
          <li className="flex items-start gap-2"><span className="text-brand-400 mt-0.5">•</span> 演示课堂：实时跟随老师翻页和操作</li>
          <li className="flex items-start gap-2"><span className="text-brand-400 mt-0.5">•</span> 在线考试：在规定时间内完成答题</li>
        </ul>
      </div>
    </div>
  )
}
