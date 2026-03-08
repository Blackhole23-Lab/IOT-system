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
let pendingSlide = null;

socket.on('connect', () => {
  document.getElementById('connection-status').textContent = '已连接';
  document.getElementById('connection-status').classList.add('connected');
  socket.emit('join-room', { roomCode, role: 'viewer' });
});

socket.on('disconnect', () => {
  document.getElementById('connection-status').textContent = '已断开';
  document.getElementById('connection-status').classList.remove('connected');
});

socket.on('current-state', ({ pdfUrl, currentSlide, currentZoom, viewerCount }) => {
  document.getElementById('viewer-count').textContent = viewerCount;
  if (pdfUrl) {
    document.getElementById('waiting-message').textContent = '加载教案中...';
    renderPDF(pdfUrl, currentSlide).then(() => {
      if (currentZoom && currentZoom !== 1.0) applyZoom(currentZoom);
    });
  }
});

socket.on('room-status', ({ viewerCount }) => {
  document.getElementById('viewer-count').textContent = viewerCount;
});

socket.on('pdf-loaded', ({ pdfUrl }) => {
  renderPDF(pdfUrl, 0);
});

socket.on('slide-change', ({ indexh, indexv }) => {
  if (deck) {
    deck.slide(indexh, indexv);
  } else {
    pendingSlide = { indexh, indexv };
  }
});

// Laser dot
const laserDot = document.getElementById('laser-dot');

socket.on('laser-move', ({ x, y }) => {
  const area = document.getElementById('presentation-area');
  const rect = area.getBoundingClientRect();
  laserDot.style.left = (rect.left + x * rect.width) + 'px';
  laserDot.style.top = (rect.top + y * rect.height) + 'px';
  laserDot.classList.add('visible');
});

socket.on('laser-hide', () => {
  laserDot.classList.remove('visible');
});

socket.on('zoom-change', ({ zoom }) => {
  applyZoom(zoom);
});

function applyZoom(zoom) {
  const container = document.getElementById('reveal-container');
  container.style.transform = `scale(${zoom})`;
  container.style.transformOrigin = 'center center';
}

async function renderPDF(pdfUrl, startSlide = 0) {
  if (deck) {
    deck.destroy();
    deck = null;
  }
  pendingSlide = null;

  const container = document.getElementById('reveal-container');
  const slidesContainer = document.getElementById('slides-container');
  slidesContainer.innerHTML = '';

  // Show area first so measurements are accurate
  document.getElementById('waiting-area').style.display = 'none';
  document.getElementById('presentation-area').style.display = 'block';

  const pdfDoc = await pdfjsLib.getDocument(pdfUrl).promise;
  const numPages = pdfDoc.numPages;

  // Measure available area
  const areaEl = document.getElementById('presentation-area');
  const areaW = areaEl.clientWidth || window.innerWidth;
  const areaH = areaEl.clientHeight || (window.innerHeight - 40);
  const dpr = window.devicePixelRatio || 1;

  // Use page 1 natural size as Reveal's slide dimensions
  const firstPage = await pdfDoc.getPage(1);
  const naturalVP = firstPage.getViewport({ scale: 1 });
  const slideW = naturalVP.width;
  const slideH = naturalVP.height;

  // Scale to fit area at 95%
  const scale = Math.min(areaW / slideW, areaH / slideH) * 0.95;

  // Render all pages sequentially
  for (let i = 1; i <= numPages; i++) {
    const page = await pdfDoc.getPage(i);
    const viewport = page.getViewport({ scale: scale * dpr });

    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    canvas.style.width = (viewport.width / dpr) + 'px';
    canvas.style.height = (viewport.height / dpr) + 'px';

    const ctx = canvas.getContext('2d');
    await page.render({ canvasContext: ctx, viewport }).promise;

    const section = document.createElement('section');
    section.appendChild(canvas);
    slidesContainer.appendChild(section);
  }

  // Tell Reveal the natural page size — it centers slides automatically
  const displayW = Math.round(slideW * scale);
  const displayH = Math.round(slideH * scale);

  deck = new Reveal(container, {
    width: displayW,
    height: displayH,
    margin: 0,
    minScale: 1,
    maxScale: 1,
    controls: false,
    progress: false,
    keyboard: false,
    touch: false,
    embedded: false,
    hash: false,
    transition: 'none',
    backgroundTransition: 'none'
  });

  await deck.initialize();

  // Apply pending or start slide
  const target = pendingSlide || { indexh: startSlide, indexv: 0 };
  deck.slide(target.indexh, target.indexv);
  pendingSlide = null;
}
