<?php
/**
 * 管理员 - 题库管理
 */
require_once '../includes/config.php';
require_once '../includes/auth.php';
require_once '../includes/functions.php';

requireAdmin();

$db = getDB();
$action = $_GET['action'] ?? 'list';
$questionId = $_GET['id'] ?? null;

// 处理删除操作
if ($action === 'delete' && $questionId) {
    $stmt = $db->prepare("DELETE FROM questions WHERE id = ?");
    $stmt->execute([$questionId]);
    setFlash('success', '题目删除成功');
    redirect('questions.php');
}

// 处理添加/编辑操作
if ($_SERVER['REQUEST_METHOD'] === 'POST' && in_array($action, ['add', 'edit'])) {
    $type = $_POST['type'] ?? '';
    $questionText = trim($_POST['question_text'] ?? '');
    $score = intval($_POST['score'] ?? 5);
    $answer = '';
    $options = '';

    // 根据题型处理选项和答案
    if ($type === 'single' || $type === 'multiple') {
        $opts = [];
        for ($i = 1; $i <= 6; $i++) {
            if (!empty($_POST["option_$i"])) {
                $opts[] = trim($_POST["option_$i"]);
            }
        }
        $options = json_encode($opts, JSON_UNESCAPED_UNICODE);

        if ($type === 'single') {
            $answer = $_POST['answer_single'] ?? '';
        } else {
            $answer = json_encode($_POST['answer_multiple'] ?? [], JSON_UNESCAPED_UNICODE);
        }
    } elseif ($type === 'judge') {
        $answer = $_POST['answer_judge'] ?? '';
    } else {
        // 编程题和简答题
        $answer = trim($_POST['answer_text'] ?? '');
    }

    if ($action === 'add') {
        $stmt = $db->prepare("INSERT INTO questions (type, question_text, options, answer, score) VALUES (?, ?, ?, ?, ?)");
        $stmt->execute([$type, $questionText, $options, $answer, $score]);
        setFlash('success', '题目添加成功');
    } else {
        $stmt = $db->prepare("UPDATE questions SET type = ?, question_text = ?, options = ?, answer = ?, score = ? WHERE id = ?");
        $stmt->execute([$type, $questionText, $options, $answer, $score, $questionId]);
        setFlash('success', '题目更新成功');
    }
    redirect('questions.php');
}

// 获取题目列表（分页）
$page = intval($_GET['page'] ?? 1);
$totalQuestions = $db->query("SELECT COUNT(*) as count FROM questions")->fetch()['count'];
$pagination = paginate($totalQuestions, $page);

$stmt = $db->prepare("SELECT * FROM questions ORDER BY id DESC LIMIT ? OFFSET ?");
$stmt->execute([$pagination['per_page'], $pagination['offset']]);
$questions = $stmt->fetchAll();

