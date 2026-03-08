'use strict';
// RBAC middleware for IOT-System
const jwt = require('jsonwebtoken');

function getSecret() {
  return process.env.JWT_SECRET || 'dev_secret_change_in_production';
}

// Parse JWT and attach req.user
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: '未登录' });
  }
  try {
    req.user = jwt.verify(authHeader.slice(7), getSecret());
    next();
  } catch {
    res.status(401).json({ success: false, message: 'Token 已过期，请重新登录' });
  }
}

// Role guards
function teacherOnly(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: '需要教师权限' });
    }
    next();
  });
}

function studentOnly(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.role !== 'student') {
      return res.status(403).json({ success: false, message: '需要学生权限' });
    }
    next();
  });
}

function adminOnly(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: '需要管理员权限' });
    }
    next();
  });
}

// Permission check: user.permissions includes perm OR user has wildcard "*"
function hasPermission(user, perm) {
  try {
    const perms = JSON.parse(user.permissions || '[]');
    return perms.includes('*') || perms.includes(perm);
  } catch {
    return false;
  }
}

function requirePermission(perm) {
  return (req, res, next) => {
    requireAuth(req, res, () => {
      if (req.user.role === 'admin') return next(); // admin bypasses all
      if (!hasPermission(req.user, perm)) {
        return res.status(403).json({ success: false, message: `需要权限: ${perm}` });
      }
      next();
    });
  };
}

module.exports = { requireAuth, teacherOnly, studentOnly, adminOnly, requirePermission, hasPermission, getSecret };
