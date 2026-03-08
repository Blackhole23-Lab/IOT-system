<?php
/**
 * 用户注册页面
 */
require_once 'includes/config.php';
require_once 'includes/auth.php';
require_once 'includes/functions.php';

// 如果已登录，跳转到控制面板
if (isLoggedIn()) {
    redirect('dashboard.php');
}

$errors = [];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $username = trim($_POST['username'] ?? '');
    $email = trim($_POST['email'] ?? '');
    $password = $_POST['password'] ?? '';
    $confirmPassword = $_POST['confirm_password'] ?? '';

    // 验证输入
    if (empty($username)) {
        $errors[] = '用户名不能为空';
    } elseif (strlen($username) < 3) {
        $errors[] = '用户名至少3个字符';
    }

    if (empty($email)) {
        $errors[] = '邮箱不能为空';
    } elseif (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        $errors[] = '邮箱格式不正确';
    }

    if (empty($password)) {
        $errors[] = '密码不能为空';
    } elseif (strlen($password) < 6) {
        $errors[] = '密码至少6个字符';
    }

    if ($password !== $confirmPassword) {
        $errors[] = '两次密码输入不一致';
    }

    // 检查用户名和邮箱是否已存在
    if (empty($errors)) {
        $db = getDB();
        $stmt = $db->prepare("SELECT COUNT(*) as count FROM users WHERE username = ? OR email = ?");
        $stmt->execute([$username, $email]);
        $result = $stmt->fetch();

        if ($result['count'] > 0) {
            $errors[] = '用户名或邮箱已被注册';
        }
    }

    // 注册用户
    if (empty($errors)) {
        $db = getDB();
        $stmt = $db->prepare("INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)");
        $hashedPassword = password_hash($password, PASSWORD_DEFAULT);

        if ($stmt->execute([$username, $email, $hashedPassword, 'student'])) {
            setFlash('success', '注册成功，请登录');
            redirect('login.php');
        } else {
            $errors[] = '注册失败，请重试';
        }
    }
}
?>
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>用户注册 - 在线考试系统</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
</head>
<body class="bg-light">
    <div class="container">
        <div class="row justify-content-center mt-5">
            <div class="col-md-6">
                <div class="card shadow">
                    <div class="card-body p-5">
                        <h2 class="text-center mb-4">用户注册</h2>

                        <?php if (!empty($errors)): ?>
                            <div class="alert alert-danger">
                                <ul class="mb-0">
                                    <?php foreach ($errors as $error): ?>
                                        <li><?= e($error) ?></li>
                                    <?php endforeach; ?>
                                </ul>
                            </div>
                        <?php endif; ?>

                        <form method="POST" action="">
                            <div class="mb-3">
                                <label for="username" class="form-label">用户名</label>
                                <input type="text" class="form-control" id="username" name="username"
                                       value="<?= e($_POST['username'] ?? '') ?>" required>
                            </div>

                            <div class="mb-3">
                                <label for="email" class="form-label">邮箱</label>
                                <input type="email" class="form-control" id="email" name="email"
                                       value="<?= e($_POST['email'] ?? '') ?>" required>
                            </div>

                            <div class="mb-3">
                                <label for="password" class="form-label">密码</label>
                                <input type="password" class="form-control" id="password" name="password" required>
                            </div>

                            <div class="mb-3">
                                <label for="confirm_password" class="form-label">确认密码</label>
                                <input type="password" class="form-control" id="confirm_password" name="confirm_password" required>
                            </div>

                            <div class="d-grid">
                                <button type="submit" class="btn btn-primary">注册</button>
                            </div>
                        </form>

                        <div class="text-center mt-3">
                            <a href="login.php">已有账号？立即登录</a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
</body>
</html>
