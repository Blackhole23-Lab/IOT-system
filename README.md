# IOT-System — 智慧课堂统一平台

一个基于 **pnpm monorepo** 的全栈实时课堂系统，统一管理演示系统（teach-system）与考试系统（test-system），单端口 3000 运行。

---

## 目录结构

```
IOT-system/
├── package.json              # 根 workspace（concurrently dev）
├── pnpm-workspace.yaml       # pnpm workspaces 配置
├── .env.example              # 环境变量示例
│
├── server/                   # Node.js + Express + Socket.io 后端
│   ├── index.js              # 主入口，Express + 路由挂载
│   ├── socket.js             # Socket.io namespace（/teach, /test）
│   └── routes/
│       ├── auth.js           # POST /api/auth/login, GET /api/auth/me
│       ├── teach.js          # /api/teach/library, /api/teach/upload
│       └── test.js           # /api/test/rooms, /api/test/exams
│
├── client/                   # React 18 + Vite + TypeScript + Tailwind
│   ├── src/
│   │   ├── App.tsx           # 路由：/login, /dashboard, /teach/*, /test/*
│   │   ├── lib/
│   │   │   ├── auth.tsx      # AuthContext + useAuth hook
│   │   │   └── socket.ts     # Socket.io 客户端工厂函数
│   │   ├── pages/
│   │   │   ├── LoginPage.tsx    # 统一登录页（教师/学生）
│   │   │   ├── Dashboard.tsx    # 登录后仪表盘（选择系统）
│   │   │   ├── TeachTeacher.tsx # 教师演示控制台
│   │   │   ├── TeachStudent.tsx # 学生只读跟随视图
│   │   │   ├── TestTeacher.tsx  # 考试监控控制台
│   │   │   └── TestStudent.tsx  # 学生答题界面
│   │   └── components/
│   │       └── RoomQR.tsx    # 房间二维码组件（qrcode.react）
│   └── ...配置文件
│
├── teach-system/             # 原有独立演示系统（保留参考）
└── test-system/              # 原有独立考试系统（保留参考）
```

---

## 快速开始

### 方式一：一键部署（推荐生产环境）

```bash
cd IOT-system
bash deploy.sh
# 可选参数：
# bash deploy.sh --port 8080 --domain yourdomain.com
```

脚本会自动：
- ✅ 安装 pnpm、pm2
- ✅ 安装依赖、构建前端
- ✅ 生成随机 JWT_SECRET
- ✅ 使用 pm2 启动服务（自动重启 + 开机自启）
- ✅ 配置防火墙（ufw）
- ✅ 输出公网访问地址

### 方式二：手动开发模式

```bash
cd IOT-system
cp .env.example .env
pnpm install
pnpm dev
```

这会并发启动：
- **后端**：`http://localhost:3000`（Express + Socket.io）
- **前端**：`http://localhost:5173`（Vite Dev Server，自动代理 /api 到 3000）

### 方式三：手动生产模式

```bash
pnpm build    # 构建 React 到 client/dist/
pnpm start    # 仅启动后端，serve React 静态文件
# 访问 http://localhost:3000
```

---

## 端口说明

| 模式 | 前端 | 后端 | 说明 |
|------|------|------|------|
| 开发 | :5173 | :3000 | Vite 代理 /api、Socket.io 到 3000 |
| 生产 | — | :3000 | Express serve React build，单端口 |

---

## 演示账号

| 账号 | 密码 | 角色 |
|------|------|------|
| teacher | teacher123 | 教师 |
| teacher2 | teacher123 | 教师 |
| student | student123 | 学生 |
| student2 | student123 | 学生 |
| admin | admin123 | 教师 |

---

## 核心功能

### 教师端
1. 登录 → 仪表盘 → 选择「演示系统」或「考试系统」
2. 点击按钮自动生成 **6位随机房间码** + **二维码**
3. 进入控制台：
   - **演示系统**：上传 PDF → Reveal.js 渲染 → 翻页/激光指针/画板 实时同步
   - **考试系统**：开始/结束考试 + 广播通知

### 学生端
1. 登录 → 仪表盘 → 输入房间码（选择类型）加入
2. **演示课堂**：只读跟随教师操作（翻页、激光指针、绘图实时同步）
3. **在线考试**：等待开始，作答，接收广播通知

---

## Socket.io 命名空间

| Namespace | 事件 | 说明 |
|-----------|------|------|
| `/teach` | `join-room`, `pdf-uploaded`, `slide-change`, `laser-move/hide`, `zoom-change`, `draw-event/clear` | 演示系统 |
| `/test` | `join-room`, `exam-start/end`, `announce` | 考试系统 |

---

## 技术栈

- **后端**: Node.js 20+, Express, Socket.io 4.x, Multer, jsonwebtoken
- **前端**: React 18, Vite, TypeScript, Tailwind CSS 3, React Router v6, lucide-react, qrcode.react
- **演示**: Reveal.js 5.x (CDN), pdf.js 4.x (CDN)
- **包管理**: pnpm workspaces (monorepo)
