<?php
/**
 * 学生 - 参加考试页面
 */
require_once '../includes/config.php';
require_once '../includes/auth.php';
require_once '../includes/functions.php';

requireLogin();

$db = getDB();
$userId = getCurrentUserId();
$examId = intval($_GET['exam_id'] ?? 0);

// 获取考试信息
$stmt = $db->prepare("SELECT * FROM exams WHERE id = ?");
$stmt->execute([$examId]);
$exam = $stmt->fetch();

if (!$exam) {
    setFlash('error', '考试不存在');
    redirect('exams.php');
}

// 检查是否已经提交过
$stmt = $db->prepare("SELECT COUNT(*) as count FROM submissions WHERE user_id = ? AND exam_id = ?");
$stmt->execute([$userId, $examId]);
if ($stmt->fetch()['count'] > 0) {
    setFlash('error', '您已经完成过此考试');
    redirect('exams.php');
}

// 获取考试题目
$stmt = $db->prepare("
    SELECT q.*
    FROM questions q
    JOIN exam_questions eq ON q.id = eq.question_id
    WHERE eq.exam_id = ?
    ORDER BY eq.id
");
$stmt->execute([$examId]);
$questions = $stmt->fetchAll();

// 处理提交
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $answers = [];
    $totalScore = 0;
    $hasSubjective = false;

    foreach ($questions as $q) {
        $questionId = $q['id'];
        $userAnswer = $_POST["answer_$questionId"] ?? null;

        // 保存用户答案
        $answers[$questionId] = $userAnswer;

        // 自动判分（仅客观题）
        if (in_array($q['type'], ['single', 'judge'])) {
            if ($userAnswer == $q['answer']) {
                $totalScore += $q['score'];
            }
        } elseif ($q['type'] === 'multiple') {
            $correctAnswer = json_decode($q['answer'], true);
            $userAnswerArray = is_array($userAnswer) ? $userAnswer : [];

            // 多选题完全正确才得分
            sort($correctAnswer);
            sort($userAnswerArray);
            if ($correctAnswer == $userAnswerArray) {
                $totalScore += $q['score'];
            }
        } else {
            // 编程题和简答题需要人工阅卷
            $hasSubjective = true;
        }
    }

    // 保存提交记录
    $status = $hasSubjective ? 'pending' : 'completed';
    $stmt = $db->prepare("INSERT INTO submissions (user_id, exam_id, answers, score, status) VALUES (?, ?, ?, ?, ?)");
    $stmt->execute([$userId, $examId, json_encode($answers, JSON_UNESCAPED_UNICODE), $totalScore, $status]);
    $submissionId = $db->lastInsertId();

    // 保存逐题明细
    $detailStmt = $db->prepare("INSERT INTO submission_details (submission_id, question_id, student_answer, auto_score) VALUES (?, ?, ?, ?)");
    foreach ($questions as $q) {
        $questionId = $q['id'];
        $userAnswer = $answers[$questionId] ?? null;
        $answerText = is_array($userAnswer) ? json_encode($userAnswer, JSON_UNESCAPED_UNICODE) : ($userAnswer ?? '');

        $autoScore = null;
        if (in_array($q['type'], ['single', 'judge'])) {
            $autoScore = ($userAnswer == $q['answer']) ? $q['score'] : 0;
        } elseif ($q['type'] === 'multiple') {
            $correctAnswer = json_decode($q['answer'], true);
            $userAnswerArray = is_array($userAnswer) ? $userAnswer : [];
            sort($correctAnswer);
            sort($userAnswerArray);
            $autoScore = ($correctAnswer == $userAnswerArray) ? $q['score'] : 0;
        }
        // essay/code 题 auto_score 保持 NULL，等教师评分

        $detailStmt->execute([$submissionId, $questionId, $answerText, $autoScore]);
    }

    setFlash('success', '考试提交成功！' . ($hasSubjective ? '主观题需要等待老师阅卷。' : ''));
    redirect('exams.php?view=results');
}
?>
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?= e($exam['title']) ?> - 在线考试系统</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css">
    <style>
        .timer {
            position: fixed;
            top: 70px;
            right: 20px;
            background: #fff;
            padding: 15px;
            border: 2px solid #dc3545;
            border-radius: 5px;
            font-size: 20px;
            font-weight: bold;
            color: #dc3545;
            z-index: 1000;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .question-card {
            margin-bottom: 30px;
            border-left: 4px solid #0d6efd;
        }
        pre code {
            display: block;
            padding: 1em;
            background: #f6f8fa;
            border-radius: 6px;
            overflow-x: auto;
        }
        code {
            background: #f6f8fa;
            padding: 0.2em 0.4em;
            border-radius: 3px;
            font-family: 'Courier New', monospace;
        }
    </style>
</head>
<body>
    <nav class="navbar navbar-expand-lg navbar-dark bg-primary">
        <div class="container">
            <a class="navbar-brand" href="#"><?= e($exam['title']) ?></a>
            <span class="navbar-text text-white">
                总分：<?= $exam['total_score'] ?> 分 | 时长：<?= $exam['duration'] ?> 分钟
            </span>
        </div>
    </nav>

    <!-- 倒计时 -->
    <div class="timer" id="timer">
        剩余时间：<span id="timeLeft"><?= $exam['duration'] ?>:00</span>
    </div>

    <div class="container mt-4 mb-5">
        <div class="alert alert-warning">
            <strong>注意事项：</strong>
            <ul class="mb-0">
                <li>考试时间为 <?= $exam['duration'] ?> 分钟，时间到将自动提交</li>
                <li>请认真作答，提交后不可修改</li>
                <li>请确保网络连接稳定</li>
            </ul>
        </div>

        <form method="POST" id="examForm">
            <?php foreach ($questions as $index => $q): ?>
                <div class="card question-card">
                    <div class="card-body">
                        <h5 class="card-title">
                            第 <?= $index + 1 ?> 题
                            <span class="badge bg-info"><?= getQuestionTypeName($q['type']) ?></span>
                            <span class="badge bg-secondary"><?= $q['score'] ?> 分</span>
                        </h5>
                        <p class="card-text"><?= renderQuestionText($q['question_text']) ?></p>

                        <?php if ($q['type'] === 'single'): ?>
                            <!-- 单选题 -->
                            <?php $options = json_decode($q['options'], true); ?>
                            <?php foreach ($options as $idx => $option): ?>
                                <div class="form-check">
                                    <input class="form-check-input" type="radio" name="answer_<?= $q['id'] ?>"
                                           value="<?= $idx + 1 ?>" id="q<?= $q['id'] ?>_<?= $idx ?>" required>
                                    <label class="form-check-label" for="q<?= $q['id'] ?>_<?= $idx ?>">
                                        <?= e($option) ?>
                                    </label>
                                </div>
                            <?php endforeach; ?>

                        <?php elseif ($q['type'] === 'multiple'): ?>
                            <!-- 多选题 -->
                            <?php $options = json_decode($q['options'], true); ?>
                            <div class="alert alert-info">请选择所有正确答案</div>
                            <?php foreach ($options as $idx => $option): ?>
                                <div class="form-check">
                                    <input class="form-check-input" type="checkbox" name="answer_<?= $q['id'] ?>[]"
                                           value="<?= $idx + 1 ?>" id="q<?= $q['id'] ?>_<?= $idx ?>">
                                    <label class="form-check-label" for="q<?= $q['id'] ?>_<?= $idx ?>">
                                        <?= e($option) ?>
                                    </label>
                                </div>
                            <?php endforeach; ?>

                        <?php elseif ($q['type'] === 'judge'): ?>
                            <!-- 判断题 -->
                            <div class="form-check">
                                <input class="form-check-input" type="radio" name="answer_<?= $q['id'] ?>"
                                       value="true" id="q<?= $q['id'] ?>_true" required>
                                <label class="form-check-label" for="q<?= $q['id'] ?>_true">正确</label>
                            </div>
                            <div class="form-check">
                                <input class="form-check-input" type="radio" name="answer_<?= $q['id'] ?>"
                                       value="false" id="q<?= $q['id'] ?>_false" required>
                                <label class="form-check-label" for="q<?= $q['id'] ?>_false">错误</label>
                            </div>

                        <?php elseif ($q['type'] === 'code'): ?>
                            <!-- 编程题 -->
                            <textarea class="form-control code-editor" name="answer_<?= $q['id'] ?>" rows="12"
                                      placeholder="请在此输入代码..." style="font-family: 'Courier New', monospace; font-size: 14px; tab-size: 4;" required></textarea>

                        <?php elseif ($q['type'] === 'essay'): ?>
                            <!-- 简答题 -->
                            <textarea class="form-control" name="answer_<?= $q['id'] ?>" rows="6"
                                      placeholder="请在此输入答案..." required></textarea>

                        <?php else: ?>
                            <!-- 其他题型（gdb命令、填空等）使用文本输入 -->
                            <textarea class="form-control code-editor" name="answer_<?= $q['id'] ?>" rows="6"
                                      placeholder="请在此输入答案..." style="font-family: 'Courier New', monospace; font-size: 14px;" required></textarea>
                        <?php endif; ?>
                    </div>
                </div>
            <?php endforeach; ?>

            <div class="text-center">
                <button type="submit" class="btn btn-primary btn-lg" onclick="return confirm('确定提交考试吗？提交后不可修改！')">
                    提交考试
                </button>
            </div>
        </form>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
    <script>
        // 代码高亮
        hljs.highlightAll();

        // 倒计时功能
        let totalSeconds = <?= $exam['duration'] ?> * 60;
        const timerElement = document.getElementById('timeLeft');
        const examForm = document.getElementById('examForm');

        function updateTimer() {
            const minutes = Math.floor(totalSeconds / 60);
            const seconds = totalSeconds % 60;
            timerElement.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;

            if (totalSeconds <= 0) {
                alert('考试时间到，系统将自动提交！');
                examForm.submit();
            } else if (totalSeconds <= 60) {
                // 最后一分钟变红色
                document.getElementById('timer').style.borderColor = '#dc3545';
                document.getElementById('timer').style.backgroundColor = '#fff3cd';
            }

            totalSeconds--;
        }

        // 每秒更新一次
        setInterval(updateTimer, 1000);
        updateTimer();

        // 防止意外离开页面
        window.addEventListener('beforeunload', function(e) {
            e.preventDefault();
            e.returnValue = '';
        });

        // 提交时移除警告
        examForm.addEventListener('submit', function() {
            window.removeEventListener('beforeunload', arguments.callee);
        });

        // 代码编辑器Tab键支持
        document.querySelectorAll('.code-editor').forEach(function(textarea) {
            textarea.addEventListener('keydown', function(e) {
                if (e.key === 'Tab') {
                    e.preventDefault();
                    var start = this.selectionStart;
                    var end = this.selectionEnd;
                    this.value = this.value.substring(0, start) + '    ' + this.value.substring(end);
                    this.selectionStart = this.selectionEnd = start + 4;
                }
            });
        });
    </script>
</body>
</html>
