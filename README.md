# 数学学习系统 (Math Learning System)

高中数学智能学习辅助系统，支持知识点管理、试卷导入、AI分析、自动出卷、在线测验、掌握度评估、错题本、个性化推荐、知识地图可视化、模拟考试和学习激励。

## 功能概览（20个模块）

| 模块 | 功能 | 说明 |
|------|------|------|
| 大模型集成 | Ollama/智谱/Qwen/OpenAI | 支持热切换、重试、缓存、监控 |
| Prompt模板管理 | 7种任务模板 | 知识点识别/解析/答案/难度/批改 |
| 学生管理 | 账号/班级/权限 | JWT认证、批量导入、角色控制 |
| 知识点管理 | 树形结构 | 父子关系、前置依赖、CRUD |
| 试卷导入 | PDF/图片/OCR | tesseract.js中英文识别 |
| 题库管理 | 筛选/批量/质量校验 | 多维度筛选、批量操作 |
| AI试题分析 | 知识点/解析/答案 | LLM驱动、人工审核 |
| 难度分类 | 四级难度 | AI评估+手动调整+历史记录 |
| 自动出卷 | 智能组卷 | 贪心+CSP选题、PDF/Word导出 |
| 在线测验 | 选择题在线/拍照上传 | 实时保存、计时、中断恢复 |
| AI批改 | 全题型自动批改 | 选择题判分/填空等价识别/解答步骤评分 |
| 掌握度评估 | 加权正确率算法 | 薄弱点识别、学习报告、班级统计 |
| 错题本 | 自动归集/重练/变式 | 多维度分类、复习状态管理 |
| 个性化推荐 | 智能推荐算法 | 每日推荐/专项突破/学习路径规划 |
| 知识地图可视化 | D3.js树形/地图/雷达 | 掌握度颜色映射、PNG导出 |
| 模拟考试 | 限时考试场景 | 倒计时/答题卡/对标分析 |
| 学习激励 | 徽章/打卡/排行榜 | 14种徽章、挑战活动、通知系统 |
| 前端集成优化 | 响应式/懒加载/错误处理 | 代码分割、移动端适配 |
| 测试与部署 | 单元/集成/E2E测试 | 114个单元测试、Playwright E2E |
| 原生部署 | PM2 + Nginx | 安装脚本、生产配置 |

## 技术栈

- **前端**: React 18 + TypeScript + Vite + react-router-dom + D3.js
- **后端**: Node.js 22 + Express 5 + Prisma 5.22
- **数据库**: PostgreSQL 16（开发环境可用SQLite）
- **AI**: 大模型集成（Ollama本地/智谱AI/阿里云Qwen/OpenAI）
- **进程管理**: PM2
- **反向代理**: Nginx
- **测试**: Jest（114个单元测试）、Playwright（E2E测试）

## 快速开始

### 前置要求

- Node.js 22+
- PostgreSQL 16+
- Git

### 环境准备

详细的部署说明请参考 [原生部署指南](docs/deployment-native.md)。

#### Windows

```powershell
# 运行安装脚本检测环境
.\scripts\install.ps1

# 初始化数据库
.\scripts\setup-db.ps1
```

#### Linux/macOS

```bash
# 运行安装脚本检测环境
chmod +x scripts/install.sh
./scripts/install.sh

# 初始化数据库
chmod +x scripts/setup-db.sh
./scripts/setup-db.sh
```

### 1. 配置环境变量

复制环境变量示例文件：

```bash
cp .env.example .env
```

编辑 `.env` 文件，配置数据库连接和其他参数：

```env
DATABASE_URL=postgresql://postgres:your_password@localhost:5432/math_learning
JWT_SECRET=your_secure_jwt_secret_here
PORT=3000
```

### 2. 安装依赖并初始化数据库

```bash
# 后端
cd backend
npm install
npx prisma generate
npx prisma db push

# 前端
cd ../frontend
npm install
```

### 3. 启动服务

#### 开发模式

```bash
# 后端
cd backend
npm run dev

# 前端（新终端）
cd frontend
npm run dev
```

#### 生产模式

```bash
# 使用 PM2 启动所有服务
npm install -g pm2
pm2 start ecosystem.config.js
```

### 4. 访问应用

- **前端**: http://localhost:5173 (开发) 或 http://localhost:3000 (生产)
- **后端API**: http://localhost:3000
- **健康检查**: http://localhost:3000/health
- **Prisma Studio**: `cd backend && npx prisma studio`

## 项目结构

