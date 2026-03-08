<?php
/**
 * 学生 - 考试成绩详情页
 */
require_once '../includes/config.php';
require_once '../includes/auth.php';
require_once '../includes/functions.php';

requireLogin();

$db = getDB();
$userId = getCurrentUserId();
$submissionId = intval($_GET['submission_id'] ?? 0);

// 获取提交记录（只能看自己的）
$stmt = $db->prepare("
    SELECT s.*, e.title as exam_title, e.total_score, e.duration
    FROM submissions s
    JOIN exams e ON s.exam_id = e.id
    WHERE s.id = ? AND s.user_id = ?
");
$stmt->execute([$submissionId, $userId]);
$submission = $stmt->fetch();

if (!$submission) {
    setFlash('error', '记录不存在');
    redirect('exams.php?view=results');
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

// 如果没有明细记录（旧数据），从answers JSON解析
if (empty($details) && $submission['answers']) {
    $answers = json_decode($submission['answers'], true);
    $stmt = $db->prepare("
        SELECT q.* FROM questions q
        JOIN exam_questions eq ON q.id = eq.question_id
        WHERE eq.exam_id = ?
        ORDER BY eq.id
    ");
    $stmt->execute([$submission['exam_id']]);
    $questions = $stmt->fetchAll();

    foreach ($questions as $q) {
        $studentAnswer = $answers[$q['id']] ?? '';
        if (is_array($studentAnswer)) {
            $studentAnswer = json_encode($studentAnswer, JSON_UNESCAPED_UNICODE);
        }
        $autoScore = null;
        if (in_array($q['type'], ['single', 'judge'])) {
            $autoScore = ($studentAnswer == $q['answer']) ? $q['score'] : 0;
        } elseif ($q['type'] === 'multiple') {
            $correct = json_decode($q['answer'], true);
            $user = json_decode($studentAnswer, true) ?: [];
            sort($correct);
            sort($user);
            $autoScore = ($correct == $user) ? $q['score'] : 0;
        }
        $details[] = [
            'question_text' => $q['question_text'],
            'type' => $q['type'],
            'options' => $q['options'],
            'correct_answer' => $q['answer'],
            'max_score' => $q['score'],
            'student_answer' => $studentAnswer,
            'auto_score' => $autoScore,
            'teacher_score' => null,
            'teacher_comment' => null,
            'ai_comment' => null,
        ];
    }
}

$percentage = $submission['total_score'] > 0 ? round(($submission['score'] / $submission['total_score']) * 100, 1) : 0;
?>
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>成绩详情 - <?= e($submission['exam_title']) ?></title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css">
    <style>
        .correct { border-left: 4px solid #198754; }
        .wrong { border-left: 4px solid #dc3545; }
        .pending { border-left: 4px solid #ffc107; }
        pre code { display: block; padding: 1em; background: #f6f8fa; border-radius: 6px; overflow-x: auto; }
        code { background: #f6f8fa; padding: 0.2em 0.4em; border-radius: 3px; }
    </style>
</head>
<body>
    <nav class="navbar navbar-expand-lg navbar-dark bg-primary">
        <div class="container">
            <a class="navbar-brand" href="../dashboard.php">在线考试系统</a>
            <div class="navbar-nav ms-auto">
                <a class="nav-link" href="exams.php?view=results">返回成绩列表</a>
                <a class="nav-link" href="../logout.php">退出</a>
            </div>
        </div>
    </nav>

    <div class="container mt-4 mb-5">
        <h2><?= e($submission['exam_title']) ?> - 成绩详情</h2>

        <div class="card mb-4">
            <div class="card-body">
                <div class="row text-center">
                    <div class="col-md-3">
                        <h4><?= $submission['score'] ?> / <?= $submission['total_score'] ?></h4>
                        <small class="text-muted">得分</small>
                    </div>
                    <div class="col-md-3">
                        <h4><?= $percentage ?>%</h4>
                        <small class="text-muted">得分率</small>
                    </div>
                    <div class="col-md-3">
                        <h4>
                            <?php if ($submission['status'] === 'completed'): ?>
                                <span class="badge bg-success">已完成</span>
                            <?php else: ?>
                                <span class="badge bg-warning">待阅卷</span>
                            <?php endif; ?>
                        </h4>
                        <small class="text-muted">状态</small>
                    </div>
                    <div class="col-md-3">
                        <h4><?= formatDateTime($submission['submitted_at']) ?></h4>
                        <small class="text-muted">提交时间</small>
                    </div>
                </div>
            </div>
        </div>

        <?php foreach ($details as $i => $d): ?>
            <?php
            $isObjective = in_array($d['type'], ['single', 'multiple', 'judge']);
            $earnedScore = $d['teacher_score'] ?? $d['auto_score'];
            if ($isObjective) {
                $cardClass = ($d['auto_score'] > 0) ? 'correct' : 'wrong';
            } elseif ($d['teacher_score'] !== null) {
                $cardClass = ($d['teacher_score'] > 0) ? 'correct' : 'wrong';
            } else {
                $cardClass = 'pending';
            }
            ?>
            <div class="card mb-3 <?= $cardClass ?>">
                <div class="card-header d-flex justify-content-between">
                    <span>
                        第 <?= $i + 1 ?> 题
                        <span class="badge bg-info"><?= getQuestionTypeName($d['type']) ?></span>
                        <span class="badge bg-secondary"><?= $d['max_score'] ?> 分</span>
                    </span>
                    <span>
                        <?php if ($earnedScore !== null): ?>
                            得分：<strong><?= $earnedScore ?></strong> / <?= $d['max_score'] ?>
                            <?php if ($isObjective): ?>
                                <?= $d['auto_score'] > 0 ? '<span class="badge bg-success">正确</span>' : '<span class="badge bg-danger">错误</span>' ?>
                            <?php endif; ?>
                        <?php else: ?>
                            <span class="badge bg-warning">待评分</span>
                        <?php endif; ?>
                    </span>
                </div>
                <div class="card-body">
                    <p><strong>题目：</strong><?= renderQuestionText($d['question_text']) ?></p>

                    <?php if ($d['type'] === 'single' || $d['type'] === 'multiple'): ?>
                        <?php $options = json_decode($d['options'], true); ?>
                        <?php if ($options): ?>
                            <p><strong>选项：</strong></p>
                            <ul>
                                <?php foreach ($options as $idx => $opt): ?>
                                    <li><?= ($idx + 1) ?>. <?= e($opt) ?></li>
                                <?php endforeach; ?>
                            </ul>
                        <?php endif; ?>
                    <?php endif; ?>

                    <p><strong>你的答案：</strong>
                        <span class="text-primary"><?= e($d['student_answer'] ?: '未作答') ?></span>
                    </p>

                    <?php if ($submission['status'] === 'completed' || $isObjective): ?>
                        <p><strong>正确答案：</strong>
                            <span class="text-success"><?= e($d['correct_answer']) ?></span>
                        </p>
                    <?php endif; ?>

                    <?php if (!empty($d['teacher_comment'])): ?>
                        <div class="alert alert-info mt-2 mb-0">
                            <strong>教师评语：</strong><?= e($d['teacher_comment']) ?>
                        </div>
                    <?php endif; ?>

                    <?php if (!empty($d['ai_comment'])): ?>
                        <div class="alert alert-secondary mt-2 mb-0">
                            <strong>AI评语：</strong><?= e($d['ai_comment']) ?>
                        </div>
                    <?php endif; ?>
                </div>
            </div>
        <?php endforeach; ?>

        <div class="text-center">
            <a href="exams.php?view=results" class="btn btn-primary">返回成绩列表</a>
        </div>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
    <script>hljs.highlightAll();</script>
</body>
</html>
