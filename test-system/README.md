# 在线考试系统 - Docker容器化方案

## 📋 项目概述

本项目是一个基于纯PHP + SQLite的在线考试系统，已完成Docker容器化，支持一键部署。

## 🚀 快速开始

### 前置要求

- Docker 20.10+
- Docker Compose 2.0+
- 2GB+ 可用内存
- 10GB+ 可用磁盘空间

### 一键启动

```bash
# 1. 克隆项目（或进入项目目录）
cd exam_system

# 2. 构建并启动
docker-compose up -d

# 3. 访问系统
# 浏览器打开：http://localhost:8080
```

就这么简单！系统已经运行起来了。

## 📁 项目结构

```
exam_system/
├── docker/                    # Docker配置文件
│   ├── apache.conf           # Apache虚拟主机配置
│   ├── php.ini               # PHP自定义配置
│   └── entrypoint.sh         # 容器启动脚本
├── includes/                  # PHP核心文件
│   ├── config.php            # 数据库配置
│   ├── auth.php              # 认证逻辑
│   └── functions.php         # 工具函数
├── admin/                     # 管理员功能
├── student/                   # 学生功能
├── assets/                    # 静态资源
├── data/                      # SQLite数据库目录（volume挂载）
├── uploads/                   # 上传文件目录（volume挂载）
├── sessions/                  # Session文件目录（volume挂载）
├── Dockerfile                 # Docker镜像构建文件
├── docker-compose.yml         # Docker Compose配置
├── .dockerignore             # Docker构建忽略文件
├── .env.example              # 环境变量示例
├── DOCKER_GUIDE.md           # Docker详细使用指南
└── PRODUCTION_NOTES.md       # 生产环境注意事项
```

## 🔧 配置说明

### 环境变量

复制环境变量示例文件：

```bash
cp .env.example .env
```

主要配置项：

```bash
# 应用环境
APP_ENV=production

# PHP配置
PHP_TIMEZONE=Asia/Shanghai
PHP_MEMORY_LIMIT=256M
PHP_UPLOAD_MAX_FILESIZE=10M

# 数据库路径
DB_PATH=/var/www/html/data/exam_system.db

# 端口配置
HOST_PORT=8080
```

### 端口修改

编辑 `docker-compose.yml`：

```yaml
ports:
  - "8080:80"  # 改为你想要的端口
```

## 📚 详细文档

- **[DOCKER_GUIDE.md](DOCKER_GUIDE.md)** - 完整的Docker使用指南
  - 构建和运行命令
  - 数据库操作
  - 日志查看
  - 故障排查
  - 迁移到MySQL/PostgreSQL

- **[PRODUCTION_NOTES.md](PRODUCTION_NOTES.md)** - 生产环境部署指南
  - SQLite并发优化
  - 自动备份策略
  - HTTPS配置
  - 监控和日志
  - 安全加固
  - 性能优化

## 🛠️ 常用命令

```bash
# 启动服务
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down

# 重启服务
docker-compose restart

# 进入容器
docker-compose exec exam-system bash

# 查看数据库
docker-compose exec exam-system sqlite3 /var/www/html/data/exam_system.db

# 备份数据库
docker-compose exec exam-system sqlite3 /var/www/html/data/exam_system.db .dump > backup.sql
```

## 🔒 安全建议

1. **修改默认密码**：首次部署后立即修改管理员密码
2. **启用HTTPS**：生产环境必须配置SSL证书
3. **定期备份**：设置自动备份任务（见PRODUCTION_NOTES.md）
4. **限制访问**：使用防火墙限制访问IP
5. **更新镜像**：定期更新PHP和系统包

## 📊 性能说明

### SQLite适用场景

- ✅ 小型应用（<50并发用户）
- ✅ 中小型考试（<1000学生）
- ✅ 单机部署
- ❌ 高并发场景（>100并发）
- ❌ 大规模应用（>5000用户）

### 迁移到MySQL

如果需要更高性能，可以迁移到MySQL/PostgreSQL，详见 [DOCKER_GUIDE.md](DOCKER_GUIDE.md) 的迁移章节。

## 🐛 故障排查

### 容器无法启动

```bash
# 查看日志
docker-compose logs exam-system

# 检查端口占用
sudo netstat -tulpn | grep 8080
```

### 数据库权限错误

```bash
# 修复权限
docker-compose exec -u root exam-system bash
chown -R www-data:www-data /var/www/html/data/
chmod 644 /var/www/html/data/exam_system.db
```

### 文件上传失败

```bash
# 检查上传目录权限
docker-compose exec exam-system ls -la /var/www/html/uploads/

# 修复权限
docker-compose exec -u root exam-system chown -R www-data:www-data /var/www/html/uploads/
```

更多问题请查看 [DOCKER_GUIDE.md](DOCKER_GUIDE.md) 的故障排查章节。

## 📦 数据持久化

Docker Compose会自动创建以下数据卷：

- `exam_data` - SQLite数据库文件
- `exam_uploads` - 上传的CSV文件
- `exam_sessions` - PHP session文件

即使删除容器，数据也会保留。要完全清除数据：

```bash
docker-compose down -v  # ⚠️ 危险操作！会删除所有数据
```

## 🔄 更新部署

```bash
# 拉取最新代码
git pull

# 重新构建镜像
docker-compose build

# 重启容器
docker-compose up -d
```

## 📞 技术支持

如遇到问题，请提供以下信息：

```bash
# 系统信息
docker --version
docker-compose --version

# 容器状态
docker-compose ps
docker-compose logs --tail=100 exam-system

# 资源使用
docker stats exam-system --no-stream
```

## 📄 许可证

[根据你的项目添加许可证信息]

## 🙏 致谢

感谢所有贡献者和使用者！

---

**快速链接：**
- [Docker使用指南](DOCKER_GUIDE.md)
- [生产环境部署](PRODUCTION_NOTES.md)
- [环境变量配置](.env.example)
