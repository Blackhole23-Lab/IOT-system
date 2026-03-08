# 在线考试系统 - Docker部署指南

## 快速开始

### 1. 构建镜像
```bash
# 在项目根目录执行
docker-compose build
```

### 2. 启动容器
```bash
# 后台运行
docker-compose up -d

# 前台运行（查看日志）
docker-compose up
```

### 3. 访问系统
打开浏览器访问：http://localhost:8080

### 4. 停止容器
```bash
docker-compose down
```

---

## 完整命令参考

### 构建与运行

```bash
# 构建镜像（首次或代码更新后）
docker-compose build

# 强制重新构建（不使用缓存）
docker-compose build --no-cache

# 启动服务
docker-compose up -d

# 查看运行状态
docker-compose ps

# 查看日志
docker-compose logs -f exam-system

# 查看最近100行日志
docker-compose logs --tail=100 exam-system
```

### 容器管理

```bash
# 进入容器shell（调试用）
docker-compose exec exam-system bash

# 以root身份进入（需要修改权限时）
docker-compose exec -u root exam-system bash

# 重启容器
docker-compose restart exam-system

# 停止容器
docker-compose stop

# 停止并删除容器（保留数据卷）
docker-compose down

# 停止并删除容器和数据卷（危险！会删除数据库）
docker-compose down -v
```

### 数据库操作

```bash
# 进入容器查看数据库
docker-compose exec exam-system sqlite3 /var/www/html/data/exam_system.db

# 在SQLite中执行命令
.tables          # 查看所有表
.schema users    # 查看表结构
SELECT * FROM users LIMIT 5;  # 查询数据
.quit            # 退出

# 备份数据库
docker-compose exec exam-system sqlite3 /var/www/html/data/exam_system.db .dump > backup.sql

# 恢复数据库
cat backup.sql | docker-compose exec -T exam-system sqlite3 /var/www/html/data/exam_system.db
```

### 代码更新部署

```bash
# 方式1：重新构建镜像（推荐生产环境）
git pull                    # 拉取最新代码
docker-compose build        # 重新构建
docker-compose up -d        # 重启容器

# 方式2：开发模式热重载
# 在docker-compose.yml中取消注释以下行：
# - ./:/var/www/html:ro
# 然后重启容器，代码修改会立即生效
```

### 查看资源使用

```bash
# 查看容器资源占用
docker stats exam-system

# 查看磁盘使用
docker system df

# 查看数据卷
docker volume ls
docker volume inspect exam-system_exam_data
```

---

## 开发环境配置

### 启用热重载

编辑 `docker-compose.yml`，取消注释以下行：

```yaml
volumes:
  - ./:/var/www/html:ro  # 挂载源代码
```

然后重启容器：
```bash
docker-compose restart
```

### 启用PHP错误显示

编辑 `docker/php.ini`，取消注释开发环境配置：

```ini
display_errors = On
display_startup_errors = On
error_reporting = E_ALL
```

重新构建镜像：
```bash
docker-compose build
docker-compose up -d
```

---

## 生产环境部署

### 1. 修改端口（可选）

编辑 `docker-compose.yml`：
```yaml
ports:
  - "80:80"  # 使用标准HTTP端口
```

### 2. 配置域名

编辑 `docker/apache.conf`：
```apache
ServerName your-domain.com
```

### 3. 配置HTTPS（推荐）

使用Nginx反向代理 + Let's Encrypt：

```bash
# 安装certbot
sudo apt-get install certbot python3-certbot-nginx

# 获取SSL证书
sudo certbot --nginx -d your-domain.com

# Nginx配置示例
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 4. 定期备份

创建备份脚本 `backup.sh`：

```bash
#!/bin/bash
BACKUP_DIR="/backups/exam-system"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# 备份数据库
docker-compose exec -T exam-system sqlite3 /var/www/html/data/exam_system.db .dump > $BACKUP_DIR/db_$DATE.sql

# 备份上传文件
docker cp exam-system:/var/www/html/uploads $BACKUP_DIR/uploads_$DATE

# 保留最近7天的备份
find $BACKUP_DIR -name "db_*.sql" -mtime +7 -delete
find $BACKUP_DIR -name "uploads_*" -mtime +7 -delete

echo "Backup completed: $DATE"
```

添加到crontab：
```bash
# 每天凌晨2点备份
0 2 * * * /path/to/backup.sh >> /var/log/exam-backup.log 2>&1
```

---

## 故障排查

### 容器无法启动

```bash
# 查看详细日志
docker-compose logs exam-system

# 检查端口占用
sudo netstat -tulpn | grep 8080

