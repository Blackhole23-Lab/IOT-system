<?php
/**
 * 首页 - 引导到登录或控制面板
 */
require_once 'includes/config.php';
require_once 'includes/auth.php';
require_once 'includes/functions.php';

// 如果已登录，跳转到控制面板
if (isLoggedIn()) {
    redirect('dashboard.php');
}
?>
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>在线考试系统</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
</head>
<body class="bg-light">
    <div class="container">
        <div class="row justify-content-center mt-5">
            <div class="col-md-8 text-center">
                <h1 class="display-4 mb-4">在线考试系统</h1>
                <p class="lead mb-4">欢迎使用在线考试系统，请登录或注册账号</p>
                <div class="d-grid gap-2 d-md-flex justify-content-md-center">
                    <a href="login.php" class="btn btn-primary btn-lg">登录</a>
                    <a href="register.php" class="btn btn-outline-secondary btn-lg">注册</a>
                </div>
                <div class="mt-5 text-muted">
                    <small>默认管理员账号：admin / admin123</small>
                </div>
            </div>
        </div>
    </div>
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
</body>
</html>
