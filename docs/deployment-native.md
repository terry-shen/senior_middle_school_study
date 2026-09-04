# 高中数学学习系统 - 原生部署指南

本文档说明如何直接在操作系统上部署高中数学学习系统，不使用 Docker 容器化。

## 系统要求

### 操作系统
- Windows 10/11
- Linux: Ubuntu 20.04+, CentOS 8+, Debian 11+
- macOS 11+ (Big Sur)

### 软件依赖
- **Node.js**: 22.x 或更高版本
- **PostgreSQL**: 16.x 或更高版本
- **npm**: 10.x 或更高版本（随 Node.js 安装）
- **Python**: 3.8+ （用于 mcq-extractor 微服务，可选但推荐）
- **Tesseract OCR**: 5.x（可选，用于图片OCR识别）

## 环境准备

### Windows

#### 1. 安装 Node.js
1. 访问 https://nodejs.org/
2. 下载 Node.js 22.x LTS 版本
3. 运行安装程序，按照向导完成安装
4. 验证安装：
   ```powershell
   node -v  # 应显示 v22.x.x
   npm -v   # 应显示 10.x.x
   ```

#### 2. 安装 PostgreSQL
1. 访问 https://www.postgresql.org/download/windows/
2. 下载 PostgreSQL 16 安装程序
3. 运行安装程序，设置超级用户密码
4. 记住设置的密码，后续配置需要
5. 验证安装：
   ```powershell
   psql --version  # 应显示 16.x
   ```

#### 3. 启动 PostgreSQL 服务
```powershell
# 检查服务状态
Get-Service postgresql*

# 启动服务（如果未运行）
net start postgresql-x64-16
```

### Linux (Ubuntu/Debian)

#### 1. 安装 Node.js
```bash
# 添加 NodeSource 仓库
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -

# 安装 Node.js
sudo apt-get install -y nodejs

# 验证安装
node -v
npm -v
```

#### 2. 安装 PostgreSQL
```bash
# 安装 PostgreSQL
sudo apt-get install -y postgresql postgresql-contrib

# 启动服务
sudo systemctl start postgresql
sudo systemctl enable postgresql

# 验证安装
psql --version
```

### macOS

#### 1. 安装 Node.js
```bash
# 使用 Homebrew
brew install node@22

# 或使用 nvm
nvm install 22
nvm use 22

# 验证安装
node -v
npm -v
```

#### 2. 安装 PostgreSQL
```bash
# 使用 Homebrew
brew install postgresql@16

# 启动服务
brew services start postgresql@16

# 验证安装
psql --version
```

## 部署步骤

### 1. 获取项目代码
```bash
# 克隆项目（或复制项目文件）
git clone <repository-url>
cd senior_middle_school
```

### 2. 运行环境检测脚本

**Windows:**
```powershell
.\scripts\install.ps1
```

**Linux/macOS:**
```bash
chmod +x scripts/install.sh
./scripts/install.sh
```

脚本会检测 Node.js、PostgreSQL 和 npm 是否正确安装。

### 3. 初始化数据库

**Windows:**
```powershell
.\scripts\setup-db.ps1
```

**Linux/macOS:**
```bash
chmod +x scripts/setup-db.sh
./scripts/setup-db.sh
```

此脚本会：
- 创建数据库和用户
- 生成 `.env` 配置文件
- 初始化数据库 Schema

### 4. 配置环境变量

1. 复制环境变量示例：
   ```bash
   cp .env.example backend/.env
   ```

2. 编辑 `backend/.env` 文件：
   ```bash
   # 修改数据库连接字符串中的密码
   DATABASE_URL="postgresql://math_user:YOUR_PASSWORD@localhost:5432/math_learning"
   
   # 修改 JWT 密钥为随机字符串（至少 32 字符）
   JWT_SECRET="your-random-secret-key-at-least-32-characters-long"
   ```

### 5. 安装项目依赖

**Windows:**
```powershell
cd backend; npm install; cd ..
cd frontend; npm install; cd ..
```

**Linux/macOS:**
```bash
cd backend && npm install && cd ..
cd frontend && npm install && cd ..
```

### 6. 构建前端

```bash
cd frontend
npm run build
cd ..
```

构建完成后，静态文件位于 `frontend/dist/` 目录。

## 运行服务

### 开发环境

**后端：**
```bash
cd backend
npm run dev
```

**前端：**
```bash
cd frontend
npm run dev
```

访问 http://localhost:5173 查看前端，后端 API 在 http://localhost:3000。

### 生产环境

#### 使用 PM2（推荐）

1. 安装 PM2：
   ```bash
   npm install -g pm2
   ```

2. 构建后端：
   ```bash
   cd backend
   npm run build
   cd ..
   ```

3. 启动服务：
   ```bash
   pm2 start ecosystem.config.js
   ```

4. 查看状态：
   ```bash
   pm2 status
   pm2 logs
   ```

5. 设置开机自启：
   ```bash
   pm2 startup
   pm2 save
   ```

#### 使用 Nginx 托管前端

1. 构建前端：
   ```bash
   cd frontend
   npm run build
   ```

2. 复制 `dist/` 目录到 Web 服务器目录：
   ```bash
   sudo mkdir -p /var/www/math-learning/frontend
   sudo cp -r dist/* /var/www/math-learning/frontend/
   ```

3. 配置 Nginx：
   ```bash
   sudo cp nginx.conf.example /etc/nginx/sites-available/math-learning
   sudo ln -s /etc/nginx/sites-available/math-learning /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo nginx -s reload
   ```

