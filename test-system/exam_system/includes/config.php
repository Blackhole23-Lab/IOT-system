<?php
/**
 * 数据库配置和初始化文件
 * 使用SQLite + PDO
 */

// 开启错误报告（生产环境应关闭）
error_reporting(E_ALL);
ini_set('display_errors', 1);

// 设置时区
date_default_timezone_set('Asia/Shanghai');

// 数据库文件路径
define('DB_PATH', __DIR__ . '/../exam_system.db');

// 会话配置
define('SESSION_TIMEOUT', 3600); // 1小时

// 分页配置
define('ITEMS_PER_PAGE', 20);

/**
 * 获取数据库连接
 */
function getDB() {
    try {
        $db = new PDO('sqlite:' . DB_PATH);
        $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $db->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
        return $db;
    } catch (PDOException $e) {
        die('数据库连接失败: ' . $e->getMessage());
    }
}

/**
 * 初始化数据库表结构
 */
function initDatabase() {
    $db = getDB();

    // 用户表
    $db->exec("CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'student',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )");

    // 题库表
    $db->exec("CREATE TABLE IF NOT EXISTS questions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        question_text TEXT NOT NULL,
        options TEXT,
        answer TEXT NOT NULL,
        score INTEGER NOT NULL DEFAULT 5,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )");

    // 考试表
    $db->exec("CREATE TABLE IF NOT EXISTS exams (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        duration INTEGER NOT NULL,
        total_score INTEGER NOT NULL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )");

    // 考试-题目关联表
    $db->exec("CREATE TABLE IF NOT EXISTS exam_questions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        exam_id INTEGER NOT NULL,
        question_id INTEGER NOT NULL,
        FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE,
        FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
    )");

    // 提交记录表
    $db->exec("CREATE TABLE IF NOT EXISTS submissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        exam_id INTEGER NOT NULL,
        answers TEXT NOT NULL,
        score REAL DEFAULT 0,
        status TEXT DEFAULT 'pending',
        submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE
    )");

    // 逐题评分明细表
    $db->exec("CREATE TABLE IF NOT EXISTS submission_details (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        submission_id INTEGER NOT NULL,
        question_id INTEGER NOT NULL,
        student_answer TEXT,
        auto_score REAL DEFAULT NULL,
        teacher_score REAL DEFAULT NULL,
        teacher_comment TEXT DEFAULT NULL,
        ai_score REAL DEFAULT NULL,
        ai_comment TEXT DEFAULT NULL,
        graded_by INTEGER DEFAULT NULL,
        graded_at DATETIME DEFAULT NULL,
        FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE,
        FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
    )");

    // 创建默认管理员账号（用户名：admin，密码：admin123）
    $stmt = $db->prepare("SELECT COUNT(*) as count FROM users WHERE role = 'admin'");
    $stmt->execute();
    $result = $stmt->fetch();

    if ($result['count'] == 0) {
        $stmt = $db->prepare("INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)");
        $stmt->execute([
            'admin',
            'admin@example.com',
            password_hash('admin123', PASSWORD_DEFAULT),
            'admin'
        ]);
    }
}

// 自动初始化数据库
if (!file_exists(DB_PATH)) {
    initDatabase();
} else {
    // 已有数据库时，确保新表存在
    $db = getDB();
    $db->exec("CREATE TABLE IF NOT EXISTS submission_details (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        submission_id INTEGER NOT NULL,
        question_id INTEGER NOT NULL,
        student_answer TEXT,
        auto_score REAL DEFAULT NULL,
        teacher_score REAL DEFAULT NULL,
        teacher_comment TEXT DEFAULT NULL,
        ai_score REAL DEFAULT NULL,
        ai_comment TEXT DEFAULT NULL,
        graded_by INTEGER DEFAULT NULL,
        graded_at DATETIME DEFAULT NULL,
        FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE,
        FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
    )");
}
