'use strict';
const express = require('express');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');

const router = express.Router();

// ── Attendance tracking ─────────────────────────────────────────────
// key: `${userId}_${roomCode}_${date}` → record (deduped per day per room)
const attendances = new Map();

// POST /api/teach/attend  { userId, username, roomCode }
router.post('/attend', (req, res) => {
  const { userId, username, roomCode } = req.body;
  if (!userId || !roomCode) return res.status(400).json({ success: false, error: '缺少必要字段' });
  const today = new Date().toISOString().slice(0, 10);
  const key   = `${userId}_${roomCode}_${today}`;
  if (!attendances.has(key)) {
    attendances.set(key, {
      id: key,
      userId,
      username: username || userId,
      roomCode,
      date: today,
      joinedAt: new Date().toISOString(),
    });
  }
  res.json({ success: true });
});

// GET /api/teach/attend/:userId
router.get('/attend/:userId', (req, res) => {
  const { userId } = req.params;
  const list = [...attendances.values()]
    .filter(a => a.userId === userId)
    .sort((a, b) => b.joinedAt.localeCompare(a.joinedAt));
  res.json({ success: true, attendances: list });
});

// GET /api/teach/attend  (teacher: all attendances)
router.get('/attend', (_req, res) => {
  const list = [...attendances.values()]
    .sort((a, b) => b.joinedAt.localeCompare(a.joinedAt));
  res.json({ success: true, attendances: list });
});

// GET /api/teach/rooms/generate?type=teach|test  (server generates a room code)
router.get('/rooms/generate', (req, res) => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  res.json({ success: true, code });
});

const uploadsDir = path.join(__dirname, '..', 'uploads');
const libraryDir = path.join(__dirname, '..', 'library');

// Fix Chinese filenames (browser sends UTF-8 bytes as latin1 in some clients)
function decodeFilename(name) {
  try {
    const decoded = Buffer.from(name, 'latin1').toString('utf8');
    return /[\x80-\xFF]/.test(name) ? decoded : name;
  } catch {
    return name;
  }
}

function pdfFilter(req, file, cb) {
  const name = decodeFilename(file.originalname);
  if (path.extname(name).toLowerCase() === '.pdf') {
    cb(null, true);
  } else {
    cb(new Error('仅支持 PDF 文件'));
  }
}

const tempStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const name = decodeFilename(file.originalname);
    cb(null, Date.now() + '-' + name);
  },
});

const libStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, libraryDir),
  filename: (_req, file, cb) => {
    const name = decodeFilename(file.originalname);
    let filename = name;
    let counter  = 1;
    while (fs.existsSync(path.join(libraryDir, filename))) {
      const ext  = path.extname(name);
      const base = path.basename(name, ext);
      filename   = `${base}(${counter})${ext}`;
      counter++;
    }
    cb(null, filename);
  },
});

const uploadTemp = multer({ storage: tempStorage, limits: { fileSize: 50 * 1024 * 1024 }, fileFilter: pdfFilter });
const uploadLib  = multer({ storage: libStorage,  limits: { fileSize: 50 * 1024 * 1024 }, fileFilter: pdfFilter });

// GET /api/teach/library
router.get('/library', (_req, res) => {
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

// POST /api/teach/library/upload
router.post('/library/upload', (req, res) => {
  uploadLib.single('pdf')(req, res, (err) => {
    if (err) return res.status(400).json({ success: false, error: err.message });
    if (!req.file) return res.status(400).json({ success: false, error: '未收到文件' });
    res.json({
      success: true,
      name: req.file.filename,
      url: '/library/' + encodeURIComponent(req.file.filename),
    });
  });
});

// DELETE /api/teach/library/:filename
router.delete('/library/:filename', (req, res) => {
  const filename = decodeURIComponent(req.params.filename);
  const filepath = path.resolve(libraryDir, filename);
  // Path traversal guard
  if (!filepath.startsWith(libraryDir + path.sep) && filepath !== libraryDir) {
    return res.status(400).json({ success: false, error: '非法文件名' });
  }
  try {
    if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/teach/upload  (quick upload, temp)
router.post('/upload', (req, res) => {
  uploadTemp.single('pdf')(req, res, (err) => {
    if (err) return res.status(400).json({ success: false, error: err.message });
    if (!req.file) return res.status(400).json({ success: false, error: '未收到文件' });
    res.json({ success: true, pdfUrl: '/uploads/' + encodeURIComponent(req.file.filename) });
  });
});

// GET /api/teach/rooms/:code  (check if a room exists)
router.get('/rooms/:code', (req, res) => {
  const { getRoom } = require('../socket');
  const room = getRoom(req.params.code.toUpperCase());
  if (room) {
    res.json({ success: true, exists: true, type: room.type, viewerCount: room.viewers.size });
  } else {
    res.json({ success: true, exists: false });
  }
});

module.exports = router;
