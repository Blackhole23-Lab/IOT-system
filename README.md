# IOT-System — 智慧课堂统一平台

基于 **pnpm monorepo** 的全栈实时课堂系统，统一管理演示系统与考试系统，单端口 3000 运行。

---

## 目录结构

```
IOT-system/
├── package.json              # 根 workspace（concurrently dev）
├── pnpm-workspace.yaml
│
├── server/                   # Node.js + Express + Socket.io 后端
│   ├── index.js              # 主入口
│   ├── socket.js             # Socket.io namespace（/teach, /test）
│   ├── prisma/
│   │   ├── schema.prisma     # 数据库模型
│   │   ├── client.js         # Prisma Client 单例
│   │   ├── seed.js           # 初始化演示数据
│   │   └── dev.db            # SQLite 数据库文件
│   ├── middleware/
│   │   └── auth.js           # RBAC 权限中间件
│   └── routes/
│       ├── auth.js           # 认证 API
│       ├── teach.js          # 演示课堂 API + PDF 上传
│       ├── test.js           # 考试 API
│       └── classrooms.js     # 班级管理 API
│
├── client/                   # React 18 + Vite + TypeScript + Tailwind
│   └── src/
│       ├── App.tsx           # 路由配置 + 权限守卫
│       ├── lib/
│       │   ├── auth.tsx      # AuthContext + useAuth + hasPermission
│       │   └── socket.ts     # Socket.io 工厂函数
│       ├── pages/
│       │   ├── LoginPage.tsx
│       │   ├── TeacherDashboard.tsx  # 班级管理 + 学生名册
│       │   ├── StudentDashboard.tsx
│       │   ├── AdminDashboard.tsx    # 用户管理 + 班级管理
│       │   ├── TeachTeacher.tsx      # 教师演示控制台
│       │   ├── TeachStudent.tsx      # 学生只读跟随
│       │   ├── TestTeacher.tsx       # 考试监控控制台
│       │   └── TestStudent.tsx       # 学生答题界面
│       └── components/
│           └── RoomQR.tsx
```

---

## 快速开始

### 开发模式

```bash
cd IOT-system
pnpm install
# 初始化数据库（首次）
cd server && npx prisma migrate dev && node prisma/seed.js && cd ..
pnpm dev
```

- **后端**：`http://localhost:3000`
- **前端**：`http://localhost:5173`（Vite 自动代理 /api 到 3000）

### 生产模式

```bash
pnpm build    # 构建 React 到 client/dist/
pnpm start    # 启动后端，同时 serve React 静态文件
# 访问 http://localhost:3000
```

### 数据库初始化（首次部署）

```bash
cd server
npx prisma migrate dev --name init   # 创建数据库表
node prisma/seed.js                  # 写入演示账号和题目
```

---

## 环境变量（server/.env）

```env
DATABASE_URL="file:./prisma/dev.db"
JWT_SECRET="your_secret_here"
NODE_ENV="production"
PORT=3000
```

---

## 管理员账号

| 账号 | 密码 | 角色 | 权限 |
|------|------|------|------|
| admin | admin123 | 管理员 | 全局管理所有资源 |

> 其他教师/学生账号由管理员在后台创建，不再内置演示账号。

---

## RBAC 权限控制

### 角色与权限

| 角色 | 权限列表 |
|------|---------|
| admin | `["*"]` 全局管理 |
| teacher | `["teach:create","exam:grade","student:view_all"]` |
| student | `["exam:submit","attend:view_own"]` |

### 路由守卫

| 中间件 | 适用场景 |
|--------|---------|
| `requireAuth` | 所有需要登录的接口 |
| `teacherOnly` | 教师/管理员专属接口 |
| `adminOnly` | 仅管理员接口 |
| `requirePermission(perm)` | 细粒度权限检查 |

---

## 班级管理

- **教师**：创建/删除自己的班级，添加/移出学生，只能看自己班级的学生
- **管理员**：可查看所有班级，创建班级时可指定分配给任意教师
- **学生**：可查看自己所属的班级列表