```
senior_middle_school/
├── frontend/              # React前端应用
│   ├── src/              # 源代码
│   ├── public/           # 静态资源
│   └── package.json
├── backend/               # Node.js后端应用
│   ├── src/              # 源代码
│   │   ├── routes/       # API路由
│   │   ├── services/     # 服务层
│   │   └── adapters/     # LLM适配器
│   ├── prisma/           # Prisma schema
│   └── package.json
├── scripts/               # 安装和部署脚本
│   ├── install.sh        # Linux/macOS环境检测
│   ├── install.ps1       # Windows环境检测
│   ├── setup-db.sh       # Linux/macOS数据库初始化
│   └── setup-db.ps1      # Windows数据库初始化
├── docs/                  # 文档
│   ├── deployment-native.md  # 详细部署指南
│   └── troubleshooting.md    # 故障排查
├── ecosystem.config.js    # PM2进程管理配置
├── nginx.conf.example     # Nginx配置示例
└── .env.example           # 环境变量示例
```

## 开发指南

### 后端API端点

详细API文档请参考 [API文档](docs/api-reference.md)。

主要API模块：

| 模块 | 前缀 | 主要功能 |
|------|------|---------|
| 认证 | `/api/auth` | 注册、登录、登出、用户信息 |
| LLM模型 | `/api/llm` | 模型配置、测试连接、监控 |
| Prompt模板 | `/api/prompts` | 模板CRUD、版本管理 |
| 学生 | `/api/students` | CRUD、批量导入、导出 |
| 班级 | `/api/classes` | CRUD、学生分配 |
| 知识点 | `/api/knowledge-points` | CRUD、树形查询、关系管理 |
| 试卷 | `/api/papers` | 导入、拆分、导出PDF/Word |
| 题目 | `/api/questions` | 列表、详情、批量操作、质量校验 |
| AI分析 | `/api/analysis` | 知识点识别、解析、答案、审核 |
| 难度 | `/api/difficulty` | 评估、批量评估、调整、统计 |
| 出卷 | `/api/exams` | 生成、预览、模板、导出 |
| 在线测验 | `/api/online-exams` | 创建、发布、答题、提交 |
| AI批改 | `/api/grading` | 单题/批量批改、调整、统计 |
| 掌握度 | `/api/mastery` | 计算、薄弱点、报告、知识地图 |
| 错题本 | `/api/wrong-questions` | 列表、重练、变式、统计、导出 |
| 推荐 | `/api/recommendation` | 每日推荐、专项、练习、学习路径 |
| 模拟考试 | `/api/mock-exams` | 创建、答题、成绩、对标分析 |
| 学习激励 | `/api/incentive` | 徽章、打卡、排行榜、挑战、通知 |

### 测试

```bash
# 后端单元测试（114个测试）
cd backend
npx jest

# 前端E2E测试（Playwright）
cd frontend
npx playwright install chromium  # 首次需安装浏览器
npx playwright test

# 前端构建
cd frontend
npm run build
```

### 数据库管理

```bash
cd backend

# 查看数据库
npx prisma studio

# 创建迁移
npx prisma migrate dev --name <migration_name>

# 同步数据库（开发环境）
npx prisma db push

# 重置数据库
npx prisma migrate reset
```

### 代码格式化

```bash
# 前端
cd frontend
npm run format

# 后端
cd backend
npm run format
```

## 生产部署

### PM2 进程管理

```bash
# 启动服务
pm2 start ecosystem.config.js

# 查看状态
pm2 status

# 查看日志
pm2 logs

# 重启服务
pm2 restart all

# 停止服务
pm2 stop all
```

### Nginx 配置

参考 `nginx.conf.example` 配置反向代理和静态文件服务。

### 环境变量

完整的环境变量配置请参考 `.env.example`：

| 变量 | 说明 | 默认值 |
|------|------|--------|
| DATABASE_URL | PostgreSQL连接字符串 | - |
| JWT_SECRET | JWT密钥 | - |
| PORT | 后端端口 | 3000 |
| NODE_ENV | 运行环境 | development |

## 常见问题

请参考 [故障排查文档](docs/troubleshooting.md)。

### Q: 数据库连接失败？

1. 确认 PostgreSQL 服务正在运行
2. 确认 DATABASE_URL 配置正确
3. 检查端口 5432 是否被占用

### Q: 前端无法访问后端API？

确认后端服务器正在运行，并且 CORS 配置正确。

### Q: PM2启动失败？

检查 Node.js 版本是否为 22+，并确认所有依赖已安装。

## License

ISC