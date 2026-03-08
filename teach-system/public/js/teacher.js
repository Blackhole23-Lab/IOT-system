import * as pdfjsLib from 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.9.155/pdf.min.mjs';
import Reveal from 'https://cdn.jsdelivr.net/npm/reveal.js@5.2.1/dist/reveal.esm.js';

pdfjsLib.GlobalWorkerOptions.workerSrc =
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.9.155/pdf.worker.min.mjs';

const params = new URLSearchParams(location.search);
const roomCode = params.get('room') || '';

if (!roomCode) {
  alert('缺少房间码，请从首页进入');
  location.href = '/';
}

document.getElementById('room-code-display').textContent = roomCode;

const socket = io();
let deck = null;
let zoomLevel = 1.0;
const ZOOM_STEP = 0.1;
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 2.0;

socket.emit('join-room', { roomCode, role: 'teacher' });

socket.on('current-state', ({ viewerCount }) => {
  document.getElementById('viewer-count').textContent = viewerCount;
});

socket.on('room-status', ({ viewerCount }) => {
  document.getElementById('viewer-count').textContent = viewerCount;
});

// ── Zoom ─────────────────────────────────────────────────────────────────────
document.getElementById('btn-zoom-in').addEventListener('click', () => applyZoom(zoomLevel + ZOOM_STEP));
document.getElementById('btn-zoom-out').addEventListener('click', () => applyZoom(zoomLevel - ZOOM_STEP));
document.getElementById('btn-zoom-reset').addEventListener('click', () => applyZoom(1.0));

function applyZoom(level) {
  zoomLevel = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(level * 10) / 10));
  const container = document.getElementById('reveal-container');
  container.style.transform = `scale(${zoomLevel})`;
  container.style.transformOrigin = 'center center';
  document.getElementById('zoom-label').textContent = Math.round(zoomLevel * 100) + '%';
  socket.emit('zoom-change', { roomCode, zoom: zoomLevel });
}

// ── Library panel ─────────────────────────────────────────────────────────────
const panel = document.getElementById('library-panel');
const overlay = document.getElementById('library-overlay');

document.getElementById('btn-library').addEventListener('click', () => {
  panel.classList.add('open');
  overlay.classList.add('show');
  loadLibrary();
});

function closePanel() {
  panel.classList.remove('open');
  overlay.classList.remove('show');
}

document.getElementById('btn-close-library').addEventListener('click', closePanel);
overlay.addEventListener('click', closePanel);

// Upload to library
document.getElementById('lib-file-input').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const status = document.getElementById('lib-upload-status');
  status.textContent = '上传中...';
  status.className = '';

  const formData = new FormData();
  formData.append('pdf', file);

  try {
    const res = await fetch('/api/library/upload', { method: 'POST', body: formData });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    status.textContent = '✓ 已保存';
    status.className = 'ok';
    await loadLibrary();
  } catch (err) {
    status.textContent = '❌ ' + err.message;
    status.className = 'err';
  }

  e.target.value = '';
});

