import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'

export interface User {
  id: string
  username: string
  role: 'teacher' | 'student' | 'admin'
  name: string
}

interface AuthCtx {
  user: User | null
  token: string | null
  login: (username: string, password: string) => Promise<void>
  register: (username: string, password: string, role: 'teacher' | 'student', name?: string) => Promise<void>
  logout: () => void
}

const Ctx = createContext<AuthCtx | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user,  setUser]  = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)

  useEffect(() => {
    const saved = localStorage.getItem('iot_token')
    if (!saved) return
    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${saved}` } })
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setToken(saved)
          setUser(d.user)
        } else {
          localStorage.removeItem('iot_token')
        }
      })
      .catch(() => localStorage.removeItem('iot_token'))
  }, [])

  async function login(username: string, password: string) {
    const res = await fetch('/api/auth/login', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ username, password }),
    })
    const data = await res.json()
    if (!data.success) throw new Error(data.message || '登录失败')
    localStorage.setItem('iot_token', data.token)
    setToken(data.token)
    setUser(data.user)
  }

  async function register(username: string, password: string, role: 'teacher' | 'student', name?: string) {
    const res = await fetch('/api/auth/register', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ username, password, role, name }),
    })
    const data = await res.json()
    if (!data.success) throw new Error(data.message || '注册失败')
    localStorage.setItem('iot_token', data.token)
    setToken(data.token)
    setUser(data.user)
  }

  function logout() {
    localStorage.removeItem('iot_token')
    setToken(null)
    setUser(null)
  }

  return <Ctx.Provider value={{ user, token, login, register, logout }}>{children}</Ctx.Provider>
}

export function useAuth() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAuth must be inside AuthProvider')
  return ctx
}
