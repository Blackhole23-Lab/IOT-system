#!/bin/bash
set -e

echo "=========================================="
echo "Exam System Container Starting..."
echo "=========================================="

# 显示环境信息
echo "PHP Version: $(php -v | head -n 1)"
echo "SQLite Version: $(sqlite3 --version)"
echo "Timezone: ${PHP_TIMEZONE}"
echo "Database Path: ${DB_PATH}"
echo "=========================================="

# 确保必要的目录存在并有正确的权限
echo "Checking directories..."
mkdir -p /var/www/html/data
mkdir -p /var/www/html/uploads
mkdir -p /var/www/html/sessions

# 设置目录权限（如果以root运行此脚本）
if [ "$(id -u)" = "0" ]; then
    chown -R www-data:www-data /var/www/html/data
    chown -R www-data:www-data /var/www/html/uploads
    chown -R www-data:www-data /var/www/html/sessions
    chmod -R 755 /var/www/html/data
    chmod -R 755 /var/www/html/uploads
    chmod -R 755 /var/www/html/sessions
fi

# 检查数据库文件
if [ -f "${DB_PATH}" ]; then
    echo "Database file found: ${DB_PATH}"
    echo "Database size: $(du -h ${DB_PATH} | cut -f1)"
else
    echo "Database file not found. It will be created on first access."
fi

# 初始化数据库（如果需要）
# 如果你有初始化SQL脚本，可以在这里执行
# if [ ! -f "${DB_PATH}" ] && [ -f "/var/www/html/init.sql" ]; then
#     echo "Initializing database..."
#     sqlite3 "${DB_PATH}" < /var/www/html/init.sql
# fi

# 配置PHP session路径
if [ -n "${SESSION_SAVE_PATH}" ]; then
    echo "session.save_path = ${SESSION_SAVE_PATH}" > /usr/local/etc/php/conf.d/session.ini
fi

echo "=========================================="
echo "Starting Apache..."
echo "=========================================="

# 执行传入的命令（通常是 apache2-foreground）
exec "$@"
