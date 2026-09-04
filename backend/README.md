# 数学学习系统 - 后端

基于 Node.js + Express + TypeScript 构建的高中数学智能学习系统后端服务。

## 技术栈

- Node.js 22
- Express
- TypeScript
- Prisma ORM
- PostgreSQL

## 开发环境

### 前置要求

- Node.js 22+
- PostgreSQL 16+
- npm 或 yarn

### 安装依赖

```bash
npm install
```

### 环境配置

复制环境变量示例文件：

```bash
cp .env.example .env
```

编辑 `.env` 配置数据库连接：

```env
DATABASE_URL=postgresql://postgres:your_password@localhost:5432/math_learning
JWT_SECRET=your_secure_jwt_secret_here
PORT=3000
NODE_ENV=development
```

### 数据库初始化

```bash
# 生成 Prisma 客户端
npx prisma generate

# 同步数据库结构
npx prisma db push

# 或使用迁移
npx prisma migrate dev
```

### 开发模式

```bash
npm run dev
```

访问 http://localhost:3000

### 构建

```bash
npm run build
```

构建产物位于 `dist/` 目录。

### 测试

```bash
npm test
```

## 生产部署

### PM2 进程管理

```bash
# 安装 PM2
npm install -g pm2

# 启动服务
pm2 start ecosystem.config.js --only backend

# 查看状态
pm2 status

# 查看日志
pm2 logs backend
```

### 环境变量

| 变量 | 说明 | 必需 |
|------|------|------|
| DATABASE_URL | PostgreSQL连接字符串 | 是 |
| JWT_SECRET | JWT签名密钥 | 是 |
| PORT | 服务端口 | 否 (默认3000) |
| NODE_ENV | 运行环境 | 否 (默认development) |

## API 端点

### 系统

- `GET /health` - 健康检查
- `GET /api` - API信息

### LLM 管理

- `GET /api/llm/models` - 获取模型列表
- `POST /api/llm/models` - 添加模型配置
- `POST /api/llm/models/:id/test` - 测试连接
- `POST /api/llm/models/:id/default` - 设置默认模型
- `GET /api/llm/stats` - 调用统计
- `GET /api/llm/calls` - 调用日志

### Prompt 模板

- `GET /api/prompts/templates` - 列出模板
- `GET /api/prompts/templates/:id` - 获取模板
- `GET /api/prompts/templates/type/:taskType` - 获取任务类型模板
- `POST /api/prompts/templates` - 创建模板
- `PUT /api/prompts/templates/:id` - 更新模板
- `DELETE /api/prompts/templates/:id` - 删除模板
- `POST /api/prompts/templates/:id/activate` - 激活模板版本

## 数据库管理

```bash
# Prisma Studio - 可视化数据库管理
npx prisma studio

# 创建迁移
npx prisma migrate dev --name <migration_name>

# 重置数据库
npx prisma migrate reset

# 查看数据库状态
npx prisma db push --help
```

## 项目结构

```
backend/
├── src/
│   ├── adapters/       # LLM适配器(Ollama/云端API)
│   ├── routes/         # API路由
│   ├── services/       # 服务层
│   ├── types/          # TypeScript类型定义
│   └── index.ts        # 入口文件
├── prisma/
│   └── schema.prisma   # 数据库模型
├── tests/              # 测试文件
├── dist/               # 构建产物
└── package.json
```

## 开发指南

### 添加新的API路由

1. 在 `src/routes/` 创建路由文件
2. 在 `src/index.ts` 注册路由：
   ```typescript
   import newRoutes from './routes/new-routes';
   app.use('/api/new', newRoutes);
   ```

### 添加新的数据库模型

1. 编辑 `prisma/schema.prisma`
2. 运行 `npx prisma db push` 同步数据库
3. 在服务中使用 Prisma Client

## 相关文档

- [完整部署指南](../docs/deployment-native.md)
- [故障排查](../docs/troubleshooting.md)