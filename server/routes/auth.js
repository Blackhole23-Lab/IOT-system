'use strict';
const express = require('express');
const jwt     = require('jsonwebtoken');

const router = express.Router();

// ── Persistent in-memory user store ──────────────────────────────
// key: username → user object
const USERS = new Map([
  ['teacher',  { id: 'u1', username: 'teacher',  password: 'teacher123', role: 'teacher', name: '王老师',   email: 'teacher@demo.com',  createdAt: '2026-01-01T00:00:00Z' }],
  ['teacher2', { id: 'u2', username: 'teacher2', password: 'teacher123', role: 'teacher', name: '李老师',   email: 'teacher2@demo.com', createdAt: '2026-01-01T00:00:00Z' }],
  ['student',  { id: 'u3', username: 'student',  password: 'student123', role: 'student', name: '张同学',   email: 'student@demo.com',  createdAt: '2026-01-01T00:00:00Z' }],
  ['student2', { id: 'u4', username: 'student2', password: 'student123', role: 'student', name: '李同学',   email: 'student2@demo.com', createdAt: '2026-01-01T00:00:00Z' }],
  ['admin',    { id: 'u5', username: 'admin',    password: 'admin123',   role: 'admin',   name: '系统管理员', email: 'admin@demo.com',    createdAt: '2026-01-01T00:00:00Z' }],
]);

let userIdCounter = 6;

function getSecret() {
  return process.env.JWT_SECRET || 'dev_secret_change_in_production';
}

function makeToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role, name: user.name },
    getSecret(),
    { expiresIn: '8h' }
  );
}

// GET /api/auth/me  (verify token)
router.get('/me', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: '未登录' });
  }
  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, getSecret());
    res.json({ success: true, user: payload });
  } catch {
    res.status(401).json({ success: false, message: 'Token 已过期，请重新登录' });
  }
});

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, message: '请输入用户名和密码' });
  }
  const user = USERS.get(username);
  if (!user || user.password !== password) {
    return res.status(401).json({ success: false, message: '用户名或密码错误' });
  }
  res.json({
    success: true,
    token: makeToken(user),
    user: { id: user.id, username: user.username, role: user.role, name: user.name },
  });
});

// POST /api/auth/register
router.post('/register', (req, res) => {
  const { username, password, role, name, email } = req.body;

  if (!username || !password || !role) {
    return res.status(400).json({ success: false, message: '请填写用户名、密码和角色' });
  }
  if (!['teacher', 'student'].includes(role)) {
    return res.status(400).json({ success: false, message: '角色只能是 teacher 或 student' });
  }
  if (username.length < 3 || username.length > 20) {
    return res.status(400).json({ success: false, message: '用户名长度需在3-20字符之间' });
  }
  if (password.length < 6) {
    return res.status(400).json({ success: false, message: '密码长度至少6位' });
  }
  if (USERS.has(username)) {
    return res.status(409).json({ success: false, message: '用户名已存在' });
  }

  const id = 'u' + (userIdCounter++);
  const displayName = name || (role === 'teacher' ? username + '老师' : username + '同学');
  const newUser = {
    id,
    username,
    password,
    role,
    name: displayName,
    email: email || '',
    createdAt: new Date().toISOString(),
  };
  USERS.set(username, newUser);

  res.json({
    success: true,
    message: '注册成功',
    token: makeToken(newUser),
    user: { id: newUser.id, username: newUser.username, role: newUser.role, name: newUser.name },
  });
});

// GET /api/auth/students  (teacher: list all student accounts)
router.get('/students', (req, res) => {
  const list = [...USERS.values()]
    .filter(u => u.role === 'student')
    .map(u => ({ id: u.id, username: u.username, name: u.name, createdAt: u.createdAt }));
  res.json({ success: true, students: list });
});

// ── Admin-only middleware ─────────────────────────────────────────
function requireAdmin(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: '未登录' });
  }
  try {
    const payload = require('jsonwebtoken').verify(authHeader.slice(7), getSecret());
    if (payload.role !== 'admin') {
      return res.status(403).json({ success: false, message: '需要管理员权限' });
    }
    req.admin = payload;
    next();
  } catch {
    return res.status(401).json({ success: false, message: 'Token 已过期' });
  }
}

// GET /api/auth/admin/users  — list all users
router.get('/admin/users', requireAdmin, (_req, res) => {
  const list = [...USERS.values()].map(u => ({
    id: u.id, username: u.username, name: u.name, role: u.role,
    email: u.email || '', createdAt: u.createdAt,
  }));
  res.json({ success: true, users: list });
});

// POST /api/auth/admin/users  — create user
router.post('/admin/users', requireAdmin, (req, res) => {
  const { username, password, role, name, email } = req.body;
  if (!username || !password || !role) {
    return res.status(400).json({ success: false, message: '请填写用户名、密码和角色' });
  }
  if (!['teacher', 'student', 'admin'].includes(role)) {
    return res.status(400).json({ success: false, message: '角色无效' });
  }
  if (USERS.has(username)) {
    return res.status(409).json({ success: false, message: '用户名已存在' });
  }
  const id = 'u' + (userIdCounter++);
  const displayName = name || (role === 'teacher' ? username + '老师' : role === 'student' ? username + '同学' : username);
  const newUser = { id, username, password, role, name: displayName, email: email || '', createdAt: new Date().toISOString() };
  USERS.set(username, newUser);
  res.json({ success: true, user: { id, username, name: displayName, role, email: newUser.email, createdAt: newUser.createdAt } });
});

// PUT /api/auth/admin/users/:username  — update user
router.put('/admin/users/:username', requireAdmin, (req, res) => {
  const user = USERS.get(req.params.username);
  if (!user) return res.status(404).json({ success: false, message: '用户不存在' });
  const { name, email, password, role } = req.body;
  if (name !== undefined) user.name = name;
  if (email !== undefined) user.email = email;
  if (password && password.length >= 6) user.password = password;
  if (role && ['teacher', 'student', 'admin'].includes(role)) user.role = role;
  USERS.set(req.params.username, user);
  res.json({ success: true, user: { id: user.id, username: user.username, name: user.name, role: user.role, email: user.email, createdAt: user.createdAt } });
});

// DELETE /api/auth/admin/users/:username  — delete user
router.delete('/admin/users/:username', requireAdmin, (req, res) => {
  const user = USERS.get(req.params.username);
  if (!user) return res.status(404).json({ success: false, message: '用户不存在' });
  if (req.params.username === 'admin') {
    return res.status(403).json({ success: false, message: '不可删除超级管理员' });
  }
  USERS.delete(req.params.username);
  res.json({ success: true });
});

// Export USERS for other modules to use (e.g., test routes for score storage)
module.exports = router;
module.exports.USERS = USERS;
