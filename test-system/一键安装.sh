#!/bin/bash

################################################################################
# 在线考试系统 - 一键安装脚本
# 功能：自动检测并安装Docker，部署考试系统
# 兼容：Docker 17.x - 最新版本
# 作者：项目开发团队
# 日期：2026-03-05
################################################################################

set -e  # 遇到错误立即退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 打印横幅
print_banner() {
    echo -e "${GREEN}"
    echo "╔════════════════════════════════════════════════════════════╗"
    echo "║                                                            ║"
    echo "║          在线考试系统 - 一键安装脚本                       ║"
    echo "║          Online Exam System - Auto Installer               ║"
    echo "║                                                            ║"
    echo "║          版本: v1.0.0                                      ║"
    echo "║          日期: 2026-03-05                                  ║"
    echo "║                                                            ║"
    echo "╚════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

# 检查是否为root用户
check_root() {
    if [ "$EUID" -ne 0 ]; then
        log_warning "建议使用root权限运行此脚本"
        log_info "尝试使用sudo重新运行..."
        exec sudo bash "$0" "$@"
        exit $?
    fi
}

# 检测操作系统
detect_os() {
    log_info "检测操作系统..."

    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS=$ID
        OS_VERSION=$VERSION_ID
        log_success "检测到操作系统: $PRETTY_NAME"
    else
        log_error "无法检测操作系统类型"
        exit 1
    fi
}

# 检查Docker是否已安装
check_docker() {
    log_info "检查Docker安装状态..."

    if command -v docker &> /dev/null; then
        DOCKER_VERSION=$(docker --version | grep -oP '\d+\.\d+\.\d+' | head -1)
        log_success "检测到Docker已安装: v${DOCKER_VERSION}"

        # 检查Docker版本
        DOCKER_MAJOR=$(echo $DOCKER_VERSION | cut -d. -f1)
        DOCKER_MINOR=$(echo $DOCKER_VERSION | cut -d. -f2)

        if [ "$DOCKER_MAJOR" -lt 17 ]; then
            log_warning "Docker版本过低 (v${DOCKER_VERSION})，建议升级到17.x或更高版本"
            read -p "是否继续使用当前版本? (y/n): " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                log_info "正在升级Docker..."
                install_docker
            fi
        else
            log_success "Docker版本符合要求 (v${DOCKER_VERSION})"
        fi

        # 检查Docker服务状态
        if systemctl is-active --quiet docker; then
            log_success "Docker服务运行正常"
        else
            log_warning "Docker服务未运行，正在启动..."
            systemctl start docker
            systemctl enable docker
            log_success "Docker服务已启动"
        fi

        return 0
    else
        log_warning "未检测到Docker，需要安装"
        return 1
    fi
}

# 检查Docker Compose是否已安装
check_docker_compose() {
    log_info "检查Docker Compose安装状态..."

    # 检查docker compose (新版本，作为Docker插件)
    if docker compose version &> /dev/null; then
        COMPOSE_VERSION=$(docker compose version | grep -oP '\d+\.\d+\.\d+' | head -1)
        log_success "检测到Docker Compose (插件版本): v${COMPOSE_VERSION}"
        USE_COMPOSE_V2=true
        return 0
    fi

    # 检查docker-compose (旧版本，独立命令)
    if command -v docker-compose &> /dev/null; then
        COMPOSE_VERSION=$(docker-compose --version | grep -oP '\d+\.\d+\.\d+' | head -1)
        log_success "检测到Docker Compose (独立版本): v${COMPOSE_VERSION}"
        USE_COMPOSE_V2=false
        return 0
    fi

    log_warning "未检测到Docker Compose，需要安装"
    return 1
}

# 安装Docker
install_docker() {
    log_info "开始安装Docker..."

    case $OS in
        ubuntu|debian)
            log_info "使用APT包管理器安装Docker..."

            # 卸载旧版本
            apt-get remove -y docker docker-engine docker.io containerd runc 2>/dev/null || true

            # 更新包索引
            apt-get update

            # 安装依赖
            apt-get install -y \
                ca-certificates \
                curl \
                gnupg \
                lsb-release

            # 添加Docker官方GPG密钥
            mkdir -p /etc/apt/keyrings
            curl -fsSL https://download.docker.com/linux/$OS/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg

            # 设置Docker仓库
            echo \
                "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/$OS \
                $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

            # 安装Docker Engine
            apt-get update
            apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
            ;;

        centos|rhel|fedora)
            log_info "使用YUM/DNF包管理器安装Docker..."

            # 卸载旧版本
            yum remove -y docker docker-client docker-client-latest docker-common docker-latest docker-latest-logrotate docker-logrotate docker-engine 2>/dev/null || true

            # 安装依赖
            yum install -y yum-utils

            # 添加Docker仓库
            yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo

            # 安装Docker Engine
            yum install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
            ;;

        *)
            log_error "不支持的操作系统: $OS"
            log_info "请手动安装Docker: https://docs.docker.com/engine/install/"
            exit 1
            ;;
    esac

    # 启动Docker服务
    systemctl start docker
    systemctl enable docker

    # 验证安装
    if docker --version &> /dev/null; then
        DOCKER_VERSION=$(docker --version | grep -oP '\d+\.\d+\.\d+' | head -1)
        log_success "Docker安装成功: v${DOCKER_VERSION}"
    else
        log_error "Docker安装失败"
        exit 1
    fi
}

