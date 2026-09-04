# 数学学习系统 - 前端

基于 React + TypeScript + Vite 构建的高中数学智能学习系统前端应用。

## 技术栈

- React 19
- TypeScript
- Vite
- ESLint + Prettier

## 开发环境

### 前置要求

- Node.js 22+
- npm 或 yarn

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run dev
```

访问 http://localhost:5173

### 构建

```bash
npm run build
```

构建产物位于 `dist/` 目录。

### 代码检查

```bash
npm run lint
npm run format
```

## 生产部署

### 方式1: 静态文件服务

1. 构建前端：
   ```bash
   npm run build
   ```

2. 将 `dist/` 目录部署到 Web 服务器（Nginx、Apache 等）

3. 配置示例（Nginx）：
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;
       
       root /path/to/dist;
       index index.html;
       
       location / {
           try_files $uri $uri/ /index.html;
       }
       
       location /api {
           proxy_pass http://localhost:3000;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
       }
   }
   ```

### 方式2: 与后端集成

1. 构建前端：
   ```bash
   npm run build
   ```

2. 将 `dist/` 目录复制到后端的静态文件目录

3. 后端 Express 配置静态文件服务：
   ```typescript
   app.use(express.static(path.join(__dirname, 'public')));
   ```

## 环境变量

创建 `.env` 文件配置环境变量：

```env
VITE_API_BASE_URL=http://localhost:3000
```

## 项目结构

```
frontend/
├── src/
│   ├── components/     # React组件
│   ├── services/       # API服务
│   ├── types/          # TypeScript类型定义
│   ├── App.tsx         # 主应用组件
│   └── main.tsx        # 入口文件
├── public/             # 静态资源
├── index.html          # HTML模板
└── vite.config.ts      # Vite配置
```

## 相关文档

- [完整部署指南](../docs/deployment-native.md)
- [故障排查](../docs/troubleshooting.md)