import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { getTeachSocket, disconnectTeach } from '../lib/socket'
import {
  ChevronLeft, ChevronRight, Users, ZoomIn, ZoomOut, RotateCcw,
  Upload, Library, Pencil, Eraser, Crosshair, LogOut, Wifi, WifiOff, Trash2,
  Square, Undo2
} from 'lucide-react'

// Global type stubs for CDN-loaded libs
declare const pdfjsLib: {
  GlobalWorkerOptions: { workerSrc: string }
  getDocument: (url: string) => { promise: Promise<PDFDocumentProxy> }
}
declare const Reveal: new (container: HTMLElement, opts: object) => RevealInstance

interface PDFDocumentProxy { numPages: number; getPage: (n: number) => Promise<PDFPageProxy> }
interface PDFPageProxy { getViewport: (o: { scale: number }) => { width: number; height: number }; render: (o: object) => { promise: Promise<void> } }
interface RevealInstance { initialize: () => Promise<void>; destroy: () => void; on: (e: string, cb: (d: unknown) => void) => void; slide: (h: number, v: number) => void }

type Tool = 'pointer' | 'laser' | 'draw' | 'rect' | 'eraser'

export default function TeachTeacher() {
  const { code } = useParams<{ code: string }>()
  const { user, token } = useAuth()
  const navigate = useNavigate()

  const revealRef    = useRef<HTMLDivElement>(null)
  const slidesRef    = useRef<HTMLDivElement>(null)
  const deckRef      = useRef<RevealInstance | null>(null)
  const canvasRef    = useRef<HTMLCanvasElement>(null)
  const drawingRef   = useRef(false)
  const lastPosRef   = useRef<{ x: number; y: number } | null>(null)
  const historyRef   = useRef<ImageData[]>([])
  const rectStartRef = useRef<{ x: number; y: number } | null>(null)

  const [connected,    setConnected]    = useState(false)
  const [viewerCount,  setViewerCount]  = useState(0)
  const [hasPDF,       setHasPDF]       = useState(false)
  const [activeTool,   setActiveTool]   = useState<Tool>('pointer')
  const [zoomLevel,    setZoomLevel]    = useState(1.0)
  const [statusMsg,    setStatusMsg]    = useState('请选择教案')
  const [libOpen,      setLibOpen]      = useState(false)
  const [libFiles,     setLibFiles]     = useState<{ name: string; url: string; size: number }[]>([])
  const [uploading,    setUploading]    = useState(false)
  const [histLen,      setHistLen]      = useState(0)

  const socket = getTeachSocket()

  // ── History helpers ───────────────────────────────────────────────
  function pushHistory() {
    if (!canvasRef.current) return
    const ctx = canvasRef.current.getContext('2d')!
    historyRef.current.push(ctx.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height))
    setHistLen(historyRef.current.length)
  }

  function popHistory() {
    if (!canvasRef.current || historyRef.current.length === 0) return
    const ctx  = canvasRef.current.getContext('2d')!
    const prev = historyRef.current.pop()!
    ctx.putImageData(prev, 0, 0)
    setHistLen(historyRef.current.length)
  }

  function peekHistory(): ImageData | null {
    return historyRef.current[historyRef.current.length - 1] ?? null
  }

  useEffect(() => {
    // Inject pdf.js and reveal.js from CDN if not loaded
    injectScript('https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js')
    injectScript('https://cdn.jsdelivr.net/npm/reveal.js@5.2.1/dist/reveal.js')
    injectLink('https://cdn.jsdelivr.net/npm/reveal.js@5.2.1/dist/reveal.css')
    injectLink('https://cdn.jsdelivr.net/npm/reveal.js@5.2.1/dist/theme/black.css')

    socket.on('connect',    () => setConnected(true))
    socket.on('disconnect', () => setConnected(false))
    socket.on('room-status',   ({ viewerCount: vc }: { viewerCount: number }) => setViewerCount(vc))
    socket.on('current-state', ({ viewerCount: vc }: { viewerCount: number }) => setViewerCount(vc))

    // Receive drawing from students
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

    socket.on('draw-stroke-start', () => {
      pushHistory()
    })

    // Receive rect from students – just draw on top, no history restore
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

    socket.on('draw-undo', () => {
      popHistory()
    })

    socket.on('draw-clear', () => {
      if (!canvasRef.current) return
      canvasRef.current.getContext('2d')!.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
      historyRef.current = []
      setHistLen(0)
    })

    socket.emit('join-room', { code, role: 'teacher' })

    return () => {
      socket.off('connect')
      socket.off('disconnect')
      socket.off('room-status')
      socket.off('current-state')
      socket.off('draw-event')
      socket.off('draw-stroke-start')
      socket.off('draw-rect')
      socket.off('draw-undo')
      socket.off('draw-clear')
      disconnectTeach()
    }
  }, []) // eslint-disable-line

  // ── Library ──────────────────────────────────────────────────────
  async function openLibrary() {
    setLibOpen(true)
    await loadLibrary()
  }

  async function loadLibrary() {
    try {
      const res  = await fetch('/api/teach/library', { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (data.success) setLibFiles(data.files)
    } catch { /* ignore */ }
  }

  async function handleQuickUpload(file: File) {
    setUploading(true)
    setStatusMsg('上传中…')
    const fd = new FormData()
    fd.append('pdf', file)
    try {
      const res  = await fetch('/api/teach/library/upload', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      await loadAndRender(data.url)
      socket.emit('pdf-uploaded', { code, pdfUrl: data.url })
      await loadLibrary()
    } catch (err: unknown) {
      setStatusMsg('上传失败: ' + (err instanceof Error ? err.message : ''))
    } finally {
      setUploading(false)
    }
  }

  async function deleteFromLibrary(filename: string) {
    if (!confirm(`确认删除「${filename}」？`)) return
    await fetch(`/api/teach/library/${encodeURIComponent(filename)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    await loadLibrary()
  }

  async function useFromLibrary(url: string, name: string) {
    setLibOpen(false)
    setStatusMsg('渲染中…')
    await loadAndRender(url)
    socket.emit('pdf-uploaded', { code, pdfUrl: url })
    setStatusMsg(name)
  }

  // ── PDF render ───────────────────────────────────────────────────
  async function loadAndRender(pdfUrl: string) {
    if (deckRef.current) { deckRef.current.destroy(); deckRef.current = null }
    if (!slidesRef.current || !revealRef.current) return

    slidesRef.current.innerHTML = ''
    setHasPDF(false)

    // Wait for pdfjsLib to be available (CDN load)
    for (let i = 0; i < 30 && typeof pdfjsLib === 'undefined'; i++) {
      await new Promise(r => setTimeout(r, 200))
    }
    if (typeof pdfjsLib === 'undefined') { setStatusMsg('pdf.js 加载失败'); return }

    pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js'

    const pdfDoc  = await pdfjsLib.getDocument(pdfUrl).promise
    const dpr     = window.devicePixelRatio || 1
    const renderMul = Math.max(dpr, 3)   // 至少3倍超采样，保证放大后清晰
    const areaEl  = revealRef.current.parentElement!
    const areaW   = areaEl.clientWidth  || window.innerWidth
    const areaH   = (areaEl.clientHeight > 48 ? areaEl.clientHeight : window.innerHeight - 48)

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

    // Wait for Reveal
    for (let i = 0; i < 30 && typeof Reveal === 'undefined'; i++) {
      await new Promise(r => setTimeout(r, 200))
    }

    const deck = new Reveal(revealRef.current, {
      width: slideW, height: slideH,
      margin: 0, minScale: 1, maxScale: 1,
      controls: true, progress: true, keyboard: true,
      touch: false, embedded: true, hash: false,
      transition: 'slide', backgroundTransition: 'none',
    })
    await deck.initialize()
    deckRef.current = deck

    deck.on('slidechanged', (e) => {
      const { indexh, indexv } = e as { indexh: number; indexv: number }
      socket.emit('slide-change', { code, indexh, indexv })
    })

    setHasPDF(true)
    setZoomLevel(1.0)
    setStatusMsg(`已加载 ${pdfDoc.numPages} 页`)
    setupCanvas(slideW, slideH)
  }

  // ── Zoom ─────────────────────────────────────────────────────────
  function applyZoom(z: number) {
    const level = Math.max(0.5, Math.min(2.0, Math.round(z * 10) / 10))
    setZoomLevel(level)
    if (revealRef.current) {
      revealRef.current.style.transform      = `scale(${level})`
      revealRef.current.style.transformOrigin = 'center center'
    }
    socket.emit('zoom-change', { code, zoom: level })
  }

  // ── Canvas / drawing ──────────────────────────────────────────────
  const setupCanvas = useCallback((w: number, h: number) => {
    if (!canvasRef.current) return
    canvasRef.current.width  = w
    canvasRef.current.height = h
    canvasRef.current.style.width  = w + 'px'
    canvasRef.current.style.height = h + 'px'
    historyRef.current = []
    setHistLen(0)
  }, [])

  function handleAreaMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (activeTool !== 'laser') return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width
    const y = (e.clientY - rect.top)  / rect.height
    socket.emit('laser-move', { code, x, y })
    // Show laser dot locally for teacher too
    const dot = document.getElementById('laser-dot')
    if (dot) {
      dot.style.left = e.clientX + 'px'
      dot.style.top  = e.clientY + 'px'
      dot.classList.add('visible')
    }
  }

  function handleAreaMouseLeave() {
    if (activeTool === 'laser') {
      socket.emit('laser-hide', { code })
      document.getElementById('laser-dot')?.classList.remove('visible')
    }
  }

  function handleCanvasMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    if (activeTool === 'pointer' || activeTool === 'laser') return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    pushHistory()
    socket.emit('draw-stroke-start', { code })
    if (activeTool === 'rect') {
      rectStartRef.current = { x, y }
    } else {
      drawingRef.current = true
      lastPosRef.current = { x, y }
    }
  }

  function handleCanvasMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    const rect2 = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect2.left
    const y = e.clientY - rect2.top

    if (activeTool === 'rect' && rectStartRef.current) {
      if (!canvasRef.current) return
      const ctx  = canvasRef.current.getContext('2d')!
      const prev = peekHistory()
      if (prev) ctx.putImageData(prev, 0, 0)
      ctx.beginPath()
      ctx.strokeStyle = '#f59e0b'
      ctx.lineWidth   = 2.5
      ctx.setLineDash([6, 3])
      ctx.strokeRect(
        rectStartRef.current.x, rectStartRef.current.y,
        x - rectStartRef.current.x, y - rectStartRef.current.y
      )
      ctx.setLineDash([])
      return
    }

    if (!drawingRef.current || !canvasRef.current) return
    const ctx = canvasRef.current.getContext('2d')!

    if (activeTool === 'eraser') {
      ctx.clearRect(x - 20, y - 20, 40, 40)
    } else if (lastPosRef.current) {
      ctx.beginPath()
      ctx.strokeStyle = '#ef4444'
      ctx.lineWidth   = 2.5
      ctx.lineCap     = 'round'
      ctx.moveTo(lastPosRef.current.x, lastPosRef.current.y)
      ctx.lineTo(x, y)
      ctx.stroke()
      const data = { fromX: lastPosRef.current.x, fromY: lastPosRef.current.y, toX: x, toY: y, color: '#ef4444', lineWidth: 2.5 }
      socket.emit('draw-event', { code, data })
    }
    lastPosRef.current = { x, y }
  }

  function handleCanvasMouseUp(e: React.MouseEvent<HTMLCanvasElement>) {
    if (activeTool === 'rect' && rectStartRef.current) {
      if (!canvasRef.current) return
      const rect2 = e.currentTarget.getBoundingClientRect()
      const x = e.clientX - rect2.left
      const y = e.clientY - rect2.top
      const data = {
        x: rectStartRef.current.x, y: rectStartRef.current.y,
        w: x - rectStartRef.current.x, h: y - rectStartRef.current.y,
        color: '#f59e0b', lineWidth: 2.5
      }
      socket.emit('draw-rect', { code, data })
      rectStartRef.current = null
      // push final canvas state for local undo
      pushHistory()
    } else {
      drawingRef.current = false
      lastPosRef.current = null
    }
  }

  function clearCanvas() {
    if (!canvasRef.current) return
    const ctx = canvasRef.current.getContext('2d')!
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
    historyRef.current = []
    setHistLen(0)
    socket.emit('draw-clear', { code })
  }

  function undoCanvas() {
    popHistory()
    socket.emit('draw-undo', { code })
  }

  function formatSize(bytes: number) {
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB'
    return (bytes / 1024 / 1024).toFixed(1) + ' MB'
  }

  const toolBtnCls = (t: Tool) =>
    `p-2 rounded-lg transition-all duration-150 text-sm
     ${activeTool === t
       ? 'bg-brand-600 text-white shadow-sm'
       : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700'}`

  return (
    <div className="page-full text-white" style={{ background: '#0f172a' }}>
      {/* Toolbar */}
      <header className="flex items-center justify-between px-4 h-12 bg-slate-900 border-b border-slate-800 shrink-0 z-50">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/dashboard')} className="text-slate-400 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-slate-800">
            <LogOut className="w-4 h-4" />
          </button>
          <div className="h-4 w-px bg-slate-700" />
          <span className="text-xs text-slate-500 uppercase tracking-wider font-mono">Room</span>
          <span className="font-mono text-brand-400 font-bold tracking-widest text-sm">{code}</span>
          <div className="flex items-center gap-1 text-xs text-slate-400">
            {connected ? <Wifi className="w-3.5 h-3.5 text-emerald-400" /> : <WifiOff className="w-3.5 h-3.5 text-red-400" />}
            <Users className="w-3.5 h-3.5" />
            <span className="font-mono">{viewerCount}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Drawing tools */}
          {hasPDF && (
            <div className="flex items-center gap-1 bg-slate-800 rounded-xl p-1">
              <button className={toolBtnCls('pointer')} onClick={() => setActiveTool('pointer')} title="指针"><Crosshair className="w-4 h-4" /></button>
              <button className={toolBtnCls('laser')}   onClick={() => setActiveTool('laser')}   title="激光笔"><span className="w-4 h-4 flex items-center justify-center text-red-400 font-bold text-xs">●</span></button>
              <button className={toolBtnCls('draw')}    onClick={() => setActiveTool('draw')}    title="画笔"><Pencil className="w-4 h-4" /></button>
              <button className={toolBtnCls('eraser')}  onClick={() => setActiveTool('eraser')}  title="橡皮"><Eraser className="w-4 h-4" /></button>
              <button className={toolBtnCls('rect')}    onClick={() => setActiveTool('rect')}    title="框选"><Square className="w-4 h-4" /></button>
              <div className="w-px h-4 bg-slate-600 mx-0.5" />
              <button
                onClick={undoCanvas}
                disabled={histLen === 0}
                className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 disabled:opacity-30 transition-all"
                title="撤销"
              >
                <Undo2 className="w-4 h-4" />
              </button>
              <button className="p-2 rounded-lg text-slate-400 hover:bg-slate-700 hover:text-white transition-all" onClick={clearCanvas} title="清除画板"><RotateCcw className="w-4 h-4" /></button>
            </div>
          )}

          {/* Zoom */}
          {hasPDF && (
            <div className="flex items-center gap-1 bg-slate-800 rounded-xl p-1">
              <button className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-all" onClick={() => applyZoom(zoomLevel - 0.1)}><ZoomOut className="w-4 h-4" /></button>
              <span className="text-xs font-mono text-slate-300 w-10 text-center">{Math.round(zoomLevel * 100)}%</span>
              <button className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-all" onClick={() => applyZoom(zoomLevel + 0.1)}><ZoomIn className="w-4 h-4" /></button>
              <button className="px-2 py-1 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-slate-700 transition-all" onClick={() => applyZoom(1.0)}>重置</button>
            </div>
          )}

          {/* File controls */}
          <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium cursor-pointer transition-all border border-slate-700">
            <Upload className="w-3.5 h-3.5" />
            快速上传
            <input type="file" accept=".pdf" className="hidden" onChange={e => { if (e.target.files?.[0]) handleQuickUpload(e.target.files[0]); e.target.value = '' }} />
          </label>
          <button
            onClick={openLibrary}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-700 hover:bg-brand-600 text-white text-xs font-medium transition-all"
          >
            <Library className="w-3.5 h-3.5" />
            教案库
          </button>
        </div>

        <div className="text-xs text-slate-500 font-mono truncate max-w-[180px]">{statusMsg}</div>
      </header>

      {/* Presentation area */}
      <div
        className="flex-1 relative overflow-hidden"
        style={{ cursor: activeTool === 'laser' ? 'none' : activeTool === 'draw' || activeTool === 'rect' ? 'crosshair' : 'default' }}
        onMouseMove={handleAreaMouseMove}
        onMouseLeave={handleAreaMouseLeave}
      >
        {/* Waiting state */}
        {!hasPDF && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8 z-10">
            <div className="w-20 h-20 rounded-3xl bg-slate-800 flex items-center justify-center mb-6 animate-pulse-ring">
              <Library className="w-10 h-10 text-brand-400" />
            </div>
            <h2 className="text-xl font-semibold text-slate-200 mb-2">选择教案开始演示</h2>
            <p className="text-slate-500 text-sm mb-6">点击「教案库」选择已上传的 PDF，或使用「快速上传」直接开始</p>
            <div className="flex gap-3">
              <label className="btn-secondary text-sm cursor-pointer">
                <Upload className="w-4 h-4" />
                {uploading ? '上传中…' : '快速上传'}
                <input type="file" accept=".pdf" className="hidden" onChange={e => { if (e.target.files?.[0]) handleQuickUpload(e.target.files[0]); e.target.value = '' }} />
              </label>
              <button onClick={openLibrary} className="btn-primary text-sm">
                <Library className="w-4 h-4" />
                打开教案库
              </button>
            </div>
          </div>
        )}

        {/* Reveal container */}
        <div
          ref={revealRef}
          className="reveal absolute inset-0 w-full h-full"
          style={{ display: hasPDF ? 'block' : 'none' }}
        >
          <div ref={slidesRef} className="slides" />
        </div>

        {/* Draw canvas overlay */}
        <canvas
          ref={canvasRef}
          id="draw-canvas"
          className={activeTool === 'draw' || activeTool === 'eraser' || activeTool === 'rect' ? 'drawing-mode' : ''}
          style={{
            display: hasPDF ? 'block' : 'none',
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            pointerEvents: activeTool !== 'pointer' && activeTool !== 'laser' ? 'auto' : 'none',
          }}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          onMouseLeave={handleCanvasMouseUp}
        />

        {/* Laser dot (rendered by socket events on student side; teacher sees their cursor) */}
        <div id="laser-dot" />

        {/* Slide nav hint */}
        {hasPDF && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-slate-900/80 backdrop-blur-sm rounded-full px-4 py-1.5 border border-slate-700">
            <ChevronLeft className="w-4 h-4 text-slate-400" />
            <span className="text-xs text-slate-400">键盘 ← → 翻页</span>
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </div>
        )}
      </div>

      {/* Library panel (slide-over) */}
      {libOpen && (
        <>
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40" onClick={() => setLibOpen(false)} />
          <div className="fixed top-0 right-0 h-full w-96 bg-slate-900 border-l border-slate-700 z-50 flex flex-col animate-slide-in shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
              <h3 className="font-semibold text-white">教案库</h3>
              <button onClick={() => setLibOpen(false)} className="text-slate-400 hover:text-white transition-colors">✕</button>
            </div>
            <div className="p-4 border-b border-slate-700 bg-slate-800/50">
              <label className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border-2 border-dashed border-slate-600 hover:border-brand-500 text-slate-400 hover:text-brand-400 cursor-pointer transition-all text-sm">
                <Upload className="w-4 h-4" />
                上传教案 (PDF)
                <input type="file" accept=".pdf" className="hidden" onChange={async e => {
                  if (!e.target.files?.[0]) return
                  const fd = new FormData()
                  fd.append('pdf', e.target.files[0])
                  await fetch('/api/teach/library/upload', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd })
                  await loadLibrary()
                  e.target.value = ''
                }} />
              </label>
            </div>
            <div className="flex-1 overflow-y-auto">
              {libFiles.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-slate-500 text-sm">
                  <Library className="w-8 h-8 mb-2 opacity-40" />
                  暂无教案，请先上传
                </div>
              ) : (
                libFiles.map(f => (
                  <div key={f.name} className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-800 hover:bg-slate-800 transition-colors group">
                    <div className="w-9 h-9 rounded-xl bg-slate-700 flex items-center justify-center shrink-0">
                      <span className="text-xs text-slate-300">PDF</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-200 truncate font-medium">{f.name}</p>
                      <p className="text-xs text-slate-500">{formatSize(f.size)}</p>
                    </div>
                    <button
                      onClick={() => useFromLibrary(f.url, f.name)}
                      className="px-3 py-1.5 rounded-lg bg-brand-700 hover:bg-brand-600 text-white text-xs font-semibold transition-colors opacity-0 group-hover:opacity-100"
                    >
                      使用
                    </button>
                    <button
                      onClick={() => deleteFromLibrary(f.name)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-900/30 transition-colors opacity-0 group-hover:opacity-100"
                      title="删除"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
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