## 验证部署

### 1. 检查后端健康状态
```bash
curl http://localhost:3000/health
```
应返回：`{"status":"ok",...}`

### 2. 检查前端访问
访问 http://localhost (Nginx) 或 http://localhost:5173 (开发模式)

### 3. 检查数据库连接
```bash
cd backend
npx prisma db push
```
应无错误输出。

## 常见问题

参见 [troubleshooting.md](./troubleshooting.md)

## 安全建议

1. **修改默认密码**：数据库用户、PostgreSQL 超级用户
2. **JWT 密钥**：使用强随机字符串，不要提交到版本控制
3. **HTTPS**：生产环境配置 SSL 证书
4. **防火墙**：只开放必要端口（80, 443, 3000）
5. **定期备份**：配置数据库定期备份

## 升级指南

1. 拉取最新代码：
   ```bash
   git pull
   ```

2. 更新依赖：
   ```bash
   cd backend && npm install && cd ..
   cd frontend && npm install && cd ..
   ```

3. 更新数据库：
   ```bash
   cd backend
   npx prisma migrate deploy
   cd ..
   ```

4. 重启服务：
   ```bash
   pm2 restart all
   ```

## MCQ Extractor 微服务部署

mcq-extractor 是一个 Python FastAPI 微服务，用于数学公式感知的试题提取。集成在系统导入流程中，当检测到 PDF/Word 文件包含数学公式时自动调用。

### 安装

1. **安装 Python 依赖**：
   ```bash
   # Windows
   pwsh scripts/install-python-deps.ps1
   
   # Linux/macOS
   bash scripts/install-python-deps.sh
   ```

2. **（可选）安装 Tesseract OCR**：仅图片 OCR 需要
   - Windows: https://github.com/UB-Mannheim/tesseract/wiki
   - Linux: `sudo apt-get install tesseract-ocr tesseract-ocr-chi-sim`
   - macOS: `brew install tesseract`

### 启动微服务

```bash
cd mcq-extractor
python -m uvicorn main:app --port 8000
```

### 使用 PM2 统一管理

`ecosystem.config.js` 已包含 mcq-extractor 进程配置：

```bash
pm2 start ecosystem.config.js
```

### 验证

```bash
curl http://localhost:8000/health
# 返回: {"status":"ok"}
```

### 回退机制

当 mcq-extractor 微服务不可用时，系统会自动回退到 pdfjs-dist（PDF）或 mammoth（Word）进行纯文本提取，并设置 `fallback=true` 标志。前端会显示警告："数学公式可能丢失"。

## MinerU 文档解析服务（推荐）

MinerU 是 OpenDataLab 开发的开源文档解析工具，能自动识别 PDF/Word 中的数学公式并转换为 LaTeX 格式，输出的 Markdown 可被前端 KaTeX 组件直接渲染。MinerU 是试卷导入的首选解析器。

### 安装

1. **安装 Python 3.10-3.13**（MinerU 不支持 Python 3.14）：

   ```bash
   # Windows: 下载安装 Python 3.11 或 3.12
   # Linux: sudo apt install python3.11 python3.11-pip
   ```

2. **安装 MinerU 及依赖**：

   ```bash
   # Windows
   pip install "mineru[pipeline]"

   # 或使用安装脚本
   .\scripts\install-mineru.ps1   # Windows
   ./scripts/install-mineru.sh    # Linux/macOS
   ```

3. **下载模型文件**（首次运行自动下载，约 2-4GB）：

   ```bash
   mineru-models-download
   # 选择 source: auto
   # 选择 type: all
   ```

### 启动 MinerU API 服务

```bash
# 直接启动
mineru-api --host 127.0.0.1 --port 8080

# 使用 PM2
pm2 start mineru-api --name mineru-api -- --host 127.0.0.1 --port 8080
```

`ecosystem.config.js` 已包含 MinerU API 进程配置，可通过 `pm2 start ecosystem.config.js` 一键启动所有服务。

### 验证

```bash
# 健康检查
curl http://localhost:8080/health
# 返回: {"status":"healthy","version":"3.4.5",...}

# 测试解析
curl -X POST http://localhost:8080/file_parse \
  -F "files=@test.pdf" \
  -F "backend=pipeline" \
  -F "lang_list=ch" \
  -F "formula_enable=true" \
  -F "return_md=true"
```

### 解析优先级链

系统按以下优先级自动选择解析器：

1. **MinerU**（首选）：输出 Markdown+LaTeX，数学公式完整保留
2. **mcq-extractor**（回退1）：结构化试题提取，质量不稳定
3. **pdfjs-dist/mammoth**（回退2）：纯文本提取，数学公式丢失

当 MinerU 不可用时，系统自动回退，无需手动干预。前端导入结果会显示使用的解析器（`parserUsed: mineru/mcq-extractor/pdfjs`）。

### 性能说明

- 首次运行需下载模型文件（约 2-4GB），后续从缓存加载
- CPU 模式：20 页 PDF 约需 2-5 分钟
- GPU 模式：约 30 秒-1 分钟
- 并发限制：默认最多 3 个并发解析任务

### 服务端口

| 服务 | 端口 | 说明 |
|------|------|------|
| 后端 API (Node.js) | 3000 | 主应用 API |
| 前端 (Vite/Nginx) | 5173/80 | 前端页面 |
| mcq-extractor (Python) | 8000 | 试题提取微服务（回退） |
| MinerU API (Python) | 8080 | 文档解析服务（推荐） |
   ```