# 安装Docker Compose (独立版本，用于旧版Docker)
install_docker_compose_standalone() {
    log_info "安装Docker Compose独立版本..."

    # 获取最新版本号
    COMPOSE_VERSION=$(curl -s https://api.github.com/repos/docker/compose/releases/latest | grep -oP '"tag_name": "\K(.*)(?=")')

    if [ -z "$COMPOSE_VERSION" ]; then
        log_warning "无法获取最新版本，使用默认版本 v2.24.0"
        COMPOSE_VERSION="v2.24.0"
    fi

    log_info "下载Docker Compose ${COMPOSE_VERSION}..."

    # 下载二进制文件
    curl -L "https://github.com/docker/compose/releases/download/${COMPOSE_VERSION}/docker-compose-$(uname -s)-$(uname -m)" \
        -o /usr/local/bin/docker-compose

    # 添加执行权限
    chmod +x /usr/local/bin/docker-compose

    # 创建软链接
    ln -sf /usr/local/bin/docker-compose /usr/bin/docker-compose

    # 验证安装
    if docker-compose --version &> /dev/null; then
        log_success "Docker Compose安装成功: $(docker-compose --version)"
        USE_COMPOSE_V2=false
    else
        log_error "Docker Compose安装失败"
        exit 1
    fi
}

# 配置Docker（可选优化）
configure_docker() {
    log_info "配置Docker..."

    # 创建Docker配置目录
    mkdir -p /etc/docker

    # 配置Docker镜像加速（中国大陆用户）
    if [ ! -f /etc/docker/daemon.json ]; then
        log_info "配置Docker镜像加速..."
        cat > /etc/docker/daemon.json <<EOF
{
  "registry-mirrors": [
    "https://docker.mirrors.ustc.edu.cn",
    "https://hub-mirror.c.163.com"
  ],
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  },
  "storage-driver": "overlay2"
}
EOF
        systemctl daemon-reload
        systemctl restart docker
        log_success "Docker配置完成"
    else
        log_info "Docker配置文件已存在，跳过"
    fi
}

# 添加当前用户到docker组
add_user_to_docker_group() {
    if [ -n "$SUDO_USER" ]; then
        log_info "添加用户 $SUDO_USER 到docker组..."
        usermod -aG docker $SUDO_USER
        log_success "用户已添加到docker组（需要重新登录生效）"
    fi
}

# 检查项目文件
check_project_files() {
    log_info "检查项目文件..."

    REQUIRED_FILES=(
        "Dockerfile"
        "docker-compose.yml"
        "exam_system/index.php"
        "exam_system/includes/config.php"
    )

    for file in "${REQUIRED_FILES[@]}"; do
        if [ ! -f "$file" ]; then
            log_error "缺少必要文件: $file"
            log_error "请确保在项目根目录运行此脚本"
            exit 1
        fi
    done

    log_success "项目文件检查通过"
}

# 创建环境变量文件
create_env_file() {
    if [ ! -f .env ]; then
        log_info "创建环境变量文件..."

        if [ -f .env.example ]; then
            cp .env.example .env
            log_success "已从.env.example创建.env文件"
        else
            cat > .env <<EOF
# 应用环境
APP_ENV=production

# PHP配置
PHP_TIMEZONE=Asia/Shanghai
PHP_MEMORY_LIMIT=256M
PHP_UPLOAD_MAX_FILESIZE=10M
PHP_POST_MAX_SIZE=10M

# 数据库路径
DB_PATH=/var/www/html/data/exam_system.db

# Session配置
SESSION_SAVE_PATH=/var/www/html/sessions

# 端口配置
HOST_PORT=80
EOF
            log_success "已创建默认.env文件"
        fi
    else
        log_info ".env文件已存在，跳过创建"
    fi
}

# 停止旧容器
stop_old_containers() {
    log_info "检查并停止旧容器..."

    if docker ps -a | grep -q exam-system; then
        log_warning "发现旧容器，正在停止..."

        if [ "$USE_COMPOSE_V2" = true ]; then
            docker compose down 2>/dev/null || true
        else
            docker-compose down 2>/dev/null || true
        fi

        log_success "旧容器已停止"
    else
        log_info "未发现旧容器"
    fi
}

