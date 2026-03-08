<?php
/**
 * 控制面板 - 根据角色显示不同内容
 */
require_once 'includes/config.php';
require_once 'includes/auth.php';
require_once 'includes/functions.php';

requireLogin();

$username = getCurrentUsername();
$role = $_SESSION['role'];
?>
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>控制面板 - 在线考试系统</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
</head>
<body>
    <nav class="navbar navbar-expand-lg navbar-dark bg-primary">
        <div class="container">
            <a class="navbar-brand" href="dashboard.php">在线考试系统</a>
            <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav">
                <span class="navbar-toggler-icon"></span>
            </button>
            <div class="collapse navbar-collapse" id="navbarNav">
                <ul class="navbar-nav ms-auto">
                    <li class="nav-item">
                        <span class="navbar-text text-white me-3">欢迎，<?= e($username) ?> (<?= $role === 'admin' ? '管理员' : '学生' ?>)</span>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link" href="logout.php">退出</a>
                    </li>
                </ul>
            </div>
        </div>
    </nav>

    <div class="container mt-4">
        <?php displayFlash(); ?>

        <h2 class="mb-4">控制面板</h2>

        <?php if (isAdmin()): ?>
            <!-- 管理员功能 -->
            <div class="row">
                <div class="col-md-4 mb-3">
                    <div class="card">
                        <div class="card-body text-center">
                            <h5 class="card-title">题库管理</h5>
                            <p class="card-text">添加、编辑、删除题目，批量导入题目</p>
                            <a href="admin/questions.php" class="btn btn-primary">进入题库</a>
                        </div>
                    </div>
                </div>

                <div class="col-md-4 mb-3">
                    <div class="card">
                        <div class="card-body text-center">
                            <h5 class="card-title">考试管理</h5>
                            <p class="card-text">创建考试、选择题目、设置时长</p>
                            <a href="admin/exams.php" class="btn btn-primary">管理考试</a>
                        </div>
                    </div>
                </div>

                <div class="col-md-4 mb-3">
                    <div class="card">
                        <div class="card-body text-center">
                            <h5 class="card-title">提交记录</h5>
                            <p class="card-text">查看所有学生的考试提交记录</p>
                            <a href="admin/submissions.php" class="btn btn-primary">查看记录</a>
                        </div>
                    </div>
                </div>

                <div class="col-md-4 mb-3">
                    <div class="card">
                        <div class="card-body text-center">
                            <h5 class="card-title">阅卷评分</h5>
                            <p class="card-text">对主观题进行人工评分和评语</p>
                            <a href="admin/submissions.php" class="btn btn-warning">去阅卷</a>
                        </div>
                    </div>
                </div>
            </div>

            <?php
            // 显示统计信息
            $db = getDB();
            $questionCount = $db->query("SELECT COUNT(*) as count FROM questions")->fetch()['count'];
            $examCount = $db->query("SELECT COUNT(*) as count FROM exams")->fetch()['count'];
            $studentCount = $db->query("SELECT COUNT(*) as count FROM users WHERE role = 'student'")->fetch()['count'];
            $submissionCount = $db->query("SELECT COUNT(*) as count FROM submissions")->fetch()['count'];
            ?>

            <div class="row mt-4">
                <div class="col-md-12">
                    <h4>系统统计</h4>
                    <table class="table table-bordered">
                        <tr>
                            <td><strong>题库题目数</strong></td>
                            <td><?= $questionCount ?></td>
                            <td><strong>考试数量</strong></td>
                            <td><?= $examCount ?></td>
                        </tr>
                        <tr>
                            <td><strong>学生人数</strong></td>
                            <td><?= $studentCount ?></td>
                            <td><strong>提交记录</strong></td>
                            <td><?= $submissionCount ?></td>
                        </tr>
                    </table>
                </div>
            </div>

        <?php else: ?>
            <!-- 学生功能 -->
            <div class="row">
                <div class="col-md-6 mb-3">
                    <div class="card">
                        <div class="card-body text-center">
                            <h5 class="card-title">参加考试</h5>
                            <p class="card-text">查看可参加的考试并开始答题</p>
                            <a href="student/exams.php" class="btn btn-primary">查看考试</a>
                        </div>
                    </div>
                </div>

                <div class="col-md-6 mb-3">
                    <div class="card">
                        <div class="card-body text-center">
                            <h5 class="card-title">我的成绩</h5>
                            <p class="card-text">查看已完成考试的成绩</p>
                            <a href="student/exams.php?view=results" class="btn btn-primary">查看成绩</a>
                        </div>
                    </div>
                </div>
            </div>

            <?php
            // 显示学生最近的考试记录
            $db = getDB();
            $userId = getCurrentUserId();
            $stmt = $db->prepare("
                SELECT s.*, e.title, e.total_score
                FROM submissions s
                JOIN exams e ON s.exam_id = e.id
                WHERE s.user_id = ?
                ORDER BY s.submitted_at DESC
                LIMIT 5
            ");
            $stmt->execute([$userId]);
            $recentSubmissions = $stmt->fetchAll();
            ?>

            <?php if (!empty($recentSubmissions)): ?>
                <div class="row mt-4">
                    <div class="col-md-12">
                        <h4>最近考试记录</h4>
                        <table class="table table-striped">
                            <thead>
                                <tr>
                                    <th>考试名称</th>
                                    <th>得分</th>
                                    <th>总分</th>
                                    <th>状态</th>
                                    <th>提交时间</th>
                                    <th>操作</th>
                                </tr>
                            </thead>
                            <tbody>
                                <?php foreach ($recentSubmissions as $sub): ?>
                                    <tr>
                                        <td><?= e($sub['title']) ?></td>
                                        <td><?= $sub['score'] ?></td>
                                        <td><?= $sub['total_score'] ?></td>
                                        <td>
                                            <?php if ($sub['status'] === 'completed'): ?>
                                                <span class="badge bg-success">已完成</span>
                                            <?php else: ?>
                                                <span class="badge bg-warning">待阅卷</span>
                                            <?php endif; ?>
                                        </td>
                                        <td><?= formatDateTime($sub['submitted_at']) ?></td>
                                        <td>
                                            <a href="student/exam_result.php?submission_id=<?= $sub['id'] ?>" class="btn btn-sm btn-outline-primary">详情</a>
                                        </td>
                                    </tr>
                                <?php endforeach; ?>
                            </tbody>
                        </table>
                    </div>
                </div>
            <?php endif; ?>

        <?php endif; ?>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
</body>
</html>