# 检查磁盘空间
df -h
```

### 数据库权限错误

```bash
# 进入容器检查权限
docker-compose exec -u root exam-system bash
ls -la /var/www/html/data/
chown -R www-data:www-data /var/www/html/data/
chmod 755 /var/www/html/data/
chmod 644 /var/www/html/data/exam_system.db
```

### 文件上传失败

```bash
# 检查uploads目录权限
docker-compose exec exam-system ls -la /var/www/html/uploads/

# 修复权限
docker-compose exec -u root exam-system chown -R www-data:www-data /var/www/html/uploads/
```

### 性能问题

```bash
# 查看SQLite数据库大小
docker-compose exec exam-system du -h /var/www/html/data/exam_system.db

# 优化数据库
docker-compose exec exam-system sqlite3 /var/www/html/data/exam_system.db "VACUUM;"

# 查看容器资源使用
docker stats exam-system
```

---

## 数据持久化说明

Docker Compose会自动创建以下数据卷：

- `exam_data`: 存储SQLite数据库文件
- `exam_uploads`: 存储上传的CSV文件
- `exam_sessions`: 存储PHP session文件

即使删除容器，这些数据也会保留。要完全清除数据：

```bash
docker-compose down -v  # 危险操作！
```

---

## 迁移到MySQL/PostgreSQL

### 1. 修改 `docker-compose.yml`

添加数据库服务：

```yaml
services:
  exam-system:
    # ... 现有配置 ...
    environment:
      - DB_TYPE=mysql
      - DB_HOST=mysql
      - DB_PORT=3306
      - DB_NAME=exam_system
      - DB_USER=exam_user
      - DB_PASSWORD=secure_password
    depends_on:
      - mysql

  mysql:
    image: mysql:8.0
    container_name: exam-mysql
    environment:
      MYSQL_ROOT_PASSWORD: root_password
      MYSQL_DATABASE: exam_system
      MYSQL_USER: exam_user
      MYSQL_PASSWORD: secure_password
    volumes:
      - mysql_data:/var/lib/mysql
    networks:
      - exam-network

volumes:
  mysql_data:
```

### 2. 修改 `includes/config.php`

```php
<?php
// 读取环境变量
$db_type = getenv('DB_TYPE') ?: 'sqlite';

if ($db_type === 'mysql') {
    $db_host = getenv('DB_HOST') ?: 'localhost';
    $db_port = getenv('DB_PORT') ?: '3306';
    $db_name = getenv('DB_NAME') ?: 'exam_system';
    $db_user = getenv('DB_USER') ?: 'root';
    $db_pass = getenv('DB_PASSWORD') ?: '';

    $dsn = "mysql:host=$db_host;port=$db_port;dbname=$db_name;charset=utf8mb4";
    $pdo = new PDO($dsn, $db_user, $db_pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
} else {
    // SQLite配置（原有代码）
    $db_path = getenv('DB_PATH') ?: __DIR__ . '/../data/exam_system.db';
    $pdo = new PDO("sqlite:$db_path");
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
}
?>
```

### 3. 数据迁移

```bash
# 导出SQLite数据
docker-compose exec exam-system sqlite3 /var/www/html/data/exam_system.db .dump > sqlite_dump.sql

# 转换为MySQL格式（需要手动调整）
# 主要差异：
# - 自增主键：INTEGER PRIMARY KEY AUTOINCREMENT -> INT AUTO_INCREMENT PRIMARY KEY
# - 数据类型：TEXT -> VARCHAR(255) 或 TEXT
# - 布尔值：0/1 -> BOOLEAN

# 导入MySQL
docker-compose exec -T mysql mysql -u exam_user -p exam_system < mysql_dump.sql
```

---

## 安全建议

1. **修改默认密码**：首次部署后立即修改管理员密码
2. **启用HTTPS**：生产环境必须使用SSL证书
3. **定期备份**：设置自动备份任务
4. **限制访问**：使用防火墙限制访问IP
5. **更新镜像**：定期更新PHP和系统包
6. **监控日志**：定期检查错误日志
7. **资源限制**：在docker-compose.yml中设置CPU和内存限制

---

## 性能优化

1. **启用OPcache**：已在php.ini中配置
2. **SQLite优化**：定期执行VACUUM清理
3. **静态资源CDN**：将CSS/JS/图片放到CDN
4. **反向代理缓存**：使用Nginx缓存静态资源
5. **数据库索引**：为常用查询字段添加索引

---

## 联系支持

如有问题，请查看：
- 项目文档：README.md
- 日志文件：`docker-compose logs`
- GitHub Issues：[项目地址]
