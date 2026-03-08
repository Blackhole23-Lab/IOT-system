# 在线考试系统 - 生产环境注意事项

## 1. SQLite并发限制

### 问题
SQLite是文件型数据库，写操作会锁定整个数据库，不适合高并发场景。

### 建议
- **小型应用**（<50并发用户）：SQLite足够
- **中型应用**（50-200并发）：考虑迁移到MySQL/PostgreSQL
- **大型应用**（>200并发）：必须使用MySQL/PostgreSQL + 读写分离

### 优化措施
```bash
# 定期优化数据库
docker-compose exec exam-system sqlite3 /var/www/html/data/exam_system.db "PRAGMA optimize;"
docker-compose exec exam-system sqlite3 /var/www/html/data/exam_system.db "VACUUM;"

# 启用WAL模式（提升并发性能）
docker-compose exec exam-system sqlite3 /var/www/html/data/exam_system.db "PRAGMA journal_mode=WAL;"
```

---

## 2. 数据备份策略

### 自动备份脚本

创建 `/opt/exam-backup/backup.sh`：

```bash
#!/bin/bash
set -e

BACKUP_DIR="/opt/exam-backup/backups"
RETENTION_DAYS=30
DATE=$(date +%Y%m%d_%H%M%S)
CONTAINER_NAME="exam-system"

# 创建备份目录
mkdir -p $BACKUP_DIR

# 备份数据库
echo "[$(date)] Starting database backup..."
docker-compose -f /path/to/docker-compose.yml exec -T $CONTAINER_NAME \
    sqlite3 /var/www/html/data/exam_system.db .dump \
    | gzip > $BACKUP_DIR/db_$DATE.sql.gz

# 备份上传文件
echo "[$(date)] Starting uploads backup..."
docker cp $CONTAINER_NAME:/var/www/html/uploads $BACKUP_DIR/uploads_$DATE
tar -czf $BACKUP_DIR/uploads_$DATE.tar.gz -C $BACKUP_DIR uploads_$DATE
rm -rf $BACKUP_DIR/uploads_$DATE

# 清理旧备份
echo "[$(date)] Cleaning old backups..."
find $BACKUP_DIR -name "db_*.sql.gz" -mtime +$RETENTION_DAYS -delete
find $BACKUP_DIR -name "uploads_*.tar.gz" -mtime +$RETENTION_DAYS -delete

# 备份到远程（可选）
# rsync -avz $BACKUP_DIR/ user@backup-server:/backups/exam-system/

echo "[$(date)] Backup completed successfully"
```

### 设置定时任务

```bash
# 编辑crontab
sudo crontab -e

# 添加以下行（每天凌晨2点备份）
0 2 * * * /opt/exam-backup/backup.sh >> /var/log/exam-backup.log 2>&1

# 每周日凌晨3点清理Docker未使用资源
0 3 * * 0 docker system prune -af --volumes >> /var/log/docker-cleanup.log 2>&1
```

### 恢复数据

```bash
# 恢复数据库
gunzip -c /opt/exam-backup/backups/db_20260305_020000.sql.gz | \
    docker-compose exec -T exam-system sqlite3 /var/www/html/data/exam_system.db

# 恢复上传文件
tar -xzf /opt/exam-backup/backups/uploads_20260305_020000.tar.gz
docker cp uploads_20260305/. exam-system:/var/www/html/uploads/
```

---

## 3. 文件权限管理

### 常见权限问题

```bash
# 问题：数据库无法写入
# 解决：
docker-compose exec -u root exam-system bash
chown www-data:www-data /var/www/html/data/exam_system.db
chmod 644 /var/www/html/data/exam_system.db
chmod 755 /var/www/html/data/

# 问题：文件上传失败
# 解决：
chown -R www-data:www-data /var/www/html/uploads/
chmod -R 755 /var/www/html/uploads/

# 问题：Session无法保存
# 解决：
chown -R www-data:www-data /var/www/html/sessions/
chmod -R 700 /var/www/html/sessions/
```

### 安全权限设置

```bash
# 进入容器
docker-compose exec -u root exam-system bash

# 设置安全权限
find /var/www/html -type d -exec chmod 755 {} \;
find /var/www/html -type f -exec chmod 644 {} \;

# 敏感目录只允许www-data访问
chmod 700 /var/www/html/sessions/
chmod 755 /var/www/html/data/
chmod 644 /var/www/html/data/exam_system.db

# 禁止执行上传目录中的PHP
chmod 755 /var/www/html/uploads/
# Apache配置已禁用PHP执行
```

---

## 4. HTTPS配置（强烈推荐）

### 方案A：使用Nginx反向代理 + Let's Encrypt

#### 1. 安装Nginx和Certbot

```bash
sudo apt-get update
sudo apt-get install nginx certbot python3-certbot-nginx
```

