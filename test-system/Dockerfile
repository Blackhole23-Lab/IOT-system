# 使用官方 PHP 8.3 Apache 镜像作为基础镜像
FROM php:8.3-apache

# 设置维护者信息
LABEL maintainer="your-email@example.com"
LABEL description="Online Exam System - PHP + SQLite + Apache"

# 设置工作目录
WORKDIR /var/www/html

# 安装系统依赖和PHP扩展
# - sqlite3: SQLite命令行工具（调试用）
# - libsqlite3-dev: SQLite开发库
# - zip/unzip: 可能需要的工具
RUN apt-get update && apt-get install -y \
    sqlite3 \
    libsqlite3-dev \
    zip \
    unzip \
    && docker-php-ext-install pdo pdo_sqlite \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# 启用Apache模块
# - rewrite: 支持URL重写（如果需要）
# - headers: 支持自定义HTTP头
RUN a2enmod rewrite headers

# 创建必要的目录并设置权限
# - /var/www/html/data: 存放SQLite数据库
# - /var/www/html/uploads: 存放上传的CSV文件
# - /var/www/html/sessions: 存放session文件
RUN mkdir -p /var/www/html/data \
    /var/www/html/uploads \
    /var/www/html/sessions \
    && chown -R www-data:www-data /var/www/html \
    && chmod -R 755 /var/www/html

# 配置PHP
# 复制自定义PHP配置（如果需要）
COPY docker/php.ini /usr/local/etc/php/conf.d/custom.ini

# 配置Apache
# 复制自定义Apache配置
COPY docker/apache.conf /etc/apache2/sites-available/000-default.conf

# 复制应用代码到容器
# 注意：.dockerignore 会排除不需要的文件
COPY --chown=www-data:www-data exam_system/ /var/www/html/

# 如果数据库文件已存在，移动到data目录
# 生产环境建议通过volume挂载，这里只是示例
RUN if [ -f /var/www/html/exam_system.db ]; then \
        mv /var/www/html/exam_system.db /var/www/html/data/exam_system.db; \
    fi

# 设置环境变量默认值
ENV APACHE_DOCUMENT_ROOT=/var/www/html \
    PHP_TIMEZONE=Asia/Shanghai \
    PHP_MEMORY_LIMIT=256M \
    PHP_UPLOAD_MAX_FILESIZE=10M \
    PHP_POST_MAX_SIZE=10M \
    DB_PATH=/var/www/html/data/exam_system.db \
    SESSION_SAVE_PATH=/var/www/html/sessions

# 暴露80端口
EXPOSE 80

# 健康检查
# 每30秒检查一次，超时3秒，重试3次后标记为unhealthy
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD curl -f http://localhost/ || exit 1

# 使用自定义入口脚本（可选，用于初始化）
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

# 启动Apache（以root运行entrypoint，Apache会自动切换到www-data）
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["apache2-foreground"]
