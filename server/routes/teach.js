'use strict';
const express = require('express');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const prisma  = require('../prisma/client');
const { requireAuth, teacherOnly } = require('../middleware/auth');

const router = express.Router();

// ── POST /api/teach/attend ────────────────────────────────────────────────────
router.post('/attend', requireAuth, async (req, res) => {
  const { roomCode } = req.body;
  const userId = req.user.id;
  if (!roomCode) return res.status(400).json({ success: false, error: '缺少必要字段' });

  const today = new Date().toISOString().slice(0, 10);
  try {
    await prisma.attendance.upsert({
      where: { userId_roomCode_date: { userId, roomCode, date: today } },
      update: {},
      create: { userId, roomCode, date: today },
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/teach/attend/:userId
router.get('/attend/:userId', requireAuth, async (req, res) => {
  const targetId = req.params.userId;
  // Students can only see their own; teachers/admin can see any
  if (req.user.role === 'student' && req.user.id !== targetId) {
    return res.status(403).json({ success: false, error: '无权查看他人记录' });
  }
  try {
    const list = await prisma.attendance.findMany({
      where: { userId: targetId },
      include: { user: { select: { username: true, name: true } } },
      orderBy: { joinedAt: 'desc' },
    });
    const attendances = list.map(a => ({
      id: a.id, userId: a.userId, username: a.user.username,
      roomCode: a.roomCode, date: a.date, joinedAt: a.joinedAt.toISOString(),
    }));
    res.json({ success: true, attendances });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/teach/attend  (teacher sees all)
router.get('/attend', teacherOnly, async (_req, res) => {
  try {
    const list = await prisma.attendance.findMany({
      include: { user: { select: { username: true, name: true } } },
      orderBy: { joinedAt: 'desc' },
    });
    const attendances = list.map(a => ({
      id: a.id, userId: a.userId, username: a.user.username,
      roomCode: a.roomCode, date: a.date, joinedAt: a.joinedAt.toISOString(),
    }));
    res.json({ success: true, attendances });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/teach/rooms/generate
router.get('/rooms/generate', requireAuth, (req, res) => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  res.json({ success: true, code });
});

// ── PDF Upload ────────────────────────────────────────────────────────────────
const uploadsDir = path.join(__dirname, '..', 'uploads');
const libraryDir = path.join(__dirname, '..', 'library');

function decodeFilename(name) {
  try {
    const decoded = Buffer.from(name, 'latin1').toString('utf8');
    return /[\x80-\xFF]/.test(name) ? decoded : name;
  } catch {
    return name;
  }
}

function pdfFilter(req, file, cb) {
  // Accept by mimetype OR extension to handle browser inconsistencies
  const name = decodeFilename(file.originalname);
  const ext  = path.extname(name).toLowerCase();
  if (ext === '.pdf' || file.mimetype === 'application/pdf') {
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
      filename   = `${base}(${counter++})${ext}`;
    }
    cb(null, filename);
  },
});

const uploadTemp = multer({ storage: tempStorage, limits: { fileSize: 50 * 1024 * 1024 }, fileFilter: pdfFilter });
const uploadLib  = multer({ storage: libStorage,  limits: { fileSize: 50 * 1024 * 1024 }, fileFilter: pdfFilter });

// GET /api/teach/library
router.get('/library', requireAuth, (_req, res) => {
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
router.post('/library/upload', teacherOnly, (req, res) => {
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
router.delete('/library/:filename', teacherOnly, (req, res) => {
  const filename = decodeURIComponent(req.params.filename);
  const filepath = path.resolve(libraryDir, filename);
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

// POST /api/teach/upload  (quick upload, temp — fixed: also accepts library url response)
router.post('/upload', requireAuth, (req, res) => {
  uploadTemp.single('pdf')(req, res, (err) => {
    if (err) return res.status(400).json({ success: false, error: err.message });
    if (!req.file) return res.status(400).json({ success: false, error: '未收到文件' });
    const filename = req.file.filename;
    res.json({
      success: true,
      pdfUrl: '/uploads/' + encodeURIComponent(filename),
      // Also expose name/url fields matching library format so frontend can use either endpoint
      name: filename,
      url:  '/uploads/' + encodeURIComponent(filename),
    });
  });
});

// GET /api/teach/rooms/:code
router.get('/rooms/:code', requireAuth, (req, res) => {
  const { getRoom } = require('../socket');
  const room = getRoom(req.params.code.toUpperCase());
  if (room) {
    res.json({ success: true, exists: true, type: room.type, viewerCount: room.viewers.size });
  } else {
    res.json({ success: true, exists: false });
  }
});

module.exports = router;
