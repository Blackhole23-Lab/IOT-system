<?php
/**
 * 管理员 - 导出评分试卷（PDF打印版）
 */
require_once '../includes/config.php';
require_once '../includes/auth.php';
require_once '../includes/functions.php';

requireAdmin();

$db = getDB();
$submissionId = intval($_GET['submission_id'] ?? 0);

$stmt = $db->prepare("
    SELECT s.*, COALESCE(u.username, '已删除用户') as username,
           u.email,
           e.title as exam_title, e.total_score, e.description as exam_desc
    FROM submissions s
    LEFT JOIN users u ON s.user_id = u.id
    LEFT JOIN exams e ON s.exam_id = e.id
    WHERE s.id = ?
");
$stmt->execute([$submissionId]);
$submission = $stmt->fetch();

if (!$submission) {
    die('提交记录不存在');
}

$stmt = $db->prepare("
    SELECT sd.*, q.question_text, q.type, q.options, q.answer as correct_answer, q.score as max_score
    FROM submission_details sd
    JOIN questions q ON sd.question_id = q.id
    WHERE sd.submission_id = ?
    ORDER BY sd.id
");
$stmt->execute([$submissionId]);
$details = $stmt->fetchAll();

$totalEarned = array_sum(array_map(fn($d) => $d['teacher_score'] ?? $d['auto_score'] ?? 0, $details));
?>
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <title><?= e($submission['exam_title']) ?> - <?= e($submission['username']) ?> 评分试卷</title>
    <style>
        /* 屏幕预览样式 */
        body {
            font-family: "SimSun", "宋体", serif;
            font-size: 13px;
            color: #000;
            background: #e8e8e8;
            margin: 0;
            padding: 20px;
        }
        .page {
            background: #fff;
            width: 210mm;
            min-height: 297mm;
            margin: 0 auto 20px;
            padding: 20mm 18mm;
            box-shadow: 0 2px 8px rgba(0,0,0,.3);
        }
        .print-toolbar {
            position: fixed;
            top: 16px;
            right: 16px;
            z-index: 999;
            display: flex;
            gap: 8px;
        }
        .print-toolbar button, .print-toolbar a {
            padding: 8px 18px;
            font-size: 14px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            text-decoration: none;
        }
        .btn-print { background: #0d6efd; color: #fff; }
        .btn-back  { background: #6c757d; color: #fff; }

        /* 封面区域 */
        .cover-title {
            text-align: center;
            font-size: 22px;
            font-weight: bold;
            margin-bottom: 6px;
            border-bottom: 2px solid #000;
            padding-bottom: 8px;
        }
        .cover-meta {
            display: flex;
            justify-content: space-between;
            margin: 10px 0 16px;
            font-size: 13px;
        }
        .cover-meta span { display: inline-block; }
        .score-box {
            border: 2px solid #000;
            display: inline-block;
            padding: 6px 20px;
            font-size: 18px;
            font-weight: bold;
            margin: 8px 0 16px;
        }

        /* 题目卡片 */
        .question-block {
            margin-bottom: 18px;
            page-break-inside: avoid;
        }
        .question-header {
            display: flex;
            justify-content: space-between;
            font-weight: bold;
            border-bottom: 1px solid #ccc;
            padding-bottom: 4px;
            margin-bottom: 6px;
        }
        .q-type-badge {
            font-size: 11px;
            border: 1px solid #666;
            padding: 1px 5px;
            border-radius: 3px;
            margin-left: 6px;
        }
        .question-text { margin-bottom: 6px; line-height: 1.6; }
        .options-list { margin: 4px 0 6px 16px; }
        .answer-row {
            display: flex;
            gap: 16px;
            margin-top: 6px;
            font-size: 12px;
        }
        .answer-box {
            flex: 1;
            border: 1px solid #ccc;
            padding: 6px;
            border-radius: 3px;
            background: #fafafa;
            min-height: 40px;
            white-space: pre-wrap;
            word-break: break-all;
        }
        .answer-box.student-ans { border-color: #0d6efd; }
        .answer-label { font-weight: bold; margin-bottom: 3px; font-size: 11px; color: #555; }
        .score-row {
            margin-top: 8px;
            padding: 6px 10px;
            background: #f0f7ff;
            border-left: 3px solid #0d6efd;
            font-size: 12px;
        }
        .score-correct { color: #198754; font-weight: bold; }
        .score-wrong   { color: #dc3545; font-weight: bold; }
        .teacher-comment {
            margin-top: 6px;
            padding: 5px 10px;
            background: #fffbe6;
            border-left: 3px solid #ffc107;
            font-size: 12px;
        }
        pre {
            font-family: "Courier New", Courier, monospace;
            font-size: 12px;
            margin: 0;
            white-space: pre-wrap;
            word-break: break-all;
        }
        .section-title {
            font-size: 15px;
            font-weight: bold;
            border-bottom: 1px solid #000;
            margin: 16px 0 10px;
            padding-bottom: 4px;
        }

        /* 打印样式 */
        @media print {
            body { background: #fff; padding: 0; }
            .print-toolbar { display: none !important; }
            .page { box-shadow: none; margin: 0; padding: 15mm 15mm; width: auto; }
            .question-block { page-break-inside: avoid; }
        }
    </style>
</head>
<body>

<div class="print-toolbar">
    <a class="btn-back" href="grade.php?submission_id=<?= $submissionId ?>">← 返回评分</a>
    <button class="btn-print" onclick="window.print()">打印 / 导出PDF</button>
</div>

<div class="page">
    <!-- 封面信息 -->
    <div class="cover-title"><?= e($submission['exam_title']) ?></div>
    <div class="cover-meta">
        <span>学生姓名：<strong><?= e($submission['username']) ?></strong></span>
        <span>提交时间：<?= formatDateTime($submission['submitted_at']) ?></span>
        <span>状态：<?= $submission['status'] === 'completed' ? '已批改' : '待阅卷' ?></span>
    </div>
    <div>
        总分：<span class="score-box"><?= round($totalEarned, 1) ?> / <?= $submission['total_score'] ?></span>
        &nbsp;&nbsp;
        <?php $pct = $submission['total_score'] > 0 ? round($totalEarned / $submission['total_score'] * 100, 1) : 0; ?>
        得分率：<strong><?= $pct ?>%</strong>
    </div>

    <div class="section-title">答题详情</div>

    <?php foreach ($details as $i => $d): ?>
        <?php
        $isObjective = in_array($d['type'], ['single', 'multiple', 'judge']);
        $earnedScore = $d['teacher_score'] ?? $d['auto_score'] ?? 0;
        $isCorrect   = $earnedScore >= $d['max_score'];
        ?>
        <div class="question-block">
            <div class="question-header">
                <span>
                    第 <?= $i + 1 ?> 题
                    <span class="q-type-badge"><?= getQuestionTypeName($d['type']) ?></span>
                </span>
                <span>
                    得分：
                    <span class="<?= $isCorrect ? 'score-correct' : ($earnedScore > 0 ? '' : 'score-wrong') ?>">
                        <?= $earnedScore ?>
                    </span>
                    / <?= $d['max_score'] ?>
                </span>
            </div>

            <div class="question-text"><?= renderQuestionText($d['question_text']) ?></div>

            <?php if ($d['type'] === 'single' || $d['type'] === 'multiple'): ?>
                <?php $options = json_decode($d['options'], true); ?>
                <ul class="options-list">
                    <?php foreach ($options as $idx => $opt): ?>
                        <li><?= chr(65 + $idx) ?>. <?= e($opt) ?></li>
                    <?php endforeach; ?>
                </ul>
            <?php endif; ?>

            <div class="answer-row">
                <div style="flex:1">
                    <div class="answer-label">学生答案</div>
                    <div class="answer-box student-ans"><pre><?= e($d['student_answer'] ?: '未作答') ?></pre></div>
                </div>
                <div style="flex:1">
                    <div class="answer-label">参考答案</div>
                    <div class="answer-box"><pre><?= e($d['correct_answer']) ?></pre></div>
                </div>
            </div>

            <div class="score-row">
                <?php if ($isObjective): ?>
                    自动评分：<strong><?= $earnedScore ?></strong> 分
                    <?= $isCorrect ? '<span class="score-correct">（正确）</span>' : '<span class="score-wrong">（错误）</span>' ?>
                <?php else: ?>
                    教师评分：<strong><?= $earnedScore ?></strong> 分
                    <?php if ($d['ai_score'] !== null): ?>
                        &nbsp;｜ AI建议：<?= $d['ai_score'] ?> 分
                    <?php endif; ?>
                <?php endif; ?>
            </div>

            <?php if ($d['teacher_comment']): ?>
                <div class="teacher-comment">
                    <strong>教师评语：</strong><?= e($d['teacher_comment']) ?>
                </div>
            <?php endif; ?>
            <?php if (!$isObjective && $d['ai_comment']): ?>
                <div class="teacher-comment" style="border-color:#aaa;background:#f5f5f5">
                    <strong>AI评语：</strong><?= e($d['ai_comment']) ?>
                </div>
            <?php endif; ?>
        </div>
    <?php endforeach; ?>

    <div style="text-align:center;margin-top:30px;color:#888;font-size:11px;border-top:1px solid #ccc;padding-top:10px;">
        本试卷由在线考试系统自动生成 · 生成时间：<?= date('Y-m-d H:i:s') ?>
    </div>
</div>

</body>
</html>
