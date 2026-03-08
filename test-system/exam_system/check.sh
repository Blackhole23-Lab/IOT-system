#!/bin/bash
# 项目完整性检查脚本

echo "=========================================="
echo "  在线考试系统 - 项目完整性检查"
echo "=========================================="
echo ""

# 检查必需文件
echo "检查核心文件..."
files=(
    "index.php"
    "login.php"
    "register.php"
    "logout.php"
    "dashboard.php"
    "includes/config.php"
    "includes/auth.php"
    "includes/functions.php"
    "admin/questions.php"
    "admin/upload_questions.php"
    "admin/exams.php"
    "admin/submissions.php"
    "student/exams.php"
    "student/take_exam.php"
    "assets/css/style.css"
    "assets/js/main.js"
    "sample_questions.csv"
    "README.md"
)

missing=0
for file in "${files[@]}"; do
    if [ -f "$file" ]; then
        echo "✓ $file"
    else
        echo "✗ $file (缺失)"
        missing=$((missing + 1))
    fi
done

echo ""
echo "检查目录结构..."
dirs=("admin" "student" "includes" "assets" "assets/css" "assets/js")
for dir in "${dirs[@]}"; do
    if [ -d "$dir" ]; then
        echo "✓ $dir/"
    else
        echo "✗ $dir/ (缺失)"
        missing=$((missing + 1))
    fi
done

echo ""
echo "=========================================="
if [ $missing -eq 0 ]; then
    echo "✓ 项目完整性检查通过！"
    echo ""
    echo "统计信息："
    echo "  PHP文件: $(find . -name "*.php" | wc -l) 个"
    echo "  代码行数: $(find . -name "*.php" -exec wc -l {} + | tail -1 | awk '{print $1}') 行"
    echo "  文档文件: $(find . -name "*.md" | wc -l) 个"
    echo ""
    echo "可以开始使用了！运行以下命令启动："
    echo "  php -S localhost:8000"
else
    echo "✗ 发现 $missing 个缺失文件/目录"
    echo "请检查项目完整性"
fi
echo "=========================================="
