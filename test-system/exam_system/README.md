# 在线考试系统

一个基于纯PHP + SQLite开发的在线考试系统，无需任何框架和Composer依赖，开箱即用。

## 功能特性

### 用户系统
- 用户注册、登录、退出
- 角色区分：管理员(admin) / 学生(student)
- 密码使用 password_hash() 加密存储
- Session 会话管理

### 管理员功能
- **题库管理**
  - 支持5种题型：单选题、多选题、判断题、编程题、简答题
  - 手动添加、编辑、删除题目
  - CSV批量导入题目
  - 题库列表分页显示（每页20题）

- **考试管理**
  - 创建考试，设置标题、时长
  - 从题库中选择题目
  - 自动计算总分
  - 删除考试

- **成绩管理**
  - 查看所有学生提交记录
  - 导出CSV格式成绩单

### 学生功能
- 查看可参加的考试列表
- 在线答题（带倒计时）
- 自动提交（时间到或手动提交）
- 客观题自动判分
- 查看考试成绩

## 技术栈

- **后端**: PHP 8+
- **数据库**: SQLite 3
- **前端**: HTML5 + Bootstrap 5 + 原生JavaScript
- **安全**: PDO预处理、password_hash、htmlspecialchars

## 安装步骤

### 1. 环境要求

- PHP 8.0 或更高版本
- 启用 PDO 和 SQLite 扩展
- Web服务器（Apache/Nginx）或 PHP内置服务器

### 2. 部署方法

#### 方法一：使用PHP内置服务器（推荐用于开发测试）

```bash
cd exam_system
php -S localhost:8000
```

然后在浏览器访问：http://localhost:8000

#### 方法二：使用Apache/Nginx

1. 将 `exam_system` 目录放到Web服务器根目录
2. 确保Web服务器对目录有读写权限
3. 访问：http://localhost/exam_system

### 3. 权限设置

确保数据库文件可写：

```bash
chmod 666 exam_system.db
chmod 777 exam_system
```

### 4. 默认账号

系统会自动创建默认管理员账号：

- **用户名**: admin
- **密码**: admin123

首次登录后建议修改密码（当前版本未实现修改密码功能，可通过数据库直接修改）。

## 目录结构

```
exam_system/
├── index.php               # 首页
├── login.php              # 登录页面
├── register.php           # 注册页面
├── logout.php             # 退出登录
├── dashboard.php          # 控制面板
├── exam_system.db         # SQLite数据库（自动创建）
├── sample_questions.csv   # 示例题目CSV
├── admin/                 # 管理员功能
│   ├── questions.php      # 题库管理
│   ├── upload_questions.php  # 批量导入
│   ├── exams.php          # 考试管理
│   └── submissions.php    # 提交记录
├── student/               # 学生功能
│   ├── exams.php          # 考试列表
│   └── take_exam.php      # 答题页面
├── includes/              # 核心文件
│   ├── config.php         # 数据库配置
│   ├── auth.php           # 认证函数
│   └── functions.php      # 通用函数
└── assets/                # 静态资源
    ├── css/
    │   └── style.css
    └── js/
        └── main.js
```

## 数据库结构

### users 表（用户表）
- id: 主键
- username: 用户名（唯一）
- email: 邮箱（唯一）
- password: 密码（加密）
- role: 角色（admin/student）
- created_at: 创建时间

### questions 表（题库表）
- id: 主键
- type: 题型（single/multiple/judge/code/essay）
- question_text: 题目内容
- options: 选项（JSON格式）
- answer: 答案
- score: 分值
- created_at: 创建时间

### exams 表（考试表）
- id: 主键
- title: 考试标题
- duration: 时长（分钟）
- total_score: 总分
- created_at: 创建时间

### exam_questions 表（考试-题目关联表）
- id: 主键
- exam_id: 考试ID
- question_id: 题目ID

### submissions 表（提交记录表）
- id: 主键
- user_id: 用户ID
- exam_id: 考试ID
- answers: 答案（JSON格式）
- score: 得分
- status: 状态（pending/completed）
- submitted_at: 提交时间

## 使用说明

### 管理员操作流程

1. **登录系统**
   - 使用 admin/admin123 登录

