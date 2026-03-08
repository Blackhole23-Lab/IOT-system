# 公网IP访问配置指南

## 🌐 你的服务器公网IP

**公网IP地址：** `43.164.129.251`

## ✅ 已完成的配置

1. **修改了 docker-compose.yml**
   - 端口绑定从 `8080:80` 改为 `0.0.0.0:80:80`
   - 现在监听所有网络接口，支持公网访问
   - 使用标准HTTP端口80

2. **Apache配置已就绪**
   - 已配置为接受所有来源的请求
   - 安全头部已设置
   - 敏感目录已保护

## 🚀 部署步骤

### 1. 配置防火墙（重要！）

```bash
# 检查防火墙状态
sudo ufw status

# 如果防火墙未启用，先启用
sudo ufw enable

# 允许HTTP访问（端口80）
sudo ufw allow 80/tcp

# 允许SSH访问（防止被锁定）
sudo ufw allow 22/tcp

# 如果需要HTTPS，也开放443端口
sudo ufw allow 443/tcp

# 重新加载防火墙
sudo ufw reload

# 查看规则
sudo ufw status numbered
```

### 2. 检查云服务器安全组

如果你使用的是云服务器（阿里云、腾讯云、AWS等），还需要在云控制台配置安全组：

**需要开放的端口：**
- **80** (HTTP) - 必须
- **443** (HTTPS) - 推荐
- **22** (SSH) - 管理用

**配置示例（腾讯云/阿里云）：**
```
协议类型: TCP
端口范围: 80
授权对象: 0.0.0.0/0
策略: 允许
```

### 3. 启动Docker容器

```bash
# 进入项目目录
cd /home/ubuntu/test-system

# 如果容器已运行，先停止
docker-compose down

# 重新构建并启动
docker-compose up -d

# 查看日志确认启动成功
docker-compose logs -f exam-system
```

### 4. 验证访问

```bash
# 本地测试
curl http://localhost

# 公网测试（在你的电脑上执行）
curl http://43.164.129.251

# 或直接在浏览器访问
# http://43.164.129.251
```

## 🔍 故障排查

### 无法访问？按顺序检查：

#### 1. 检查容器是否运行
```bash
docker-compose ps
# 应该显示 State: Up
```

#### 2. 检查端口监听
```bash
sudo netstat -tulpn | grep :80
# 应该显示 docker-proxy 监听 0.0.0.0:80
```

#### 3. 检查防火墙
```bash
sudo ufw status
# 应该显示 80/tcp ALLOW
```

#### 4. 检查云服务器安全组
登录云控制台，确认安全组规则已添加

#### 5. 查看容器日志
```bash
docker-compose logs --tail=50 exam-system
```

#### 6. 测试容器内部
```bash
# 进入容器测试
docker-compose exec exam-system curl http://localhost
# 应该返回HTML内容
```

## ⚠️ 重要安全建议

### 1. 立即配置HTTPS（强烈推荐）

HTTP是明文传输，不安全！生产环境必须使用HTTPS。

**方案A：使用Nginx反向代理 + Let's Encrypt（推荐）**

```bash
# 安装Nginx和Certbot
sudo apt-get update
sudo apt-get install nginx certbot python3-certbot-nginx -y

# 创建Nginx配置
sudo nano /etc/nginx/sites-available/exam-system
```

配置内容：
```nginx
server {
    listen 80;
    server_name 43.164.129.251;  # 或你的域名

    location / {
        proxy_pass http://localhost:80;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
# 启用配置
sudo ln -s /etc/nginx/sites-available/exam-system /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

# 如果有域名，获取SSL证书
sudo certbot --nginx -d your-domain.com
```

**如果没有域名，可以使用自签名证书（浏览器会警告）：**
```bash
sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /etc/ssl/private/exam-selfsigned.key \
    -out /etc/ssl/certs/exam-selfsigned.crt
```

### 2. 修改默认密码

首次访问后，立即修改管理员密码！

### 3. 限制访问IP（可选）

如果只允许特定IP访问：

```bash
# 只允许特定IP访问
sudo ufw delete allow 80/tcp
sudo ufw allow from 你的IP地址 to any port 80
```

或在Nginx中配置：
```nginx
location / {
    allow 你的IP地址;
    deny all;
    proxy_pass http://localhost:80;
}
```

### 4. 设置自动备份

```bash
# 创建备份脚本
sudo mkdir -p /opt/exam-backup
sudo nano /opt/exam-backup/backup.sh
```

内容：
```bash
#!/bin/bash
BACKUP_DIR="/opt/exam-backup/backups"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR

cd /home/ubuntu/test-system
docker-compose exec -T exam-system sqlite3 /var/www/html/data/exam_system.db .dump | gzip > $BACKUP_DIR/db_$DATE.sql.gz

# 保留最近7天
find $BACKUP_DIR -name "db_*.sql.gz" -mtime +7 -delete
```

```bash
# 设置权限
sudo chmod +x /opt/exam-backup/backup.sh

# 添加到crontab（每天凌晨2点备份）
sudo crontab -e
# 添加：0 2 * * * /opt/exam-backup/backup.sh
```

### 5. 监控和日志

```bash
# 查看实时访问日志
docker-compose logs -f exam-system

# 查看Apache访问日志
docker-compose exec exam-system tail -f /var/log/apache2/access.log

# 查看错误日志
docker-compose exec exam-system tail -f /var/log/apache2/error.log
```

## 📊 性能优化

### 如果访问量大，考虑：

1. **启用CDN**（如Cloudflare）
2. **增加资源限制**（修改docker-compose.yml）
3. **迁移到MySQL**（详见DOCKER_GUIDE.md）
4. **使用Redis缓存Session**

## 🎯 快速访问测试

```bash
# 在你的电脑上执行
curl -I http://43.164.129.251

# 或在浏览器直接访问
http://43.164.129.251
```

## 📞 需要帮助？

如果遇到问题，提供以下信息：

```bash
# 容器状态
docker-compose ps

# 端口监听
sudo netstat -tulpn | grep :80

# 防火墙状态
sudo ufw status

# 容器日志
docker-compose logs --tail=50 exam-system

# 测试本地访问
curl -v http://localhost
```

---

**下一步：**
1. 配置防火墙和安全组
2. 启动容器
3. 测试访问 http://43.164.129.251
4. 配置HTTPS（强烈推荐）
5. 设置自动备份