### 班级 API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/classrooms` | 获取班级列表 |
| POST | `/api/classrooms` | 创建班级 `{name, teacherId?}` |
| PUT | `/api/classrooms/:id` | 重命名班级 |
| DELETE | `/api/classrooms/:id` | 删除班级 |
| POST | `/api/classrooms/:id/students` | 添加学生 `{studentIds:[]}` |
| DELETE | `/api/classrooms/:id/students/:studentId` | 移出学生 |
| GET | `/api/classrooms/:id/students/available` | 可添加的学生列表 |
| GET | `/api/classrooms/student/:studentId/mine` | 学生自己的班级 |

---

## API 概览

### 认证

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/login` | 登录，返回 JWT |
| POST | `/api/auth/register` | 注册（默认 student） |
| GET | `/api/auth/me` | 验证 token，返回用户信息 |
| GET | `/api/auth/students` | 学生列表（教师） |
| GET | `/api/auth/admin/users` | 所有用户（管理员） |
| POST | `/api/auth/admin/users` | 创建用户（管理员） |
| PUT | `/api/auth/admin/users/:username` | 修改用户（管理员） |
| DELETE | `/api/auth/admin/users/:username` | 删除用户（管理员） |

### 演示课堂

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/teach/library` | 获取教案库列表 |
| POST | `/api/teach/library/upload` | 上传 PDF 到教案库（快速上传/永久存储） |
| DELETE | `/api/teach/library/:filename` | 删除教案 |
| POST | `/api/teach/attend` | 学生签到 |
| GET | `/api/teach/attend/:userId` | 查询签到记录 |
| GET | `/api/teach/rooms/generate` | 生成房间码 |

### 考试系统

| 方法 | 路径 | 说明 |
|------|------|------|
| GET/POST | `/api/test/questions` | 题库管理 |
| POST | `/api/test/questions/import` | 批量导入题目 |
| GET/POST | `/api/test/exams` | 考试管理 |
| POST | `/api/test/submit` | 提交答卷 |
| GET | `/api/test/submissions` | 所有答卷（教师） |
| GET | `/api/test/submissions/:userId` | 学生答卷历史 |
| POST | `/api/test/submissions/grade/:userId/:examId` | 批改主观题 |

---

## Socket.io 事件

| Namespace | 事件 | 说明 |
|-----------|------|------|
| `/teach` | `join-room`, `pdf-uploaded`, `slide-change` | 演示控制 |
| `/teach` | `laser-move/hide`, `zoom-change` | 实时交互 |
| `/teach` | `draw-event`, `draw-stroke-start`, `draw-rect`, `draw-undo`, `draw-clear` | 双向画板（教师/学生均可画笔、框选、撤销） |
| `/test` | `join-room`, `exam-start/end`, `announce` | 考试控制 |

---

## 数据库模型（Prisma 5 + SQLite）

| 模型 | 说明 |
|------|------|
| User | 用户（id/username/password/role/permissions） |
| Classroom | 班级（name/teacherId） |
| ClassroomStudent | 班级学生关联（多对多） |
| Exam | 考试（title/duration/questionIds/createdBy） |
| Question | 题目（type/questionText/options/answer/score） |
| Submission | 答卷（userId/examId/answers/score/status） |
| Attendance | 签到（userId/roomCode/date） |
| Room | 房间（code/type/teacherId/state） |

---

## 技术栈

- **后端**: Node.js 20, Express 4, Socket.io 4, Multer, jsonwebtoken, Prisma 5
- **数据库**: SQLite（via Prisma，零配置单文件）
- **前端**: React 18, Vite 6, TypeScript 5, Tailwind CSS 3, React Router v6
- **UI**: lucide-react, qrcode.react
- **演示引擎**: Reveal.js 5.x (CDN), pdf.js 4.x (CDN)
- **包管理**: pnpm workspaces (monorepo)