// 如果是编辑模式，获取题目详情
$question = null;
if ($action === 'edit' && $questionId) {
    $stmt = $db->prepare("SELECT * FROM questions WHERE id = ?");
    $stmt->execute([$questionId]);
    $question = $stmt->fetch();
}
?>
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>题库管理 - 在线考试系统</title>
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

        <h2 class="mb-4">题库管理</h2>

        <?php if ($action === 'list'): ?>
            <!-- 题目列表 -->
            <div class="mb-3">
                <a href="?action=add" class="btn btn-primary">添加题目</a>
                <a href="upload_questions.php" class="btn btn-success">批量导入</a>
            </div>

            <table class="table table-striped">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>题型</th>
                        <th>题目</th>
                        <th>分值</th>
                        <th>创建时间</th>
                        <th>操作</th>
                    </tr>
                </thead>
                <tbody>
                    <?php foreach ($questions as $q): ?>
                        <tr>
                            <td><?= $q['id'] ?></td>
                            <td><?= getQuestionTypeName($q['type']) ?></td>
                            <td><?= e(mb_substr($q['question_text'], 0, 50)) ?>...</td>
                            <td><?= $q['score'] ?></td>
                            <td><?= formatDateTime($q['created_at']) ?></td>
                            <td>
                                <a href="?action=edit&id=<?= $q['id'] ?>" class="btn btn-sm btn-warning">编辑</a>
                                <a href="?action=delete&id=<?= $q['id'] ?>" class="btn btn-sm btn-danger"
                                   onclick="return confirm('确定删除此题目？')">删除</a>
                            </td>
                        </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>

            <?php displayPagination($pagination, 'questions.php'); ?>

        <?php elseif ($action === 'add' || $action === 'edit'): ?>
            <!-- 添加/编辑题目表单 -->
            <h3><?= $action === 'add' ? '添加题目' : '编辑题目' ?></h3>

            <form method="POST" action="?action=<?= $action ?><?= $questionId ? "&id=$questionId" : '' ?>">
                <div class="mb-3">
                    <label class="form-label">题型</label>
                    <select class="form-select" name="type" id="questionType" required>
                        <option value="single" <?= ($question['type'] ?? '') === 'single' ? 'selected' : '' ?>>单选题</option>
                        <option value="multiple" <?= ($question['type'] ?? '') === 'multiple' ? 'selected' : '' ?>>多选题</option>
                        <option value="judge" <?= ($question['type'] ?? '') === 'judge' ? 'selected' : '' ?>>判断题</option>
                        <option value="code" <?= ($question['type'] ?? '') === 'code' ? 'selected' : '' ?>>编程题</option>
                        <option value="essay" <?= ($question['type'] ?? '') === 'essay' ? 'selected' : '' ?>>简答题</option>
                    </select>
                </div>

                <div class="mb-3">
                    <label class="form-label">题目内容</label>
                    <textarea class="form-control" name="question_text" rows="3" required><?= e($question['question_text'] ?? '') ?></textarea>
                </div>

                <!-- 选项区域（单选/多选） -->
                <div id="optionsArea" style="display: none;">
                    <label class="form-label">选项</label>
                    <?php
                    $opts = $question ? json_decode($question['options'], true) : [];
                    for ($i = 1; $i <= 6; $i++):
                    ?>
                        <div class="input-group mb-2">
                            <span class="input-group-text">选项<?= $i ?></span>
                            <input type="text" class="form-control" name="option_<?= $i ?>" value="<?= e($opts[$i-1] ?? '') ?>">
                        </div>
                    <?php endfor; ?>
                </div>

                <!-- 答案区域 -->
                <div class="mb-3">
                    <label class="form-label">答案</label>

                    <!-- 单选答案 -->
                    <div id="answerSingle" style="display: none;">
                        <input type="text" class="form-control" name="answer_single" placeholder="输入正确选项编号，如：1"
                               value="<?= e($question['answer'] ?? '') ?>">
                    </div>

                    <!-- 多选答案 -->
                    <div id="answerMultiple" style="display: none;">
                        <?php $multiAns = $question ? json_decode($question['answer'], true) : []; ?>
                        <?php for ($i = 1; $i <= 6; $i++): ?>
                            <div class="form-check">
                                <input class="form-check-input" type="checkbox" name="answer_multiple[]" value="<?= $i ?>"
                                       id="ans<?= $i ?>" <?= in_array($i, $multiAns ?: []) ? 'checked' : '' ?>>
                                <label class="form-check-label" for="ans<?= $i ?>">选项<?= $i ?></label>
                            </div>
                        <?php endfor; ?>
                    </div>

                    <!-- 判断题答案 -->
                    <div id="answerJudge" style="display: none;">
                        <select class="form-select" name="answer_judge">
                            <option value="true" <?= ($question['answer'] ?? '') === 'true' ? 'selected' : '' ?>>正确</option>
                            <option value="false" <?= ($question['answer'] ?? '') === 'false' ? 'selected' : '' ?>>错误</option>
                        </select>
                    </div>

                    <!-- 主观题答案 -->
                    <div id="answerText" style="display: none;">
                        <textarea class="form-control" name="answer_text" rows="3" placeholder="参考答案"><?= e($question['answer'] ?? '') ?></textarea>
                    </div>
                </div>

                <div class="mb-3">
                    <label class="form-label">分值</label>
                    <input type="number" class="form-control" name="score" value="<?= $question['score'] ?? 5 ?>" required>
                </div>

                <button type="submit" class="btn btn-primary">保存</button>
                <a href="questions.php" class="btn btn-secondary">取消</a>
            </form>

            <script>
                // 根据题型显示不同的表单元素
                const typeSelect = document.getElementById('questionType');
                const optionsArea = document.getElementById('optionsArea');
                const answerSingle = document.getElementById('answerSingle');
                const answerMultiple = document.getElementById('answerMultiple');
                const answerJudge = document.getElementById('answerJudge');
                const answerText = document.getElementById('answerText');

                function updateFormFields() {
                    const type = typeSelect.value;

                    // 隐藏所有区域
                    optionsArea.style.display = 'none';
                    answerSingle.style.display = 'none';
                    answerMultiple.style.display = 'none';
                    answerJudge.style.display = 'none';
                    answerText.style.display = 'none';

                    // 根据题型显示对应区域
                    if (type === 'single') {
                        optionsArea.style.display = 'block';
                        answerSingle.style.display = 'block';
                    } else if (type === 'multiple') {
                        optionsArea.style.display = 'block';
                        answerMultiple.style.display = 'block';
                    } else if (type === 'judge') {
                        answerJudge.style.display = 'block';
                    } else {
                        answerText.style.display = 'block';
                    }
                }

                typeSelect.addEventListener('change', updateFormFields);
                updateFormFields(); // 初始化
            </script>
        <?php endif; ?>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
</body>
</html>