async function loadLibrary() {
  const list = document.getElementById('library-list');
  list.innerHTML = '<div class="lib-loading">加载中...</div>';

  try {
    const res = await fetch('/api/library');
    const data = await res.json();

    if (!data.files.length) {
      list.innerHTML = '<div class="lib-empty">暂无教案，请先上传</div>';
      return;
    }

    list.innerHTML = '';
    data.files.forEach(file => {
      const item = document.createElement('div');
      item.className = 'lib-item';
      item.innerHTML = `
        <div class="lib-item-info" title="${file.name}">
          <span class="lib-icon">📄</span>
          <div class="lib-meta">
            <div class="lib-name">${file.name}</div>
            <div class="lib-size">${formatSize(file.size)} · ${formatDate(file.mtime)}</div>
          </div>
        </div>
        <div class="lib-item-actions">
          <button class="lib-btn lib-btn-use" data-url="${file.url}" data-name="${file.name}">使用</button>
          <button class="lib-btn lib-btn-del" data-name="${file.name}">删除</button>
        </div>
      `;
      list.appendChild(item);
    });

    // Use
    list.querySelectorAll('.lib-btn-use').forEach(btn => {
      btn.addEventListener('click', async () => {
        const pdfUrl = btn.dataset.url;
        const name = btn.dataset.name;
        closePanel();
        document.getElementById('upload-status').textContent = '渲染中...';
        try {
          await renderPDF(pdfUrl);
          socket.emit('pdf-uploaded', { roomCode, pdfUrl });
          document.getElementById('upload-status').textContent = '✓ ' + name;
        } catch (err) {
          document.getElementById('upload-status').textContent = '❌ ' + err.message;
          console.error(err);
        }
      });
    });

    // Delete
    list.querySelectorAll('.lib-btn-del').forEach(btn => {
      btn.addEventListener('click', async () => {
        const name = btn.dataset.name;
        if (!confirm(`确认删除「${name}」？`)) return;
        await fetch('/api/library/' + encodeURIComponent(name), { method: 'DELETE' });
        await loadLibrary();
      });
    });

  } catch (err) {
    list.innerHTML = `<div class="lib-empty">加载失败：${err.message}</div>`;
  }
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB';
  return (bytes / 1024 / 1024).toFixed(1) + ' MB';
}

function formatDate(iso) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// ── PDF render ────────────────────────────────────────────────────────────────
async function renderPDF(pdfUrl) {
  if (deck) {
    deck.destroy();
    deck = null;
  }

  zoomLevel = 1.0;
  const container = document.getElementById('reveal-container');
  const slidesContainer = document.getElementById('slides-container');
  slidesContainer.innerHTML = '';
  container.style.transform = '';

  document.getElementById('waiting-area').style.display = 'none';
  document.getElementById('presentation-area').style.display = 'block';

  const pdfDoc = await pdfjsLib.getDocument(pdfUrl).promise;
  const numPages = pdfDoc.numPages;

  const areaEl = document.getElementById('presentation-area');
  const areaW = areaEl.clientWidth || window.innerWidth;
  const areaH = areaEl.clientHeight || (window.innerHeight - 40);
  const dpr = window.devicePixelRatio || 1;

  const firstPage = await pdfDoc.getPage(1);
  const naturalVP = firstPage.getViewport({ scale: 1 });
  const slideW = naturalVP.width;
  const slideH = naturalVP.height;
  const scale = Math.min(areaW / slideW, areaH / slideH) * 0.95;

  for (let i = 1; i <= numPages; i++) {
    const page = await pdfDoc.getPage(i);
    const viewport = page.getViewport({ scale: scale * dpr });

    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    canvas.style.width = (viewport.width / dpr) + 'px';
    canvas.style.height = (viewport.height / dpr) + 'px';

    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;

    const section = document.createElement('section');
    section.appendChild(canvas);
    slidesContainer.appendChild(section);
  }

  const displayW = Math.round(slideW * scale);
  const displayH = Math.round(slideH * scale);

  deck = new Reveal(container, {
    width: displayW, height: displayH,
    margin: 0, minScale: 1, maxScale: 1,
    controls: true, progress: true, keyboard: true, touch: true,
    embedded: false, hash: false, transition: 'none', backgroundTransition: 'none'
  });

  await deck.initialize();

  deck.on('slidechanged', ({ indexh, indexv }) => {
    socket.emit('slide-change', { roomCode, indexh, indexv });
  });

  document.getElementById('zoom-controls').style.display = 'flex';
  document.getElementById('zoom-label').textContent = '100%';

  setupLaser();
}

// ── Laser ─────────────────────────────────────────────────────────────────────
let laserActive = false;
let lastLaserTime = 0;

function setupLaser() {
  const area = document.getElementById('presentation-area');

  area.addEventListener('mousemove', (e) => {
    const now = Date.now();
    if (now - lastLaserTime < 33) return;
    lastLaserTime = now;
    const rect = area.getBoundingClientRect();
    socket.emit('laser-move', {
      roomCode,
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height
    });
    laserActive = true;
  });

  area.addEventListener('mouseleave', () => {
    if (laserActive) {
      socket.emit('laser-hide', { roomCode });
      laserActive = false;
    }
  });
}
