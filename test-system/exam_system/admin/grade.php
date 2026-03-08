<?php
/**
 * 管理员 - 主观题评分页面
 */
require_once '../includes/config.php';
require_once '../includes/auth.php';
require_once '../includes/functions.php';

requireAdmin();

$db = getDB();
$submissionId = intval($_GET['submission_id'] ?? 0);

// 处理批量评分提交
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $detailIds = $_POST['detail_id'] ?? [];
    $scores    = $_POST['score'] ?? [];
    $comments  = $_POST['comment'] ?? [];

    // 逐题保存
    foreach ($detailIds as $idx => $detailId) {
        $detailId = intval($detailId);
        $score    = floatval($scores[$idx] ?? 0);
        $comment  = trim($comments[$idx] ?? '');

        $stmt = $db->prepare("UPDATE submission_details SET teacher_score = ?, teacher_comment = ?, graded_by = ?, graded_at = datetime('now') WHERE id = ?");
        $stmt->execute([$score, $comment, getCurrentUserId(), $detailId]);
    }

    // 从任意一条 detail 取出 submission_id（或直接用 URL 参数）
    if (!empty($detailIds)) {
        $stmt = $db->prepare("SELECT submission_id FROM submission_details WHERE id = ?");
        $stmt->execute([intval($detailIds[0])]);
        $row = $stmt->fetch();
        $sid = $row['submission_id'];
    } else {
        $sid = $submissionId;
    }

    // 检查是否所有主观题都已评分
    $stmt = $db->prepare("
        SELECT COUNT(*) as pending FROM submission_details sd
        JOIN questions q ON sd.question_id = q.id
        WHERE sd.submission_id = ? AND q.type IN ('essay', 'code') AND sd.teacher_score IS NULL
    ");
    $stmt->execute([$sid]);
    $pending = $stmt->fetch()['pending'];

    if ($pending == 0) {
        $stmt = $db->prepare("
            SELECT SUM(COALESCE(sd.teacher_score, sd.auto_score, 0)) as total
            FROM submission_details sd WHERE sd.submission_id = ?
        ");
        $stmt->execute([$sid]);
        $total = $stmt->fetch()['total'];

        $stmt = $db->prepare("UPDATE submissions SET score = ?, status = 'completed' WHERE id = ?");
        $stmt->execute([$total, $sid]);
    }

    setFlash('success', '评分已保存');
    header("Location: grade.php?submission_id=$sid");
    exit;
}

// 获取提交信息
$stmt = $db->prepare("
    SELECT s.*, COALESCE(u.username, '已删除用户') as username, e.title as exam_title, e.total_score
    FROM submissions s
    LEFT JOIN users u ON s.user_id = u.id
    LEFT JOIN exams e ON s.exam_id = e.id
    WHERE s.id = ?
");
$stmt->execute([$submissionId]);
$submission = $stmt->fetch();

if (!$submission) {
    setFlash('error', '提交记录不存在');
    redirect('submissions.php');
}

// 获取逐题明细
$stmt = $db->prepare("
    SELECT sd.*, q.question_text, q.type, q.options, q.answer as correct_answer, q.score as max_score
    FROM submission_details sd
    JOIN questions q ON sd.question_id = q.id
    WHERE sd.submission_id = ?
    ORDER BY sd.id
");
$stmt->execute([$submissionId]);
$details = $stmt->fetchAll();
?>
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>阅卷评分 - <?= e($submission['username']) ?></title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css">
    <style>
        .graded { border-left: 4px solid #198754; }
        .ungraded { border-left: 4px solid #dc3545; }
        .auto-graded { border-left: 4px solid #0d6efd; }
        pre code { display: block; padding: 1em; background: #f6f8fa; border-radius: 6px; overflow-x: auto; }
    </style>
</head>
<body>
    <nav class="navbar navbar-expand-lg navbar-dark bg-primary">
        <div class="container">
            <a class="navbar-brand" href="../dashboard.php">在线考试系统</a>
            <div class="navbar-nav ms-auto">
                <a class="nav-link" href="submissions.php">返回提交记录</a>
                <a class="nav-link" href="../logout.php">退出</a>
            </div>
        </div>
    </nav>

    <div class="container mt-4">
        <?php displayFlash(); ?>

        <div class="d-flex justify-content-between align-items-center mb-3">
            <h2>阅卷评分</h2>
            <a href="export_pdf.php?submission_id=<?= $submissionId ?>" class="btn btn-outline-danger" target="_blank">
                导出PDF试卷
            </a>
        </div>

        <div class="alert alert-info">
            学生：<strong><?= e($submission['username']) ?></strong> |
            考试：<strong><?= e($submission['exam_title']) ?></strong> |
            当前得分：<strong><?= $submission['score'] ?></strong> / <?= $submission['total_score'] ?> |
            状态：<?= $submission['status'] === 'completed' ? '<span class="badge bg-success">已完成</span>' : '<span class="badge bg-warning">待阅卷</span>' ?>
        </div>

        <!-- 一键提交表单：包裹所有主观题评分 -->
        <form method="POST" id="gradeForm">
        <?php foreach ($details as $i => $d): ?>
            <?php
            $isObjective = in_array($d['type'], ['single', 'multiple', 'judge']);
            $isGraded = $d['teacher_score'] !== null;
            $cardClass = $isObjective ? 'auto-graded' : ($isGraded ? 'graded' : 'ungraded');
            ?>
            <div class="card mb-3 <?= $cardClass ?>">
                <div class="card-header d-flex justify-content-between">
                    <span>
                        第 <?= $i + 1 ?> 题
                        <span class="badge bg-info"><?= getQuestionTypeName($d['type']) ?></span>
                        <span class="badge bg-secondary"><?= $d['max_score'] ?> 分</span>
                    </span>
                    <span>
                        <?php if ($isObjective): ?>
                            得分：<?= $d['auto_score'] ?> 分
                            <?= $d['auto_score'] > 0 ? '<span class="badge bg-success">正确</span>' : '<span class="badge bg-danger">错误</span>' ?>
                        <?php elseif ($isGraded): ?>
                            教师评分：<?= $d['teacher_score'] ?> 分
                        <?php else: ?>
                            <span class="badge bg-danger">待评分</span>
                        <?php endif; ?>
                    </span>
                </div>
                <div class="card-body">
                    <p><strong>题目：</strong><?= renderQuestionText($d['question_text']) ?></p>

                    <?php if ($d['type'] === 'single' || $d['type'] === 'multiple'): ?>
                        <?php $options = json_decode($d['options'], true); ?>
                        <p><strong>选项：</strong></p>
                        <ul>
                            <?php foreach ($options as $idx => $opt): ?>
                                <li><?= ($idx + 1) ?>. <?= e($opt) ?></li>
                            <?php endforeach; ?>
                        </ul>
                    <?php endif; ?>

                    <div class="row">
                        <div class="col-md-6">
                            <p><strong>学生答案：</strong></p>
                            <pre class="bg-light p-2"><?= e($d['student_answer'] ?: '未作答') ?></pre>
                        </div>
                        <div class="col-md-6">
                            <p><strong>参考答案：</strong></p>
                            <pre class="bg-light p-2"><?= e($d['correct_answer']) ?></pre>
                        </div>
                    </div>

                    <?php if ($d['ai_score'] !== null): ?>
                        <div class="alert alert-secondary mt-2">
                            <strong>AI建议评分：</strong><?= $d['ai_score'] ?> 分
                            <?php if ($d['ai_comment']): ?>
                                <br><strong>AI评语：</strong><?= e($d['ai_comment']) ?>
                            <?php endif; ?>
                        </div>
                    <?php endif; ?>

                    <?php if (!$isObjective): ?>
                        <hr>
                        <!-- 隐藏字段传递题目ID，与评分/评语数组对齐 -->
                        <input type="hidden" name="detail_id[]" value="<?= $d['id'] ?>">
                        <div class="row g-2 align-items-end">
                            <div class="col-md-3">
                                <label class="form-label">评分 (0-<?= $d['max_score'] ?>)</label>
                                <input type="number" name="score[]" class="form-control"
                                       min="0" max="<?= $d['max_score'] ?>" step="0.5"
                                       value="<?= $d['teacher_score'] ?? $d['ai_score'] ?? '' ?>" required>
                            </div>
                            <div class="col-md-9">
                                <label class="form-label">评语</label>
                                <input type="text" name="comment[]" class="form-control"
                                       value="<?= e($d['teacher_comment'] ?? '') ?>" placeholder="可选评语">
                            </div>
                        </div>
                    <?php endif; ?>

                    <?php if ($d['teacher_comment']): ?>
                        <div class="mt-2"><strong>教师评语：</strong><?= e($d['teacher_comment']) ?></div>
                    <?php endif; ?>
                </div>
            </div>
        <?php endforeach; ?>

        <!-- 底部一键提交按钮 -->
        <div class="d-flex gap-2 mb-5">
            <button type="submit" class="btn btn-primary btn-lg px-5">一键提交所有评分</button>
            <a href="export_pdf.php?submission_id=<?= $submissionId ?>" class="btn btn-outline-danger btn-lg" target="_blank">导出PDF试卷</a>
        </div>
        </form>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
    <script>hljs.highlightAll();</script>
</body>
</html>
