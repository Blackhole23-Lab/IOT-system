'use strict';
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const express    = require('express');
const http       = require('http');
const cors       = require('cors');
const path       = require('path');
const fs         = require('fs');

const { attachSockets } = require('./socket');
const authRouter         = require('./routes/auth');
const teachRouter        = require('./routes/teach');
const testRouter         = require('./routes/test');
const classroomsRouter   = require('./routes/classrooms');

const PORT      = process.env.PORT || 3000;
const NODE_ENV  = process.env.NODE_ENV || 'development';
const CLIENT_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';

const app    = express();
const server = http.createServer(app);

// ── CORS ──────────────────────────────────────────────────────────
const corsOptions = {
  origin: NODE_ENV === 'production' ? false : CLIENT_ORIGIN,
  credentials: true,
};
app.use(cors(corsOptions));

// ── Body parsing ──────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Static file uploads ───────────────────────────────────────────
const uploadsDir = path.join(__dirname, 'uploads');
const libraryDir = path.join(__dirname, 'library');
[uploadsDir, libraryDir].forEach(d => {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});
app.use('/uploads', express.static(uploadsDir));
app.use('/library', express.static(libraryDir));

// ── API routes ────────────────────────────────────────────────────
app.use('/api/auth',       authRouter);
app.use('/api/teach',      teachRouter);
app.use('/api/test',       testRouter);
app.use('/api/classrooms', classroomsRouter);

// ── Health ────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => res.json({ ok: true, env: NODE_ENV }));

// ── Production: serve React build ────────────────────────────────
if (NODE_ENV === 'production') {
  const clientDist = path.join(__dirname, '..', 'client', 'dist');
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// ── Socket.io ─────────────────────────────────────────────────────
attachSockets(server, corsOptions);

// ── Start ─────────────────────────────────────────────────────────
server.listen(PORT, '0.0.0.0', () => {
  const { networkInterfaces } = require('os');
  const nets = networkInterfaces();
  const ips  = Object.values(nets).flat()
    .filter(n => n.family === 'IPv4' && !n.internal)
    .map(n => `  外网: http://${n.address}:${PORT}`);
  console.log(`\n🚀  IOT-System Server (${NODE_ENV})`);
  console.log(`   本机: http://localhost:${PORT}`);
  ips.forEach(ip => console.log(ip));
  console.log('');
});
