import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { getTeachSocket, disconnectTeach } from '../lib/socket'
import { Wifi, WifiOff, Users, AlertTriangle, BookOpen, Crosshair, Pencil, Square, Eraser, Undo2 } from 'lucide-react'

declare const pdfjsLib: {
  GlobalWorkerOptions: { workerSrc: string }
  getDocument: (url: string) => { promise: Promise<PDFDocumentProxy> }
}
declare const Reveal: new (container: HTMLElement, opts: object) => RevealInstance

interface PDFDocumentProxy { numPages: number; getPage: (n: number) => Promise<PDFPageProxy> }
interface PDFPageProxy { getViewport: (o: { scale: number }) => { width: number; height: number }; render: (o: object) => { promise: Promise<void> } }
interface RevealInstance { initialize: () => Promise<void>; destroy: () => void; slide: (h: number, v: number) => void }

type STool = 'pointer' | 'draw' | 'rect' | 'eraser'

export default function TeachStudent() {
  const { code }    = useParams<{ code: string }>()
  const navigate    = useNavigate()
  const { user, token } = useAuth()

  const revealRef    = useRef<HTMLDivElement>(null)
  const slidesRef    = useRef<HTMLDivElement>(null)
  const deckRef      = useRef<RevealInstance | null>(null)
  const canvasRef    = useRef<HTMLCanvasElement>(null)
  const laserDotRef  = useRef<HTMLDivElement>(null)
  const pendingRef   = useRef<{ indexh: number; indexv: number } | null>(null)
  const drawingRef   = useRef(false)
  const lastPosRef   = useRef<{ x: number; y: number } | null>(null)
  const sHistoryRef  = useRef<ImageData[]>([])
  const sRectStartRef = useRef<{ x: number; y: number } | null>(null)

  const [connected,    setConnected]    = useState(false)
  const [viewerCount,  setViewerCount]  = useState(0)
  const [hasPDF,       setHasPDF]       = useState(false)
  const [teacherLeft,  setTeacherLeft]  = useState(false)
  const [statusMsg,    setStatusMsg]    = useState('等待老师开始演示…')
  const [sActiveTool,  setSActiveTool]  = useState<STool>('pointer')
  const [histLen,      setHistLen]      = useState(0)

  const socket = getTeachSocket()

  // ── Student history helpers ───────────────────────────────────────
  function sPushHistory() {
    if (!canvasRef.current) return
    const ctx = canvasRef.current.getContext('2d')!
    sHistoryRef.current.push(ctx.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height))
    setHistLen(sHistoryRef.current.length)
  }

  function sPopHistory() {
    if (!canvasRef.current || sHistoryRef.current.length === 0) return
    const ctx  = canvasRef.current.getContext('2d')!
    const prev = sHistoryRef.current.pop()!
    ctx.putImageData(prev, 0, 0)
    setHistLen(sHistoryRef.current.length)
  }

  function sPeekHistory(): ImageData | null {
    return sHistoryRef.current[sHistoryRef.current.length - 1] ?? null
  }

  function sUndo() {
    sPopHistory()
    socket.emit('draw-undo', { code })
  }

  useEffect(() => {
    injectScript('https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js')
    injectScript('https://cdn.jsdelivr.net/npm/reveal.js@5.2.1/dist/reveal.js')
    injectLink('https://cdn.jsdelivr.net/npm/reveal.js@5.2.1/dist/reveal.css')
    injectLink('https://cdn.jsdelivr.net/npm/reveal.js@5.2.1/dist/theme/black.css')

    socket.on('connect', () => {
      setConnected(true)
      socket.emit('join-room', { code, role: 'student' })
      // Record attendance
      if (user && code) {
        fetch('/api/teach/attend', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ roomCode: code }),
        }).catch(() => {})
      }
    })
    socket.on('disconnect',   () => setConnected(false))
    socket.on('room-status',   ({ viewerCount: vc }: { viewerCount: number }) => setViewerCount(vc))
    socket.on('teacher-left',  () => setTeacherLeft(true))

    socket.on('current-state', async ({ pdfUrl, currentSlide, currentZoom }: { pdfUrl: string | null; currentSlide: number; currentZoom: number; viewerCount: number }) => {
      if (pdfUrl) {
        setStatusMsg('加载教案中…')
        await renderPDF(pdfUrl, currentSlide)
        if (currentZoom && currentZoom !== 1.0) applyZoom(currentZoom)
      }
    })

    socket.on('pdf-loaded', async ({ pdfUrl }: { pdfUrl: string }) => {
      setStatusMsg('加载教案中…')
      await renderPDF(pdfUrl, 0)
    })

    socket.on('slide-change', ({ indexh, indexv }: { indexh: number; indexv: number }) => {
      if (deckRef.current) deckRef.current.slide(indexh, indexv)
      else pendingRef.current = { indexh, indexv }
    })

    socket.on('zoom-change', ({ zoom }: { zoom: number }) => applyZoom(zoom))

    socket.on('laser-move', ({ x, y }: { x: number; y: number }) => {
      const dot  = laserDotRef.current
      const area = document.getElementById('student-area')
      if (!dot || !area) return
      const rect = area.getBoundingClientRect()
      dot.style.left    = (rect.left + x * rect.width)  + 'px'
      dot.style.top     = (rect.top  + y * rect.height) + 'px'
      dot.classList.add('visible')
    })
    socket.on('laser-hide', () => laserDotRef.current?.classList.remove('visible'))

    // Draw events from teacher
    socket.on('draw-event', (data: { fromX: number; fromY: number; toX: number; toY: number; color: string; lineWidth: number }) => {
      if (!canvasRef.current) return
      const ctx = canvasRef.current.getContext('2d')!
      ctx.beginPath()
      ctx.strokeStyle = data.color
      ctx.lineWidth   = data.lineWidth
      ctx.lineCap     = 'round'
      ctx.moveTo(data.fromX, data.fromY)
      ctx.lineTo(data.toX,   data.toY)
      ctx.stroke()
    })

    socket.on('draw-clear', () => {
      if (!canvasRef.current) return
      canvasRef.current.getContext('2d')!.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
      sHistoryRef.current = []
      setHistLen(0)
    })

    // Teacher stroke-start → push snapshot on student side
    socket.on('draw-stroke-start', () => {
      if (!canvasRef.current) return
      const ctx = canvasRef.current.getContext('2d')!
      sHistoryRef.current.push(ctx.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height))
      setHistLen(sHistoryRef.current.length)
    })

    // Teacher drew a rect – draw on top directly
    socket.on('draw-rect', (data: { x: number; y: number; w: number; h: number; color: string; lineWidth: number }) => {
      if (!canvasRef.current) return
      const ctx  = canvasRef.current.getContext('2d')!
      ctx.beginPath()
      ctx.strokeStyle = data.color
      ctx.lineWidth   = data.lineWidth
      ctx.setLineDash([6, 3])
      ctx.strokeRect(data.x, data.y, data.w, data.h)
      ctx.setLineDash([])
    })

    // Teacher undo
    socket.on('draw-undo', () => {
      if (!canvasRef.current || sHistoryRef.current.length === 0) return
      const ctx  = canvasRef.current.getContext('2d')!
      const prev = sHistoryRef.current.pop()!
      ctx.putImageData(prev, 0, 0)
      setHistLen(sHistoryRef.current.length)
    })

    if (socket.connected) {
      socket.emit('join-room', { code, role: 'student' })
      if (user && code) {
        fetch('/api/teach/attend', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ roomCode: code }),
        }).catch(() => {})
      }
    }

    return () => {
      socket.off('connect'); socket.off('disconnect'); socket.off('room-status')
      socket.off('teacher-left'); socket.off('current-state'); socket.off('pdf-loaded')
      socket.off('slide-change'); socket.off('zoom-change')
      socket.off('laser-move'); socket.off('laser-hide')
      socket.off('draw-event'); socket.off('draw-clear')
      socket.off('draw-stroke-start'); socket.off('draw-rect'); socket.off('draw-undo')
      disconnectTeach()
    }
  }, []) // eslint-disable-line

  function applyZoom(zoom: number) {
    if (revealRef.current) {
      revealRef.current.style.transform       = `scale(${zoom})`
      revealRef.current.style.transformOrigin = 'center center'
    }
  }

  async function renderPDF(pdfUrl: string, startSlide = 0) {
    if (deckRef.current) { deckRef.current.destroy(); deckRef.current = null }
    if (!slidesRef.current || !revealRef.current) return
    slidesRef.current.innerHTML = ''
    setHasPDF(false)

    for (let i = 0; i < 30 && typeof pdfjsLib === 'undefined'; i++)
      await new Promise(r => setTimeout(r, 200))
    if (typeof pdfjsLib === 'undefined') { setStatusMsg('pdf.js 加载失败'); return }

    pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js'

    const pdfDoc  = await pdfjsLib.getDocument(pdfUrl).promise
    const dpr     = window.devicePixelRatio || 1
    const renderMul = Math.max(dpr, 3)
    const areaEl  = document.getElementById('student-area')
    const areaW   = areaEl ? (areaEl.clientWidth  || window.innerWidth)  : window.innerWidth
    const areaH   = areaEl ? (areaEl.clientHeight || window.innerHeight - 48) : window.innerHeight - 48

    const firstPage = await pdfDoc.getPage(1)
    const nat       = firstPage.getViewport({ scale: 1 })
    const scale     = Math.min(areaW / nat.width, areaH / nat.height) * 0.95
    const slideW    = Math.round(nat.width  * scale)
    const slideH    = Math.round(nat.height * scale)

    for (let i = 1; i <= pdfDoc.numPages; i++) {
      const page     = await pdfDoc.getPage(i)
      const viewport = page.getViewport({ scale: scale * renderMul })
      const canvas   = document.createElement('canvas')
      canvas.width   = viewport.width
      canvas.height  = viewport.height
      canvas.style.width  = slideW + 'px'
      canvas.style.height = slideH + 'px'
      await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise
      const section = document.createElement('section')
      section.appendChild(canvas)
      slidesRef.current.appendChild(section)
    }

    for (let i = 0; i < 30 && typeof Reveal === 'undefined'; i++)
      await new Promise(r => setTimeout(r, 200))

    const deck = new Reveal(revealRef.current, {
      width: slideW, height: slideH,
      margin: 0, minScale: 1, maxScale: 1,
      controls: false, progress: false, keyboard: false,
      touch: false, embedded: true, hash: false,
      transition: 'slide', backgroundTransition: 'none',
    })
    await deck.initialize()
    deckRef.current = deck

    const target = pendingRef.current || { indexh: startSlide, indexv: 0 }
    deck.slide(target.indexh, target.indexv)
    pendingRef.current = null

    // Setup canvas
    if (canvasRef.current) {
      canvasRef.current.width  = slideW
      canvasRef.current.height = slideH
      canvasRef.current.style.width  = slideW + 'px'
      canvasRef.current.style.height = slideH + 'px'
      sHistoryRef.current = []
      setHistLen(0)
    }

    setHasPDF(true)
    setStatusMsg('跟随老师演示中')
  }

  // ── Student drawing handlers ──────────────────────────────────────
  function sHandleMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    if (sActiveTool === 'pointer') return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    sPushHistory()
    socket.emit('draw-stroke-start', { code })
    if (sActiveTool === 'rect') {
      sRectStartRef.current = { x, y }
    } else {
      drawingRef.current = true
      lastPosRef.current = { x, y }
    }
  }

  function sHandleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!canvasRef.current) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    if (sActiveTool === 'rect' && sRectStartRef.current) {
      const ctx  = canvasRef.current.getContext('2d')!
      const prev = sPeekHistory()
      if (prev) ctx.putImageData(prev, 0, 0)
      ctx.beginPath()
      ctx.strokeStyle = '#3b82f6'
      ctx.lineWidth   = 2.5
      ctx.setLineDash([6, 3])
      ctx.strokeRect(sRectStartRef.current.x, sRectStartRef.current.y,
        x - sRectStartRef.current.x, y - sRectStartRef.current.y)
      ctx.setLineDash([])
    } else if (drawingRef.current && lastPosRef.current && sActiveTool !== 'pointer') {
      const ctx = canvasRef.current.getContext('2d')!
      if (sActiveTool === 'eraser') {
        ctx.clearRect(x - 20, y - 20, 40, 40)
      } else {
        ctx.beginPath()
        ctx.strokeStyle = '#3b82f6'
        ctx.lineWidth   = 2.5
        ctx.lineCap     = 'round'
        ctx.moveTo(lastPosRef.current.x, lastPosRef.current.y)
        ctx.lineTo(x, y)
        ctx.stroke()
        const data = { fromX: lastPosRef.current.x, fromY: lastPosRef.current.y, toX: x, toY: y, color: '#3b82f6', lineWidth: 2.5 }
        socket.emit('draw-event', { code, data })
      }
      lastPosRef.current = { x, y }
    }
  }

  function sHandleMouseUp(e: React.MouseEvent<HTMLCanvasElement>) {
    if (sActiveTool === 'rect' && sRectStartRef.current) {
      const rect = e.currentTarget.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      const data = {
        x: sRectStartRef.current.x, y: sRectStartRef.current.y,
        w: x - sRectStartRef.current.x, h: y - sRectStartRef.current.y,
        color: '#3b82f6', lineWidth: 2.5
      }
      socket.emit('draw-rect', { code, data })
      sRectStartRef.current = null
      // push final canvas state for local undo
      sPushHistory()
    } else {
      drawingRef.current = false
      lastPosRef.current = null
    }
  }

  const sToolCls = (t: STool) =>
    `p-2 rounded-lg transition-all duration-150 text-sm
     ${sActiveTool === t
       ? 'bg-brand-600 text-white shadow-sm'
       : 'text-slate-400 hover:bg-slate-700 hover:text-white'}`

  return (
    <div className="page-full" style={{ background: '#0f172a' }}>
      {/* Thin status bar */}
      <header className="flex items-center justify-between px-4 h-12 bg-slate-900 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-3">
          {connected
            ? <Wifi    className="w-4 h-4 text-emerald-400" />
            : <WifiOff className="w-4 h-4 text-red-400" />}
          <span className="text-xs text-slate-500 font-mono uppercase tracking-wider">Room</span>
          <span className="font-mono font-bold text-brand-400 tracking-widest text-sm">{code}</span>
          <div className="h-4 w-px bg-slate-700" />
          <Users className="w-3.5 h-3.5 text-slate-500" />
          <span className="text-xs text-slate-400 font-mono">{viewerCount} 在线</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Student drawing toolbar */}
          {hasPDF && (
            <div className="flex items-center gap-1 bg-slate-800 rounded-xl p-1">
              <button className={sToolCls('pointer')} onClick={() => setSActiveTool('pointer')} title="指针">
                <Crosshair className="w-4 h-4" />
              </button>
              <button className={sToolCls('draw')} onClick={() => setSActiveTool('draw')} title="画笔">
                <Pencil className="w-4 h-4" />
              </button>
              <button className={sToolCls('rect')} onClick={() => setSActiveTool('rect')} title="框选">
                <Square className="w-4 h-4" />
              </button>
              <button className={sToolCls('eraser')} onClick={() => setSActiveTool('eraser')} title="橡皮">
                <Eraser className="w-4 h-4" />
              </button>
              <div className="w-px h-4 bg-slate-600 mx-0.5" />
              <button
                onClick={sUndo}
                disabled={histLen === 0}
                className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 disabled:opacity-30 transition-all"
                title="撤销"
              >
                <Undo2 className="w-4 h-4" />
              </button>
            </div>
          )}
          <span className="badge-slate text-xs">{statusMsg}</span>
          <button onClick={() => navigate('/dashboard')} className="text-xs text-slate-500 hover:text-slate-300 transition-colors px-2 py-1 rounded-lg hover:bg-slate-800">
            退出
          </button>
        </div>
      </header>

      {/* Content */}
      <div id="student-area" className="flex-1 relative overflow-hidden">
        {/* Teacher left banner */}
        {teacherLeft && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500/90 backdrop-blur text-white text-sm font-semibold shadow-lg animate-fade-up">
            <AlertTriangle className="w-4 h-4" />
            老师已离开课堂
          </div>
        )}

        {/* Waiting state */}
        {!hasPDF && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8 z-10">
            <div className="w-20 h-20 rounded-3xl bg-slate-800 flex items-center justify-center mb-6">
              <BookOpen className="w-10 h-10 text-brand-400 animate-pulse" />
            </div>
            <h2 className="text-xl font-semibold text-slate-200 mb-2">等待老师开始演示</h2>
            <p className="text-slate-500 text-sm">老师选择教案后，页面将自动同步显示</p>
            <div className="flex gap-2 mt-6">
              {[0,1,2].map(i => (
                <span key={i} className="w-2 h-2 rounded-full bg-brand-500 animate-pulse" style={{ animationDelay: `${i*200}ms` }} />
              ))}
            </div>
          </div>
        )}

        {/* Reveal (read-only) */}
        <div
          ref={revealRef}
          className="reveal absolute inset-0 w-full h-full"
          style={{ visibility: hasPDF ? 'visible' : 'hidden' }}
        >
          <div ref={slidesRef} className="slides" />
        </div>

        {/* Draw canvas */}
        <canvas
          ref={canvasRef}
          id="draw-canvas"
          style={{
            display: hasPDF ? 'block' : 'none',
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            visibility: hasPDF ? 'visible' : 'hidden',
            pointerEvents: sActiveTool !== 'pointer' ? 'auto' : 'none',
            cursor: sActiveTool === 'draw' || sActiveTool === 'rect' ? 'crosshair' : sActiveTool === 'eraser' ? 'cell' : 'default',
          }}
          onMouseDown={sHandleMouseDown}
          onMouseMove={sHandleMouseMove}
          onMouseUp={sHandleMouseUp}
          onMouseLeave={sHandleMouseUp}
        />

        {/* Laser dot */}
        <div ref={laserDotRef} id="laser-dot" />
      </div>
    </div>
  )
}

function injectScript(src: string, isModule = false) {
  if (document.querySelector(`script[src="${src}"]`)) return
  const s = document.createElement('script')
  s.src = src
  if (isModule) s.type = 'module'
  document.head.appendChild(s)
}

function injectLink(href: string) {
  if (document.querySelector(`link[href="${href}"]`)) return
  const l = document.createElement('link')
  l.rel  = 'stylesheet'
  l.href = href
  document.head.appendChild(l)
}
