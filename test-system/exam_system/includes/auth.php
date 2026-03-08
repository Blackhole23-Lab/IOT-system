<?php
/**
 * 认证相关函数
 */

// 启动会话
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

/**
 * 检查用户是否已登录
 */
function isLoggedIn() {
    return isset($_SESSION['user_id']) && isset($_SESSION['username']);
}

/**
 * 检查是否为管理员
 */
function isAdmin() {
    return isLoggedIn() && $_SESSION['role'] === 'admin';
}

/**
 * 要求用户登录
 */
function requireLogin() {
    if (!isLoggedIn()) {
        header('Location: /exam_system/login.php');
        exit;
    }
}

/**
 * 要求管理员权限
 */
function requireAdmin() {
    requireLogin();
    if (!isAdmin()) {
        die('权限不足：需要管理员权限');
    }
}

/**
 * 登录用户
 */
function loginUser($userId, $username, $role) {
    $_SESSION['user_id'] = $userId;
    $_SESSION['username'] = $username;
    $_SESSION['role'] = $role;
    $_SESSION['login_time'] = time();
}

/**
 * 登出用户
 */
function logoutUser() {
    session_unset();
    session_destroy();
}

/**
 * 获取当前用户ID
 */
function getCurrentUserId() {
    return $_SESSION['user_id'] ?? null;
}

/**
 * 获取当前用户名
 */
function getCurrentUsername() {
    return $_SESSION['username'] ?? null;
}

/**
 * 生成CSRF令牌
 */
function generateCSRFToken() {
    if (!isset($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf_token'];
}

/**
 * 验证CSRF令牌
 */
function verifyCSRFToken($token) {
    return isset($_SESSION['csrf_token']) && hash_equals($_SESSION['csrf_token'], $token);
}
