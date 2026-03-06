#!/bin/bash
# ═══════════════════════════════════════════════════════════════
#  IOT-System 一键部署脚本
#  用法: bash deploy.sh [--port 3000] [--domain yourdomain.com]
# ═══════════════════════════════════════════════════════════════

set -e

# ── 颜色 ───────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

info()    { echo -e "${CYAN}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERR]${NC}   $*"; exit 1; }
step()    { echo -e "\n${BOLD}${BLUE}▶ $*${NC}"; }

# ── 默认参数 ───────────────────────────────────────────────────
PORT=3000
DOMAIN=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --port)    PORT="$2";   shift 2 ;;
    --domain)  DOMAIN="$2"; shift 2 ;;
    *)         shift ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo ""
echo -e "${BOLD}╔══════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║      IOT-System  一键部署工具            ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════╝${NC}"
echo ""

# ── 检测公网 IP ────────────────────────────────────────────────
step "检测网络环境"
PUBLIC_IP=$(curl -s --connect-timeout 5 ifconfig.me 2>/dev/null || \
            curl -s --connect-timeout 5 api.ipify.org 2>/dev/null || \
            hostname -I | awk '{print $1}')
info "公网 IP: ${PUBLIC_IP}"
info "监听端口: ${PORT}"
[[ -n "$DOMAIN" ]] && info "域名: ${DOMAIN}"

# ── 检查 Node.js ───────────────────────────────────────────────
step "检查运行环境"
command -v node >/dev/null 2>&1 || error "未找到 Node.js，请先安装 Node.js 20+"
NODE_VER=$(node -e "process.stdout.write(process.version)")
info "Node.js $NODE_VER"

# ── 安装 pnpm ─────────────────────────────────────────────────
if ! command -v pnpm >/dev/null 2>&1; then
  info "安装 pnpm..."
  npm install -g pnpm --silent
fi
PNPM_VER=$(pnpm --version)
info "pnpm $PNPM_VER"

# ── 安装 pm2 ──────────────────────────────────────────────────
if ! command -v pm2 >/dev/null 2>&1; then
  info "安装 pm2..."
  npm install -g pm2 --silent
fi
info "pm2 $(pm2 --version)"

# ── 安装依赖 ──────────────────────────────────────────────────
step "安装项目依赖"
pnpm install --no-frozen-lockfile 2>&1 | tail -5
success "依赖安装完成"

# ── 生成 .env ─────────────────────────────────────────────────
step "配置环境变量"
JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(48).toString('hex'))")

cat > .env <<EOF
PORT=${PORT}
JWT_SECRET=${JWT_SECRET}
NODE_ENV=production
CORS_ORIGIN=
EOF

success ".env 已生成（JWT_SECRET 已随机化）"

# ── 构建前端 ──────────────────────────────────────────────────
step "构建前端 (Vite)"
pnpm build 2>&1 | tail -10
success "前端构建完成 → client/dist/"

# ── 停止旧进程 ────────────────────────────────────────────────
step "停止旧进程"
pm2 delete iot-system 2>/dev/null && info "已停止旧 pm2 进程" || info "无旧进程"
# 也杀掉占用端口的进程
PIDS=$(lsof -t -i:${PORT} 2>/dev/null || true)
[[ -n "$PIDS" ]] && kill $PIDS 2>/dev/null && info "已释放端口 ${PORT}" || true

# ── 启动服务 ──────────────────────────────────────────────────
step "使用 pm2 启动服务"
pm2 start ecosystem.config.js --env production
pm2 save
success "服务已启动"

# ── 设置开机自启 ──────────────────────────────────────────────
step "配置开机自启"
PM2_STARTUP=$(pm2 startup 2>&1 | grep "sudo" | head -1 || true)
if [[ -n "$PM2_STARTUP" ]]; then
  eval "$PM2_STARTUP" 2>/dev/null && success "开机自启已配置" || warn "请手动运行: $PM2_STARTUP"
else
  success "开机自启已就绪"
fi

# ── 防火墙提示 ────────────────────────────────────────────────
step "防火墙/安全组配置"
# 尝试 ufw
if command -v ufw >/dev/null 2>&1; then
  ufw allow ${PORT}/tcp 2>/dev/null && success "ufw: 端口 ${PORT} 已开放" || warn "ufw 规则添加失败，请手动开放"
else
  warn "请在云服务器安全组中开放 TCP 端口 ${PORT}"
fi

# ── 输出访问信息 ──────────────────────────────────────────────
echo ""
echo -e "${BOLD}${GREEN}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${GREEN}║             🎉 部署完成！                        ║${NC}"
echo -e "${BOLD}${GREEN}╚══════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${BOLD}本机访问:${NC}   http://localhost:${PORT}"
echo -e "  ${BOLD}公网访问:${NC}   http://${PUBLIC_IP}:${PORT}"
[[ -n "$DOMAIN" ]] && echo -e "  ${BOLD}域名访问:${NC}   http://${DOMAIN}"
echo ""
echo -e "  ${BOLD}演示账号:${NC}"
echo -e "    教师: teacher / teacher123"
echo -e "    学生: student / student123"
echo ""
echo -e "  ${BOLD}管理命令:${NC}"
echo -e "    pm2 status          # 查看进程状态"
echo -e "    pm2 logs iot-system # 查看日志"
echo -e "    pm2 restart iot-system # 重启"
echo -e "    pm2 stop iot-system    # 停止"
echo ""