#### 2. 配置Nginx

创建 `/etc/nginx/sites-available/exam-system`：

```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

    # 重定向到HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com www.your-domain.com;

    # SSL证书（certbot会自动配置）
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    # SSL配置
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # 安全头部
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # 反向代理到Docker容器
    location / {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Port $server_port;

        # 超时设置
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # 静态资源缓存
    location ~* \.(jpg|jpeg|png|gif|ico|css|js|svg|woff|woff2|ttf|eot)$ {
        proxy_pass http://localhost:8080;
        expires 1M;
        add_header Cache-Control "public, immutable";
    }

    # 日志
    access_log /var/log/nginx/exam-system-access.log;
    error_log /var/log/nginx/exam-system-error.log;
}
```

#### 3. 启用配置并获取证书

```bash
# 启用站点
sudo ln -s /etc/nginx/sites-available/exam-system /etc/nginx/sites-enabled/

# 测试配置
sudo nginx -t

# 重启Nginx
sudo systemctl restart nginx

# 获取SSL证书
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# 自动续期（certbot会自动添加到cron）
sudo certbot renew --dry-run
```

### 方案B：使用Traefik（推荐Docker环境）

修改 `docker-compose.yml`：

```yaml
version: '3.8'

services:
  traefik:
    image: traefik:v2.10
    container_name: traefik
    command:
      - "--api.insecure=true"
      - "--providers.docker=true"
      - "--entrypoints.web.address=:80"
      - "--entrypoints.websecure.address=:443"
      - "--certificatesresolvers.letsencrypt.acme.email=your-email@example.com"
      - "--certificatesresolvers.letsencrypt.acme.storage=/letsencrypt/acme.json"
      - "--certificatesresolvers.letsencrypt.acme.httpchallenge.entrypoint=web"
    ports:
      - "80:80"
      - "443:443"
      - "8080:8080"  # Traefik dashboard
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - traefik-certs:/letsencrypt
    networks:
      - exam-network

  exam-system:
    # ... 现有配置 ...
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.exam.rule=Host(`your-domain.com`)"
      - "traefik.http.routers.exam.entrypoints=websecure"
      - "traefik.http.routers.exam.tls.certresolver=letsencrypt"
      - "traefik.http.services.exam.loadbalancer.server.port=80"
      # HTTP to HTTPS redirect
      - "traefik.http.middlewares.redirect-to-https.redirectscheme.scheme=https"
      - "traefik.http.routers.exam-http.rule=Host(`your-domain.com`)"
      - "traefik.http.routers.exam-http.entrypoints=web"
      - "traefik.http.routers.exam-http.middlewares=redirect-to-https"

volumes:
  traefik-certs:
```

---

## 5. 监控和日志

### 日志管理

```bash
# 查看实时日志
docker-compose logs -f exam-system

# 查看Apache访问日志
docker-compose exec exam-system tail -f /var/log/apache2/access.log

# 查看PHP错误日志
docker-compose exec exam-system tail -f /var/log/apache2/php_errors.log

# 导出日志
docker-compose logs exam-system > exam-system.log
```

### 日志轮转

在 `docker-compose.yml` 中已配置：

```yaml
logging:
  driver: "json-file"
  options:
    max-size: "10m"
    max-file: "3"
```

### 监控脚本

创建 `/opt/exam-backup/monitor.sh`：

```bash
#!/bin/bash

CONTAINER_NAME="exam-system"
ALERT_EMAIL="admin@example.com"

# 检查容器状态
if ! docker ps | grep -q $CONTAINER_NAME; then
    echo "Container $CONTAINER_NAME is not running!" | mail -s "ALERT: Container Down" $ALERT_EMAIL
    docker-compose -f /path/to/docker-compose.yml up -d
fi

# 检查磁盘空间
DISK_USAGE=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
if [ $DISK_USAGE -gt 80 ]; then
    echo "Disk usage is at ${DISK_USAGE}%" | mail -s "ALERT: High Disk Usage" $ALERT_EMAIL
fi

# 检查数据库大小
DB_SIZE=$(docker-compose -f /path/to/docker-compose.yml exec -T $CONTAINER_NAME \
    du -h /var/www/html/data/exam_system.db | cut -f1)
echo "Database size: $DB_SIZE"

# 检查容器健康状态
HEALTH=$(docker inspect --format='{{.State.Health.Status}}' $CONTAINER_NAME)
if [ "$HEALTH" != "healthy" ]; then
    echo "Container health check failed: $HEALTH" | mail -s "ALERT: Unhealthy Container" $ALERT_EMAIL
fi
```

添加到crontab：
```bash
*/5 * * * * /opt/exam-backup/monitor.sh >> /var/log/exam-monitor.log 2>&1
```

---

## 6. 性能优化

### SQLite优化

