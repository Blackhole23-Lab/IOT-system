<?php
/**
 * 管理员 - 查看提交记录
 */
require_once '../includes/config.php';
require_once '../includes/auth.php';
require_once '../includes/functions.php';

requireAdmin();

$db = getDB();

// 获取所有提交记录
$stmt = $db->query("
    SELECT s.*, COALESCE(u.username, '已删除用户') as username, e.title as exam_title, e.total_score
    FROM submissions s
    LEFT JOIN users u ON s.user_id = u.id
    LEFT JOIN exams e ON s.exam_id = e.id
    ORDER BY s.submitted_at DESC
");
$submissions = $stmt->fetchAll();

// 导出CSV
if (isset($_GET['export']) && $_GET['export'] === 'csv') {
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename=submissions_' . date('Y-m-d') . '.csv');

    $output = fopen('php://output', 'w');
    fprintf($output, chr(0xEF).chr(0xBB).chr(0xBF)); // UTF-8 BOM

    // 写入标题行
    fputcsv($output, ['ID', '学生', '考试', '得分', '总分', '状态', '提交时间']);

    // 写入数据
    foreach ($submissions as $sub) {
        fputcsv($output, [
            $sub['id'],
            $sub['username'],
            $sub['exam_title'],
            $sub['score'],
            $sub['total_score'],
            $sub['status'] === 'completed' ? '已完成' : '待阅卷',
            formatDateTime($sub['submitted_at'])
        ]);
    }

    fclose($output);
    exit;
}
?>
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>提交记录 - 在线考试系统</title>
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

        <h2 class="mb-4">提交记录</h2>

        <div class="mb-3">
            <a href="?export=csv" class="btn btn-success">导出CSV</a>
        </div>

        <?php if (empty($submissions)): ?>
            <div class="alert alert-info">暂无提交记录</div>
        <?php else: ?>
            <table class="table table-striped">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>学生</th>
                        <th>考试</th>
                        <th>得分</th>
                        <th>总分</th>
                        <th>状态</th>
                        <th>提交时间</th>
                        <th>操作</th>
                    </tr>
                </thead>
                <tbody>
                    <?php foreach ($submissions as $sub): ?>
                        <tr>
                            <td><?= $sub['id'] ?></td>
                            <td><?= e($sub['username']) ?></td>
                            <td><?= e($sub['exam_title']) ?></td>
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
                                <a href="grade.php?submission_id=<?= $sub['id'] ?>" class="btn btn-sm <?= $sub['status'] === 'pending' ? 'btn-warning' : 'btn-outline-primary' ?>">
                                    <?= $sub['status'] === 'pending' ? '去评分' : '查看详情' ?>
                                </a>
                            </td>
                        </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>
        <?php endif; ?>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
</body>
</html>
