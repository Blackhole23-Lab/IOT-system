import { io, type Socket } from 'socket.io-client'

let teachSocket: Socket | null = null
let testSocket:  Socket | null = null

const BASE = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'

export function getTeachSocket(): Socket {
  if (!teachSocket) {
    teachSocket = io(`${BASE}/teach`, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
    })
  }
  return teachSocket
}

export function getTestSocket(): Socket {
  if (!testSocket) {
    testSocket = io(`${BASE}/test`, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
    })
  }
  return testSocket
}

export function disconnectTeach() {
  teachSocket?.disconnect()
  teachSocket = null
}

export function disconnectTest() {
  testSocket?.disconnect()
  testSocket = null
}

/** Generate a random 6-char room code (alphanumeric, no ambiguous chars) */
export function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}
