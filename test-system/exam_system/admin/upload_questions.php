<?php
/**
 * 管理员 - 批量导入题目
 */
require_once '../includes/config.php';
require_once '../includes/auth.php';
require_once '../includes/functions.php';

requireAdmin();

$db = getDB();
$errors = [];
$success = 0;

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_FILES['json_file'])) {
    $file = $_FILES['json_file'];

    if ($file['error'] === UPLOAD_ERR_OK) {
        $jsonContent = file_get_contents($file['tmp_name']);
        $data = json_decode($jsonContent, true);

        if (json_last_error() === JSON_ERROR_NONE && isset($data['questions']) && is_array($data['questions'])) {
            foreach ($data['questions'] as $question) {
                // 验证必需字段
                if (empty($question['type']) || empty($question['question_text']) || !isset($question['score']) || !isset($question['answer'])) {
                    $errors[] = "题目格式错误：缺少必需字段（type, question_text, answer, score）";
                    continue;
                }

                $type = trim($question['type']);
                $questionText = trim($question['question_text']);
                $score = intval($question['score']);
                $answer = '';
                $options = '';

                // 如果有 code_snippet，将其作为代码块拼接到题目文本
                if (!empty($question['code_snippet'])) {
                    $lang = !empty($question['code_language']) ? $question['code_language'] : 'c';
                    $questionText .= "\n```" . $lang . "\n" . trim($question['code_snippet']) . "\n```";
                }

                // 根据题型处理
                if ($type === 'single' || $type === 'multiple') {
                    if (empty($question['options']) || !is_array($question['options'])) {
                        $errors[] = "题目「{$questionText}」缺少选项";
                        continue;
                    }
                    $options = json_encode($question['options'], JSON_UNESCAPED_UNICODE);

                    if ($type === 'multiple') {
                        // 多选答案应该是数组
                        if (!isset($question['answer']) || !is_array($question['answer'])) {
                            $errors[] = "题目「{$questionText}」多选答案格式错误（必须是数组）";
                            continue;
                        }
                        $answer = json_encode($question['answer'], JSON_UNESCAPED_UNICODE);
                    } else {
                        // 单选答案
                        if (!isset($question['answer'])) {
                            $errors[] = "题目「{$questionText}」缺少答案";
                            continue;
                        }
                        $answer = $question['answer'];
                    }
                } elseif ($type === 'judge') {
                    if (!isset($question['answer'])) {
                        $errors[] = "题目「{$questionText}」缺少答案";
                        continue;
                    }
                    $answer = $question['answer'];
                } else {
                    // 编程题、简答题
                    if (!isset($question['answer'])) {
                        $errors[] = "题目「{$questionText}」缺少答案";
                        continue;
                    }
                    $answer = $question['answer'];
                }

                try {
                    $stmt = $db->prepare("INSERT INTO questions (type, question_text, options, answer, score) VALUES (?, ?, ?, ?, ?)");
                    $stmt->execute([$type, $questionText, $options, $answer, $score]);
                    $success++;
                } catch (Exception $e) {
                    $errors[] = "导入失败：{$questionText} - " . $e->getMessage();
                }
            }

            if ($success > 0) {
                setFlash('success', "成功导入 {$success} 道题目");
                redirect('questions.php');
            }
        } else {
            $errors[] = 'JSON格式错误或缺少questions数组';
        }
    } else {
        $errors[] = '文件上传失败';
    }
}
?>
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>批量导入题目 - 在线考试系统</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
</head>
<body>
    <nav class="navbar navbar-expand-lg navbar-dark bg-primary">
        <div class="container">
            <a class="navbar-brand" href="../dashboard.php">在线考试系统</a>
            <div class="navbar-nav ms-auto">
                <a class="nav-link" href="questions.php">返回题库</a>
                <a class="nav-link" href="../logout.php">退出</a>
            </div>
        </div>
    </nav>

    <div class="container mt-4">
        <h2 class="mb-4">批量导入题目</h2>

        <?php if (!empty($errors)): ?>
            <div class="alert alert-danger">
                <ul class="mb-0">
                    <?php foreach ($errors as $error): ?>
                        <li><?= e($error) ?></li>
                    <?php endforeach; ?>
                </ul>
            </div>
        <?php endif; ?>

        <div class="card">
            <div class="card-body">
                <h5 class="card-title">上传JSON文件</h5>

                <div class="alert alert-info">
                    <strong>JSON格式说明：</strong><br>
                    文件必须包含一个 <code>questions</code> 数组，每个题目包含以下字段：<br><br>

                    <strong>必需字段：</strong><br>
                    - <code>type</code>: 题型（single/multiple/judge/code/essay）<br>
                    - <code>question_text</code>: 题目内容<br>
                    - <code>answer</code>: 答案<br>
                    - <code>score</code>: 分值（数字）<br><br>

                    <strong>可选字段：</strong><br>
                    - <code>options</code>: 选项数组（单选题和多选题必需）<br>
                    - <code>code_snippet</code>: 代码片段（会自动以代码块形式附加到题目文本后）<br>
                    - <code>code_language</code>: 代码语言（默认c，如 python/java/cpp 等）<br><br>

                    <strong>题型说明：</strong><br>
                    - <strong>single</strong>: 单选题，answer为选项索引（从1开始）<br>
                    - <strong>multiple</strong>: 多选题，answer为选项索引数组，如 [1,2,3]<br>
                    - <strong>judge</strong>: 判断题，answer为 "true" 或 "false"<br>
                    - <strong>code</strong>: 编程题，answer为参考代码<br>
                    - <strong>essay</strong>: 简答题，answer为参考答案
                </div>

                <form method="POST" enctype="multipart/form-data">
                    <div class="mb-3">
                        <label for="json_file" class="form-label">选择JSON文件</label>
                        <input type="file" class="form-control" id="json_file" name="json_file" accept=".json" required>
                    </div>

                    <button type="submit" class="btn btn-primary">开始导入</button>
                    <a href="questions.php" class="btn btn-secondary">取消</a>
                </form>

                <hr>

                <h6>示例JSON格式：</h6>
                <pre class="bg-light p-3" style="max-height: 400px; overflow-y: auto;">
{
  "questions": [
    {
      "type": "single",
      "question_text": "PHP是什么类型的语言？",
      "options": ["编译型", "解释型", "汇编语言", "机器语言"],
      "answer": "2",
      "score": 5
    },
    {
      "type": "multiple",
      "question_text": "以下哪些是PHP框架？",
      "options": ["Laravel", "Django", "CodeIgniter", "Flask", "Symfony"],
      "answer": ["1", "3", "5"],
      "score": 10
    },
    {
      "type": "judge",
      "question_text": "PHP是开源的",
      "answer": "true",
      "score": 5
    },
    {
      "type": "code",
      "question_text": "编写一个PHP函数计算两个数的和",
      "answer": "function add($a, $b) { return $a + $b; }",
      "score": 20
    },
    {
      "type": "code",
      "question_text": "将下列不安全的代码改写为使用 fgets 的安全版本",
      "code_snippet": "void greet() {\n    char name[64];\n    printf(\"你的名字？ \");\n    scanf(\"%s\", name);\n    printf(\"Hello, %s!\\n\", name);\n}",
      "code_language": "c",
      "answer": "void greet() {\n    char name[64] = {0};\n    printf(\"你的名字？ \");\n    if (fgets(name, sizeof(name), stdin)) {\n        name[strcspn(name, \"\\n\")] = '\\0';\n        printf(\"Hello, %s!\\n\", name);\n    }\n}",
      "score": 10
    },
    {
      "type": "essay",
      "question_text": "简述MVC设计模式",
      "answer": "MVC是一种软件架构模式，将应用程序分为三个核心组件：模型(Model)负责数据和业务逻辑，视图(View)负责用户界面展示，控制器(Controller)负责处理用户输入和协调模型与视图。",
      "score": 15
    }
  ]
}
                </pre>
            </div>
        </div>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
</body>
</html>