在 `includes/config.php` 中添加：

```php
// SQLite性能优化
$pdo->exec('PRAGMA journal_mode=WAL;');        // 提升并发性能
$pdo->exec('PRAGMA synchronous=NORMAL;');      // 平衡性能和安全
$pdo->exec('PRAGMA cache_size=10000;');        // 增加缓存
$pdo->exec('PRAGMA temp_store=MEMORY;');       // 临时表存内存
$pdo->exec('PRAGMA mmap_size=30000000000;');   // 使用内存映射
```

### Apache优化

编辑 `docker/apache.conf`，添加：

```apache
# 启用压缩
<IfModule mod_deflate.c>
    AddOutputFilterByType DEFLATE text/html text/plain text/xml text/css
    AddOutputFilterByType DEFLATE text/javascript application/javascript application/json
    AddOutputFilterByType DEFLATE application/xml application/xhtml+xml
</IfModule>

# 启用KeepAlive
KeepAlive On
MaxKeepAliveRequests 100
KeepAliveTimeout 5

# 限制并发连接
<IfModule mpm_prefork_module>
    StartServers 5
    MinSpareServers 5
    MaxSpareServers 10
    MaxRequestWorkers 150
    MaxConnectionsPerChild 3000
</IfModule>
```

### 资源限制

在 `docker-compose.yml` 中调整：

```yaml
deploy:
  resources:
    limits:
      cpus: '2.0'      # 根据服务器配置调整
      memory: 1G
    reservations:
      cpus: '1.0'
      memory: 512M
```

---

## 7. 安全加固

### 防火墙配置

```bash
# 只允许HTTP/HTTPS访问
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 22/tcp  # SSH
sudo ufw enable

# 限制SSH访问（可选）
sudo ufw limit 22/tcp
```

### 定期更新

```bash
# 更新系统包
sudo apt-get update && sudo apt-get upgrade -y

# 更新Docker镜像
docker-compose pull
docker-compose up -d

# 清理旧镜像
docker image prune -a
```

### 安全扫描

```bash
# 扫描镜像漏洞
docker scan exam-system:latest

# 或使用Trivy
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
    aquasec/trivy image exam-system:latest
```

---

## 8. 故障恢复

### 容器崩溃自动重启

已在 `docker-compose.yml` 中配置：
```yaml
restart: unless-stopped
```

### 数据库损坏恢复

```bash
# 检查数据库完整性
docker-compose exec exam-system sqlite3 /var/www/html/data/exam_system.db "PRAGMA integrity_check;"

# 如果损坏，从备份恢复
gunzip -c /opt/exam-backup/backups/db_latest.sql.gz | \
    docker-compose exec -T exam-system sqlite3 /var/www/html/data/exam_system.db
```

### 完整灾难恢复流程

```bash
# 1. 停止服务
docker-compose down

# 2. 恢复数据卷
docker volume rm exam-system_exam_data
docker volume create exam-system_exam_data

# 3. 恢复数据库
gunzip -c /opt/exam-backup/backups/db_latest.sql.gz > restore.sql
docker-compose up -d
docker-compose exec -T exam-system sqlite3 /var/www/html/data/exam_system.db < restore.sql

# 4. 恢复上传文件
tar -xzf /opt/exam-backup/backups/uploads_latest.tar.gz
docker cp uploads/. exam-system:/var/www/html/uploads/

# 5. 验证服务
curl http://localhost:8080
```

---

## 9. 迁移到MySQL/PostgreSQL

### 何时迁移？

- 并发用户 > 50
- 数据库大小 > 1GB
- 需要复杂查询和事务
- 需要主从复制

### 迁移步骤

详见 `DOCKER_GUIDE.md` 中的"迁移到MySQL/PostgreSQL"章节。

---

## 10. 检查清单

部署前检查：

- [ ] 修改默认管理员密码
- [ ] 配置HTTPS证书
- [ ] 设置自动备份
- [ ] 配置防火墙
- [ ] 设置监控告警
- [ ] 测试备份恢复流程
- [ ] 配置日志轮转
- [ ] 设置资源限制
- [ ] 启用WAL模式
- [ ] 配置域名DNS
- [ ] 测试负载能力
- [ ] 准备应急预案

运维检查（每周）：

- [ ] 检查磁盘空间
- [ ] 检查备份完整性
- [ ] 查看错误日志
- [ ] 检查容器健康状态
- [ ] 优化数据库（VACUUM）
- [ ] 更新系统包
- [ ] 检查SSL证书有效期

---

## 联系支持

如遇到问题，请提供以下信息：

```bash
# 系统信息
uname -a
docker --version
docker-compose --version

# 容器状态
docker-compose ps
docker-compose logs --tail=100 exam-system

# 资源使用
docker stats exam-system --no-stream
df -h
free -h
```