2. **添加题目**
   - 进入"题库管理"
   - 点击"添加题目"，选择题型并填写内容
   - 或使用"批量导入"上传CSV文件

3. **创建考试**
   - 进入"考试管理"
   - 点击"创建考试"
   - 填写考试标题和时长
   - 从题库中勾选题目
   - 保存（系统自动计算总分）

4. **查看成绩**
   - 进入"提交记录"
   - 查看所有学生的考试成绩
   - 可导出CSV格式

### 学生操作流程

1. **注册账号**
   - 点击"注册"
   - 填写用户名、邮箱、密码
   - 注册成功后自动跳转到登录页

2. **参加考试**
   - 登录后进入"参加考试"
   - 选择要参加的考试
   - 点击"开始考试"
   - 认真答题（注意倒计时）
   - 提交考试

3. **查看成绩**
   - 进入"我的成绩"
   - 查看已完成考试的得分

## CSV批量导入格式

CSV文件格式（第一行为标题行）：

```csv
题型,题目内容,选项1,选项2,选项3,选项4,选项5,选项6,答案,分值
single,题目内容,选项A,选项B,选项C,选项D,,,1,5
multiple,题目内容,选项A,选项B,选项C,选项D,,,1,2,3,10
judge,题目内容,,,,,,,true,5
code,题目内容,,,,,,,参考答案,20
essay,题目内容,,,,,,,参考答案,15
```

**题型代码说明**：
- `single`: 单选题
- `multiple`: 多选题
- `judge`: 判断题
- `code`: 编程题
- `essay`: 简答题

**答案格式说明**：
- 单选题：输入正确选项编号（1-6）
- 多选题：多个选项用逗号分隔，如 `1,2,3`
- 判断题：`true` 或 `false`
- 编程题/简答题：参考答案文本

系统提供了 `sample_questions.csv` 示例文件供参考。

## 自动判分规则

- **单选题**: 选择正确得满分，否则0分
- **多选题**: 完全正确得满分，否则0分（不支持部分得分）
- **判断题**: 选择正确得满分，否则0分
- **编程题**: 需要人工阅卷，状态显示"待阅卷"
- **简答题**: 需要人工阅卷，状态显示"待阅卷"

## 安全特性

- **SQL注入防护**: 使用PDO预处理语句
- **XSS防护**: 使用 htmlspecialchars() 过滤输出
- **密码安全**: 使用 password_hash() 和 password_verify()
- **会话管理**: Session控制登录状态
- **权限控制**: 区分管理员和学生权限

## 注意事项

1. **生产环境部署**
   - 修改 `includes/config.php` 中的错误报告设置
   - 设置合适的文件权限
   - 定期备份数据库文件

2. **数据库备份**
   ```bash
   cp exam_system.db exam_system_backup_$(date +%Y%m%d).db
   ```

3. **性能优化**
   - 对于大量题目，建议添加数据库索引
   - 可以考虑使用MySQL替代SQLite

4. **功能扩展**
   - 当前版本不支持修改密码（可自行扩展）
   - 主观题阅卷功能需要自行实现
   - 可添加考试时间限制（开始/结束时间）

## 常见问题

### Q: 数据库文件在哪里？
A: 数据库文件 `exam_system.db` 会在首次访问时自动创建在项目根目录。

### Q: 如何重置系统？
A: 删除 `exam_system.db` 文件，系统会自动重新创建并初始化。

### Q: 忘记管理员密码怎么办？
A: 删除数据库文件重新初始化，或使用SQLite工具直接修改数据库。

### Q: 如何添加更多管理员？
A: 注册普通账号后，使用SQLite工具修改该用户的role字段为'admin'。

### Q: 考试时间到了会自动提交吗？
A: 是的，倒计时结束后会自动提交考试。

## 开发者信息

- 开发语言: PHP 8+
- 数据库: SQLite 3
- 前端框架: Bootstrap 5
- 开发时间: 2026年

## 许可证

本项目仅供学习和研究使用。

## 更新日志

### v1.0.0 (2026-03-05)
- 初始版本发布
- 实现用户系统
- 实现题库管理
- 实现考试管理
- 实现在线答题
- 实现自动判分
- 实现成绩查看
