'use strict';
const express = require('express');
const jwt     = require('jsonwebtoken');
const prisma  = require('../prisma/client');
const { requireAuth, adminOnly, getSecret } = require('../middleware/auth');

const router = express.Router();

function makeToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role, name: user.name, permissions: user.permissions },
    getSecret(),
    { expiresIn: '8h' }
  );
}

function safeUser(u) {
  return { id: u.id, username: u.username, role: u.role, name: u.name, email: u.email, createdAt: u.createdAt };
}

// GET /api/auth/me
router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) return res.status(401).json({ success: false, message: '用户不存在' });
    res.json({ success: true, user: { ...safeUser(user), permissions: user.permissions } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ success: false, message: '请输入用户名和密码' });

  try {
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user || user.password !== password)
      return res.status(401).json({ success: false, message: '用户名或密码错误' });

    res.json({
      success: true,
      token: makeToken(user),
      user: { ...safeUser(user), permissions: user.permissions },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { username, password, role, name, email } = req.body;
  if (!username || !password || !role)
    return res.status(400).json({ success: false, message: '请填写用户名、密码和角色' });
  if (!['teacher', 'student'].includes(role))
    return res.status(400).json({ success: false, message: '角色只能是 teacher 或 student' });
  if (username.length < 3 || username.length > 20)
    return res.status(400).json({ success: false, message: '用户名长度需在3-20字符之间' });
  if (password.length < 6)
    return res.status(400).json({ success: false, message: '密码长度至少6位' });

  try {
    const exists = await prisma.user.findUnique({ where: { username } });
    if (exists) return res.status(409).json({ success: false, message: '用户名已存在' });

    const displayName = name || (role === 'teacher' ? username + '老师' : username + '同学');
    const defaultPerms = role === 'teacher'
      ? '["teach:create","exam:grade","student:view_all"]'
      : '["exam:submit","attend:view_own"]';

    const newUser = await prisma.user.create({
      data: { username, password, role, name: displayName, email: email || '', permissions: defaultPerms },
    });

    res.json({
      success: true,
      message: '注册成功',
      token: makeToken(newUser),
      user: { ...safeUser(newUser), permissions: newUser.permissions },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/auth/students  (teacher/admin)
router.get('/students', requireAuth, async (req, res) => {
  try {
    const list = await prisma.user.findMany({
      where: { role: 'student' },
      select: { id: true, username: true, name: true, createdAt: true },
    });
    res.json({ success: true, students: list });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/auth/admin/users
router.get('/admin/users', adminOnly, async (_req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, username: true, name: true, role: true, email: true, createdAt: true, permissions: true },
    });
    res.json({ success: true, users });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/auth/admin/users
router.post('/admin/users', adminOnly, async (req, res) => {
  const { username, password, role, name, email } = req.body;
  if (!username || !password || !role)
    return res.status(400).json({ success: false, message: '请填写用户名、密码和角色' });
  if (!['teacher', 'student', 'admin'].includes(role))
    return res.status(400).json({ success: false, message: '角色无效' });

  try {
    const exists = await prisma.user.findUnique({ where: { username } });
    if (exists) return res.status(409).json({ success: false, message: '用户名已存在' });

    const displayName = name || (role === 'teacher' ? username + '老师' : role === 'student' ? username + '同学' : username);
    const defaultPerms = role === 'admin' ? '["*"]'
      : role === 'teacher' ? '["teach:create","exam:grade","student:view_all"]'
      : '["exam:submit","attend:view_own"]';

    const u = await prisma.user.create({
      data: { username, password, role, name: displayName, email: email || '', permissions: defaultPerms },
    });
    res.json({ success: true, user: safeUser(u) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/auth/admin/users/:username
router.put('/admin/users/:username', adminOnly, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { username: req.params.username } });
    if (!user) return res.status(404).json({ success: false, message: '用户不存在' });

    const { name, email, password, role } = req.body;
    const data = {};
    if (name !== undefined) data.name = name;
    if (email !== undefined) data.email = email;
    if (password && password.length >= 6) data.password = password;
    if (role && ['teacher', 'student', 'admin'].includes(role)) data.role = role;

    const updated = await prisma.user.update({ where: { username: req.params.username }, data });
    res.json({ success: true, user: safeUser(updated) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/auth/admin/users/:username
router.delete('/admin/users/:username', adminOnly, async (req, res) => {
  if (req.params.username === 'admin')
    return res.status(403).json({ success: false, message: '不可删除超级管理员' });

  try {
    const user = await prisma.user.findUnique({ where: { username: req.params.username } });
    if (!user) return res.status(404).json({ success: false, message: '用户不存在' });

    await prisma.user.delete({ where: { username: req.params.username } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