# 构建并启动容器
build_and_start() {
    log_info "构建Docker镜像..."

    if [ "$USE_COMPOSE_V2" = true ]; then
        docker compose build
    else
        docker-compose build
    fi

    log_success "镜像构建完成"

    log_info "启动容器..."

    if [ "$USE_COMPOSE_V2" = true ]; then
        docker compose up -d
    else
        docker-compose up -d
    fi

    log_success "容器启动成功"
}

# 等待服务就绪
wait_for_service() {
    log_info "等待服务启动..."

    MAX_ATTEMPTS=30
    ATTEMPT=0

    while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
        if curl -f http://localhost:80 &> /dev/null; then
            log_success "服务已就绪"
            return 0
        fi

        ATTEMPT=$((ATTEMPT + 1))
        echo -n "."
        sleep 2
    done

    echo
    log_warning "服务启动超时，请检查日志"
    return 1
}

# 显示访问信息
show_access_info() {
    echo
    echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                                                            ║${NC}"
    echo -e "${GREEN}║                  🎉 安装成功！                             ║${NC}"
    echo -e "${GREEN}║                                                            ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
    echo

    # 获取服务器IP
    SERVER_IP=$(hostname -I | awk '{print $1}')

    log_info "访问信息："
    echo -e "  ${BLUE}本地访问${NC}: http://localhost"
    echo -e "  ${BLUE}局域网访问${NC}: http://${SERVER_IP}"

    # 检查是否有公网IP
    PUBLIC_IP=$(curl -s ifconfig.me 2>/dev/null || curl -s icanhazip.com 2>/dev/null || echo "")
    if [ -n "$PUBLIC_IP" ] && [ "$PUBLIC_IP" != "$SERVER_IP" ]; then
        echo -e "  ${BLUE}公网访问${NC}: http://${PUBLIC_IP}"
        log_warning "公网访问需要配置防火墙和安全组"
    fi

    echo
    log_info "默认账号："
    echo -e "  ${YELLOW}管理员用户名${NC}: admin"
    echo -e "  ${YELLOW}管理员密码${NC}: admin123"
    echo -e "  ${RED}⚠️  首次登录后请立即修改密码！${NC}"

    echo
    log_info "常用命令："
    echo -e "  查看日志: ${BLUE}docker-compose logs -f${NC}"
    echo -e "  停止服务: ${BLUE}docker-compose down${NC}"
    echo -e "  重启服务: ${BLUE}docker-compose restart${NC}"
    echo -e "  进入容器: ${BLUE}docker-compose exec exam-system bash${NC}"

    echo
    log_info "文档位置："
    echo -e "  项目说明: ${BLUE}./项目说明文档.md${NC}"
    echo -e "  Docker指南: ${BLUE}./DOCKER_GUIDE.md${NC}"
    echo -e "  生产部署: ${BLUE}./PRODUCTION_NOTES.md${NC}"

    echo
}

# 显示故障排查信息
show_troubleshooting() {
    log_error "安装过程中出现错误"
    echo
    log_info "故障排查步骤："
    echo "  1. 查看Docker日志: docker-compose logs"
    echo "  2. 检查容器状态: docker-compose ps"
    echo "  3. 检查端口占用: sudo netstat -tulpn | grep 80"
    echo "  4. 检查防火墙: sudo ufw status"
    echo "  5. 重新运行脚本: sudo bash $0"
    echo
    log_info "如需帮助，请查看文档或提交Issue"
}

# 主函数
main() {
    print_banner

    # 检查root权限
    check_root

    # 检测操作系统
    detect_os

    # 检查并安装Docker
    if ! check_docker; then
        install_docker
        configure_docker
    fi

    # 检查并安装Docker Compose
    if ! check_docker_compose; then
        # 尝试安装插件版本（新版Docker自带）
        if docker compose version &> /dev/null; then
            USE_COMPOSE_V2=true
            log_success "Docker Compose插件已可用"
        else
            # 安装独立版本
            install_docker_compose_standalone
        fi
    fi

    # 添加用户到docker组
    add_user_to_docker_group

    # 检查项目文件
    check_project_files

    # 创建环境变量文件
    create_env_file

    # 停止旧容器
    stop_old_containers

    # 构建并启动
    if build_and_start; then
        # 等待服务就绪
        if wait_for_service; then
            show_access_info
        else
            show_troubleshooting
            exit 1
        fi
    else
        show_troubleshooting
        exit 1
    fi
}

# 捕获错误
trap 'log_error "脚本执行失败"; show_troubleshooting; exit 1' ERR

# 运行主函数
main "$@"
