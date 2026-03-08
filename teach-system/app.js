const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Directories
const uploadsDir = path.join(__dirname, 'uploads');
const libraryDir = path.join(__dirname, 'library');
[uploadsDir, libraryDir].forEach(d => {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

// Fix Chinese filenames: browser sends UTF-8 bytes as latin1
function decodeFilename(name) {
  try {
    const decoded = Buffer.from(name, 'latin1').toString('utf8');
    return /[\x80-\xFF]/.test(name) ? decoded : name;
  } catch {
    return name;
  }
}

// Multer for quick upload (temp, timestamped)
const tempStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const name = decodeFilename(file.originalname);
    cb(null, Date.now() + '-' + name);
  }
});

// Multer for library (preserves Chinese name, avoids overwrite)
const libraryStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, libraryDir),
  filename: (req, file, cb) => {
    const name = decodeFilename(file.originalname);
    let filename = name;
    let counter = 1;
    while (fs.existsSync(path.join(libraryDir, filename))) {
      const ext = path.extname(name);
      const base = path.basename(name, ext);
      filename = `${base}(${counter})${ext}`;
      counter++;
    }
    cb(null, filename);
  }
});

function pdfFilter(req, file, cb) {
  const name = decodeFilename(file.originalname);
  if (path.extname(name).toLowerCase() === '.pdf') {
    cb(null, true);
  } else {
    cb(new Error('仅支持 PDF 文件'));
  }
}

const uploadTemp = multer({ storage: tempStorage, limits: { fileSize: 50 * 1024 * 1024 }, fileFilter: pdfFilter });
const uploadLib  = multer({ storage: libraryStorage, limits: { fileSize: 50 * 1024 * 1024 }, fileFilter: pdfFilter });

// In-memory room state
const rooms = new Map();

function getOrCreateRoom(roomCode) {
  if (!rooms.has(roomCode)) {
    rooms.set(roomCode, {
      roomCode,
      pdfUrl: null,
      currentSlide: 0,
      currentZoom: 1.0,
      teacherSocketId: null,
      viewerCount: 0
    });
  }
  return rooms.get(roomCode);
}

// Static files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(uploadsDir));
app.use('/library', express.static(libraryDir));

// --- API: Library ---

// List library files
app.get('/api/library', (req, res) => {
  try {
    const files = fs.readdirSync(libraryDir)
      .filter(f => f.toLowerCase().endsWith('.pdf'))
      .map(name => {
        const stat = fs.statSync(path.join(libraryDir, name));
        return { name, url: '/library/' + encodeURIComponent(name), size: stat.size, mtime: stat.mtime.toISOString() };
      })
      .sort((a, b) => new Date(b.mtime) - new Date(a.mtime));
    res.json({ success: true, files });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Upload to library
app.post('/api/library/upload', (req, res) => {
  uploadLib.single('pdf')(req, res, (err) => {
    if (err) return res.status(400).json({ success: false, error: err.message });
    if (!req.file) return res.status(400).json({ success: false, error: '未收到文件' });
    res.json({
      success: true,
      name: req.file.filename,
      url: '/library/' + encodeURIComponent(req.file.filename)
    });
  });
});

// Delete from library
app.delete('/api/library/:filename', (req, res) => {
  const filename = decodeURIComponent(req.params.filename);
  const filepath = path.resolve(libraryDir, filename);
  // Path traversal guard
  if (!filepath.startsWith(libraryDir + path.sep)) {
    return res.status(400).json({ success: false, error: '非法文件名' });
  }
  try {
    if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Quick upload (immediate use, temp dir)
app.post('/upload', (req, res) => {
  uploadTemp.single('pdf')(req, res, (err) => {
    if (err) return res.status(400).json({ success: false, error: err.message });
    if (!req.file) return res.status(400).json({ success: false, error: '未收到文件' });
    res.json({ success: true, pdfUrl: '/uploads/' + encodeURIComponent(req.file.filename) });
  });
});

// Page routes
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/teacher', (req, res) => res.sendFile(path.join(__dirname, 'public', 'teacher.html')));
app.get('/viewer', (req, res) => res.sendFile(path.join(__dirname, 'public', 'viewer.html')));

// Socket.io events
io.on('connection', (socket) => {
  socket.on('join-room', ({ roomCode, role }) => {
    const room = getOrCreateRoom(roomCode);
    socket.join(roomCode);
    socket.data.roomCode = roomCode;
    socket.data.role = role;

    if (role === 'teacher') {
      room.teacherSocketId = socket.id;
    } else if (role === 'viewer') {
      room.viewerCount++;
      io.to(roomCode).emit('room-status', { viewerCount: room.viewerCount });
    }

    socket.emit('current-state', {
      roomCode,
      pdfUrl: room.pdfUrl,
      currentSlide: room.currentSlide,
      currentZoom: room.currentZoom,
      viewerCount: room.viewerCount
    });
  });

  socket.on('pdf-uploaded', ({ roomCode, pdfUrl }) => {
    const room = rooms.get(roomCode);
    if (!room) return;
    room.pdfUrl = pdfUrl;
    room.currentSlide = 0;
    socket.to(roomCode).emit('pdf-loaded', { pdfUrl });
  });

  socket.on('slide-change', ({ roomCode, indexh, indexv }) => {
    const room = rooms.get(roomCode);
    if (!room) return;
    room.currentSlide = indexh;
    socket.to(roomCode).emit('slide-change', { indexh, indexv });
  });

  socket.on('laser-move', ({ roomCode, x, y }) => {
    socket.to(roomCode).emit('laser-move', { x, y });
  });

  socket.on('laser-hide', ({ roomCode }) => {
    socket.to(roomCode).emit('laser-hide', {});
  });

  socket.on('zoom-change', ({ roomCode, zoom }) => {
    const room = rooms.get(roomCode);
    if (!room) return;
    room.currentZoom = zoom;
    socket.to(roomCode).emit('zoom-change', { zoom });
  });

  socket.on('disconnect', () => {
    const { roomCode, role } = socket.data;
    if (!roomCode) return;
    const room = rooms.get(roomCode);
    if (!room) return;
    if (role === 'viewer') {
      room.viewerCount = Math.max(0, room.viewerCount - 1);
      io.to(roomCode).emit('room-status', { viewerCount: room.viewerCount });
    } else if (role === 'teacher') {
      room.teacherSocketId = null;
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  const { networkInterfaces } = require('os');
  const nets = networkInterfaces();
  const ips = Object.values(nets).flat()
    .filter(n => n.family === 'IPv4' && !n.internal)
    .map(n => `http://${n.address}:${PORT}`);
  console.log('教师演示系统已启动:');
  console.log(`  本机:   http://localhost:${PORT}`);
  ips.forEach(ip => console.log(`  外网:   ${ip}`));
});
