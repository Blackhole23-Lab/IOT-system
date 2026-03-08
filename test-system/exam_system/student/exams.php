<?php
/**
 * 学生 - 考试列表和成绩查看
 */
require_once '../includes/config.php';
require_once '../includes/auth.php';
require_once '../includes/functions.php';

requireLogin();

$db = getDB();
$userId = getCurrentUserId();
$view = $_GET['view'] ?? 'exams';

// 获取所有可参加的考试
$exams = $db->query("SELECT e.*,
    (SELECT COUNT(*) FROM exam_questions WHERE exam_id = e.id) as question_count
    FROM exams e ORDER BY e.id DESC")->fetchAll();

// 获取学生的提交记录
$stmt = $db->prepare("
    SELECT s.*, e.title, e.total_score
    FROM submissions s
    JOIN exams e ON s.exam_id = e.id
    WHERE s.user_id = ?
    ORDER BY s.submitted_at DESC
");
$stmt->execute([$userId]);
$submissions = $stmt->fetchAll();

// 获取已提交的考试ID
$submittedExamIds = array_column($submissions, 'exam_id');
?>
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?= $view === 'results' ? '我的成绩' : '考试列表' ?> - 在线考试系统</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
</head>
<body>
    <nav class="navbar navbar-expand-lg navbar-dark bg-primary">
        <div class="container">
            <a class="navbar-brand" href="../dashboard.php">在线考试系统</a>
            <div class="navbar-nav ms-auto">
                <a class="nav-link" href="../dashboard.php">返回控制面板</a>
                <a class="nav-link" href="../logout.php">退出</a>
            </div>
        </div>
    </nav>

    <div class="container mt-4">
        <?php displayFlash(); ?>

        <ul class="nav nav-tabs mb-4">
            <li class="nav-item">
                <a class="nav-link <?= $view === 'exams' ? 'active' : '' ?>" href="?view=exams">可参加的考试</a>
            </li>
            <li class="nav-item">
                <a class="nav-link <?= $view === 'results' ? 'active' : '' ?>" href="?view=results">我的成绩</a>
            </li>
        </ul>

        <?php if ($view === 'exams'): ?>
            <!-- 考试列表 -->
            <h2 class="mb-4">可参加的考试</h2>

            <?php if (empty($exams)): ?>
                <div class="alert alert-info">暂无可参加的考试</div>
            <?php else: ?>
                <div class="row">
                    <?php foreach ($exams as $exam): ?>
                        <div class="col-md-6 mb-3">
                            <div class="card">
                                <div class="card-body">
                                    <h5 class="card-title"><?= e($exam['title']) ?></h5>
                                    <p class="card-text">
                                        <strong>题目数：</strong><?= $exam['question_count'] ?> 题<br>
                                        <strong>总分：</strong><?= $exam['total_score'] ?> 分<br>
                                        <strong>时长：</strong><?= $exam['duration'] ?> 分钟<br>
                                        <strong>创建时间：</strong><?= formatDateTime($exam['created_at']) ?>
                                    </p>

                                    <?php if (in_array($exam['id'], $submittedExamIds)): ?>
                                        <button class="btn btn-secondary" disabled>已完成</button>
                                    <?php else: ?>
                                        <a href="take_exam.php?exam_id=<?= $exam['id'] ?>" class="btn btn-primary"
                                           onclick="return confirm('确定开始考试吗？考试开始后将计时，请确保网络稳定。')">
                                            开始考试
                                        </a>
                                    <?php endif; ?>
                                </div>
                            </div>
                        </div>
                    <?php endforeach; ?>
                </div>
            <?php endif; ?>

        <?php else: ?>
            <!-- 成绩列表 -->
            <h2 class="mb-4">我的成绩</h2>

            <?php if (empty($submissions)): ?>
                <div class="alert alert-info">暂无考试记录</div>
            <?php else: ?>
                <table class="table table-striped">
                    <thead>
                        <tr>
                            <th>考试名称</th>
                            <th>得分</th>
                            <th>总分</th>
                            <th>得分率</th>
                            <th>状态</th>
                            <th>提交时间</th>
                            <th>操作</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php foreach ($submissions as $sub): ?>
                            <tr>
                                <td><?= e($sub['title']) ?></td>
                                <td><?= $sub['score'] ?></td>
                                <td><?= $sub['total_score'] ?></td>
                                <td>
                                    <?php
                                    $percentage = $sub['total_score'] > 0 ? round(($sub['score'] / $sub['total_score']) * 100, 2) : 0;
                                    ?>
                                    <?= $percentage ?>%
                                </td>
                                <td>
                                    <?php if ($sub['status'] === 'completed'): ?>
                                        <span class="badge bg-success">已完成</span>
                                    <?php else: ?>
                                        <span class="badge bg-warning">待阅卷</span>
                                    <?php endif; ?>
                                </td>
                                <td><?= formatDateTime($sub['submitted_at']) ?></td>
                                <td>
                                    <a href="exam_result.php?submission_id=<?= $sub['id'] ?>" class="btn btn-sm btn-outline-primary">查看详情</a>
                                </td>
                            </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>
            <?php endif; ?>
        <?php endif; ?>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
</body>
</html>
