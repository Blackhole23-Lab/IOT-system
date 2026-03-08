<?php
/**
 * 管理员 - 考试管理
 */
require_once '../includes/config.php';
require_once '../includes/auth.php';
require_once '../includes/functions.php';

requireAdmin();

$db = getDB();
$action = $_GET['action'] ?? 'list';
$examId = $_GET['id'] ?? null;

// 处理删除操作
if ($action === 'delete' && $examId) {
    $stmt = $db->prepare("DELETE FROM exams WHERE id = ?");
    $stmt->execute([$examId]);
    setFlash('success', '考试删除成功');
    redirect('exams.php');
}

// 处理创建/编辑操作
if ($_SERVER['REQUEST_METHOD'] === 'POST' && in_array($action, ['add', 'edit'])) {
    $title = trim($_POST['title'] ?? '');
    $duration = intval($_POST['duration'] ?? 60);
    $questionIds = $_POST['questions'] ?? [];

    // 计算总分
    $totalScore = 0;
    if (!empty($questionIds)) {
        $placeholders = implode(',', array_fill(0, count($questionIds), '?'));
        $stmt = $db->prepare("SELECT SUM(score) as total FROM questions WHERE id IN ($placeholders)");
        $stmt->execute($questionIds);
        $totalScore = $stmt->fetch()['total'] ?? 0;
    }

    if ($action === 'add') {
        $stmt = $db->prepare("INSERT INTO exams (title, duration, total_score) VALUES (?, ?, ?)");
        $stmt->execute([$title, $duration, $totalScore]);
        $newExamId = $db->lastInsertId();

        // 添加考试题目关联
        foreach ($questionIds as $qid) {
            $stmt = $db->prepare("INSERT INTO exam_questions (exam_id, question_id) VALUES (?, ?)");
            $stmt->execute([$newExamId, $qid]);
        }

        setFlash('success', '考试创建成功');
    } else {
        $stmt = $db->prepare("UPDATE exams SET title = ?, duration = ?, total_score = ? WHERE id = ?");
        $stmt->execute([$title, $duration, $totalScore, $examId]);

        // 删除旧的题目关联
        $stmt = $db->prepare("DELETE FROM exam_questions WHERE exam_id = ?");
        $stmt->execute([$examId]);

        // 添加新的题目关联
        foreach ($questionIds as $qid) {
            $stmt = $db->prepare("INSERT INTO exam_questions (exam_id, question_id) VALUES (?, ?)");
            $stmt->execute([$examId, $qid]);
        }

        setFlash('success', '考试更新成功');
    }
    redirect('exams.php');
}

// 获取考试列表
$exams = $db->query("SELECT e.*,
    (SELECT COUNT(*) FROM exam_questions WHERE exam_id = e.id) as question_count
    FROM exams e ORDER BY e.id DESC")->fetchAll();

// 如果是添加/编辑模式，获取所有题目
$allQuestions = [];
$selectedQuestions = [];
if (in_array($action, ['add', 'edit'])) {
    $allQuestions = $db->query("SELECT * FROM questions ORDER BY id DESC")->fetchAll();

    if ($action === 'edit' && $examId) {
        $stmt = $db->prepare("SELECT question_id FROM exam_questions WHERE exam_id = ?");
        $stmt->execute([$examId]);
        $selectedQuestions = array_column($stmt->fetchAll(), 'question_id');
    }
}

// 获取考试详情
$exam = null;
if ($action === 'edit' && $examId) {
    $stmt = $db->prepare("SELECT * FROM exams WHERE id = ?");
    $stmt->execute([$examId]);
    $exam = $stmt->fetch();
}
?>
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>考试管理 - 在线考试系统</title>
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

        <h2 class="mb-4">考试管理</h2>

        <?php if ($action === 'list'): ?>
            <!-- 考试列表 -->
            <div class="mb-3">
                <a href="?action=add" class="btn btn-primary">创建考试</a>
            </div>

            <?php if (empty($exams)): ?>
                <div class="alert alert-info">暂无考试，请先创建考试</div>
            <?php else: ?>
                <table class="table table-striped">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>考试标题</th>
                            <th>题目数</th>
                            <th>总分</th>
                            <th>时长(分钟)</th>
                            <th>创建时间</th>
                            <th>操作</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php foreach ($exams as $e): ?>
                            <tr>
                                <td><?= $e['id'] ?></td>
                                <td><?= e($e['title']) ?></td>
                                <td><?= $e['question_count'] ?></td>
                                <td><?= $e['total_score'] ?></td>
                                <td><?= $e['duration'] ?></td>
                                <td><?= formatDateTime($e['created_at']) ?></td>
                                <td>
                                    <a href="?action=edit&id=<?= $e['id'] ?>" class="btn btn-sm btn-warning">编辑</a>
                                    <a href="?action=delete&id=<?= $e['id'] ?>" class="btn btn-sm btn-danger"
                                       onclick="return confirm('确定删除此考试？')">删除</a>
                                </td>
                            </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>
            <?php endif; ?>

        <?php elseif ($action === 'add' || $action === 'edit'): ?>
            <!-- 创建/编辑考试表单 -->
            <h3><?= $action === 'add' ? '创建考试' : '编辑考试' ?></h3>

            <form method="POST" action="?action=<?= $action ?><?= $examId ? "&id=$examId" : '' ?>">
                <div class="mb-3">
                    <label class="form-label">考试标题</label>
                    <input type="text" class="form-control" name="title" value="<?= e($exam['title'] ?? '') ?>" required>
                </div>

                <div class="mb-3">
                    <label class="form-label">考试时长（分钟）</label>
                    <input type="number" class="form-control" name="duration" value="<?= $exam['duration'] ?? 60 ?>" required>
                </div>

                <div class="mb-3">
                    <label class="form-label">选择题目</label>
                    <div class="alert alert-info">
                        请从题库中选择要包含在此考试中的题目，总分将自动计算
                    </div>

                    <?php if (empty($allQuestions)): ?>
                        <div class="alert alert-warning">题库中暂无题目，请先<a href="questions.php">添加题目</a></div>
                    <?php else: ?>
                        <div style="max-height: 400px; overflow-y: auto; border: 1px solid #ddd; padding: 10px;">
                            <?php foreach ($allQuestions as $q): ?>
                                <div class="form-check mb-2">
                                    <input class="form-check-input" type="checkbox" name="questions[]"
                                           value="<?= $q['id'] ?>" id="q<?= $q['id'] ?>"
                                           <?= in_array($q['id'], $selectedQuestions) ? 'checked' : '' ?>>
                                    <label class="form-check-label" for="q<?= $q['id'] ?>">
                                        <strong>[<?= getQuestionTypeName($q['type']) ?>]</strong>
                                        <?= e(mb_substr($q['question_text'], 0, 80)) ?>...
                                        <span class="badge bg-secondary"><?= $q['score'] ?>分</span>
                                    </label>
                                </div>
                            <?php endforeach; ?>
                        </div>
                    <?php endif; ?>
                </div>

                <button type="submit" class="btn btn-primary">保存</button>
                <a href="exams.php" class="btn btn-secondary">取消</a>
            </form>
        <?php endif; ?>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
</body>
</html>
