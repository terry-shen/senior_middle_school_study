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

---

## v2 章节化学习版本部署（v2.0）

> v1 已停止维护，v2 以「章节」为主轴：教材 → 章 → 节 → [视频/讲义/练习/试卷] → 答题纸 → 教师批注 → 错题回到该节。
> 数据库为 SQLite（`backend/prisma/dev.db`），无需 PostgreSQL；考试仅支持整卷模式；知识点/难度/在线逐题测验已移除。

### 1. 环境变量（backend/.env）

```
DATABASE_URL="file:./dev.db"
PORT=3000
JWT_SECRET=<生产环境务必更换>
JWT_EXPIRES_IN=7d
HF_HOME=D:\huggingface      # MinerU 模型目录（可放任意磁盘，避免占用 C 盘）
MINERU_API_PORT=56090
```

### 2. 安装依赖与初始化数据库

```powershell
cd backend; npm install; npx prisma generate; npx prisma db push
cd ../frontend; npm install
```

首次部署不会自动创建账号，需执行以下脚本（幂等）：

```powershell
cd backend
node seed-subjects.cjs           # 11 个学科字典
node seed-taxonomy.cjs           # 人教A 数学 5 册 / 18 章 / 73 节
node seed-taxonomy-science.cjs   # 人教版 物理 6 册 / 27 章 / 124 节 + 生物 5 册 / 25 章 / 81 节
node seed-taxonomy-chemistry.cjs # 人教版 化学 5 册 / 20 章 / 60 节
node seed-ai-assistants.cjs      # AI 助理目录（豆包 / DeepSeek / WorkBuddy）
node seed-llm-configs.cjs        # 可选：LLM 配置
```

管理员/学生账号可通过注册接口或 `/api/students/import/json` 批量导入。

### 3. 启动三件套

```powershell
# 后端（端口 3000）
cd backend
npm run build
Start-Process cmd -ArgumentList '/c','set HF_HOME=D:\huggingface&& node dist\index.js > ..\logs\backend.log 2> ..\logs\backend.err.log' -WindowStyle Hidden

# 前端（端口 5173，开发模式）
cd ../frontend
Start-Process cmd -ArgumentList '/c','npx vite --host' -WindowStyle Hidden

# MinerU 解析服务（端口 56090，试卷/Word 导入用；冷启 30-90s）
cd ../backend
Start-Process cmd -ArgumentList '/c','set HF_HOME=D:\huggingface&& mineru-api --host 127.0.0.1 --port 56090 >> logs\mineru-api.log 2>> logs\mineru-api.err.log' -WindowStyle Hidden
```

健康检查：`GET http://localhost:3000/health`、`GET http://localhost:56090/health`。

> 生产环境可用 `docs/deployment-native.md` 中的 Nginx + PM2 方案托管 `frontend/dist` 静态文件并反向代理 `/api`、`/uploads`。

### 4. 初始化网盘资源索引（可选，但推荐）

1. 管理员登录 → 系统设置 → **网盘绑定**，填入百度网盘开放平台 AppKey/SecretKey/SignKey 与回调地址，完成 OAuth 授权；
2. 进入 **资源映射**（`/netdisk-index`）点击「开始扫描」，系统递归扫描 `/apps/高中学习系统` 并自动分类（视频/讲义/练习/试卷/答案/课件/垃圾）、提取年份/地区/系列、生成章节候选；
3. 在左侧选择小节，右侧勾选资源「挂到选中节」，每节精选上限 5 条；
4. 学生端「章节学习」即可看到该节的精选与更多资源。

### 5. 从 v1 升级

- v1 的 `main` 已打 tag `v1-final`，v2 为 tag `v2.0`（同仓库、同数据库文件）；
- v2 schema 只新增表与列（`textbooks`、`chapters`、`sections`、`netdisk_assets`、`netdisk_scan_state`、`student_learning_progress` + 若干 `section_id` 列），不删除既有列；
- 升级步骤：停 v1 服务 → 拉取 v2 代码 → `npx prisma db push` → `node seed-taxonomy.cjs && node seed-taxonomy-science.cjs && node seed-taxonomy-chemistry.cjs` → 重新构建并启动；
- v1 的在线逐题测验入口已下线，旧的 online 考试会话在 v2 学生端不可见；如需保留请先导出成绩。

---

## v2.1 教材目录与资源映射维护

> 本章说明如何为新学科录入教材目录、如何重建网盘资源与章节的映射、以及如何清理重复文件。
> 所有脚本均为幂等或可回滚操作，可重复执行。

### 1. 教材目录现状

| 学科 | 脚本 | 版本 | 规模 |
|---|---|---|---|
| 数学 | `seed-taxonomy.cjs` | 人教A（2019） | 5 册 / 18 章 / 73 节 |
| 物理 | `seed-taxonomy-science.cjs` | 人教版（2019） | 6 册 / 27 章 / 124 节 |
| 生物 | `seed-taxonomy-science.cjs` | 人教版（2019） | 5 册 / 25 章 / 81 节 |
| 化学 | `seed-taxonomy-chemistry.cjs` | 人教版（2019） | 5 册 / 20 章 / 60 节 |

合计 21 册 / 90 章 / 338 节。英语、语文、政治、历史、地理暂未录入教材目录（这些学科的学生端不会出现章节，资源映射也不会产生结果）。

```powershell
cd backend
node seed-taxonomy.cjs             # 数学（已存在则跳过新增，按源文件覆盖标题）
node seed-taxonomy-science.cjs     # 物理 + 生物
node seed-taxonomy-chemistry.cjs   # 化学
```

这些脚本都按「册名 → 章序号 → 节序号」做 upsert：册按 `subjectId + edition + name` 定位，章/节的 `order` 直接取数组下标（第 1 章 = 1，第 1 节 = 1），已存在的记录会按其位置更新标题。**因此要改标题，请直接改脚本里的数组再执行**，不要只改数据库（下次执行会被覆盖）。

### 2. 新增一个学科的教材目录

以化学为例（`backend/seed-taxonomy-chemistry.cjs` 已按此方式落地，可直接复制为新学科的模板）：

1. 新建 `backend/seed-taxonomy-<code>.cjs`，仿照 `PHYSICS` / `BIOLOGY` / `CHEMISTRY` 定义常量（数组顺序即册/章/节顺序）：

```js
const CHEMISTRY = [
  {
    name: '必修第一册', grade: '高一上',
    chapters: [
      { title: '第一章 物质及其变化', sections: ['1.1 物质的分类及转化', '1.2 离子反应'] },
    ],
  },
];
```

2. 在文件末尾的启动块里调用（`seedSubject(code, 常量)`，code 必须是 `subjects` 表中已存在的学科代码）：

```js
const r = await seedSubject('chemistry', CHEMISTRY);
console.log('chemistry', JSON.stringify(r));
```

3. `node seed-taxonomy-chemistry.cjs` 执行；
4. `GET /api/chapters/tree?subjectId=<id>` 确认册/章/节数量；
5. 到「资源映射」页重新执行一次自动映射（见下节）。

> 若网盘新增了该学科的视频目录，还需：`POST /api/netdisk-index/scan {"dirs":["/apps/高中学习系统/视频教学/<新目录>"]}` 做增量扫描，再走下面的映射流水线。

### 3. 网盘资源 → 章节 的离线映射流水线

映射分三步，中间产物全部落盘在**仓库根目录**的 `data/netdisk-mapping/`（已加入 `.gitignore`），任何一步中断都可单独重跑，不会污染数据库。

```powershell
cd backend

# A. 导出快照（只读，不改库）
node scripts/netdisk-mapping/export-assets.cjs
#   → data/netdisk-mapping/assets.jsonl   （跳过 manual / ignored 的资源；加 --include-manual 可一并导出人工条目）
#   → data/netdisk-mapping/sections.json  （全部教材节）

# B. 计算映射方案（纯计算，不写库，可反复调规则）
node scripts/netdisk-mapping/propose-mapping.cjs
#   → data/netdisk-mapping/mapping-proposal.jsonl
#   → data/netdisk-mapping/stats.json     （mapped / unmapped / 各学科分布 / 覆盖节数 / 抽样 30 条）

# C. 写库（分批 500 条事务，支持断点续跑）
node scripts/netdisk-mapping/apply-mapping.cjs --reset     # --reset 清掉旧的 auto 结果后全量重算
node scripts/netdisk-mapping/apply-mapping.cjs             # 不带 --reset 则从中断处续跑
```

**匹配规则要点**

- 资源按路径中最靠后的学科关键词归属学科，只与该学科的教材节比对；
- 普通文档：节号命中 +3、节标题核心整串命中 +8、专有分词 +2、通用词（函数/性质/图象/概念…）+1，最高分 ≥5 且领先第二名 ≥2 才自动确认；
- 视频：**忽略课程编号**（数学课程编号 ≠ 教材节号），只用主题词与节标题匹配，`【章节标签】` 命中章名时额外加分；
- 未达阈值的资源只写候选（`candidateSections`），不确认、学生端不可见，可在「资源映射」页人工确认。

**页面内触发**（免命令行）：`/netdisk-index`（管理员）→ 头部「🔁 重新自动映射」，对应 `POST /api/netdisk-index/remap`，返回 `{scanned, mapped, perSection}`。

### 4. 资源去重

同一学科下，文件名（去副本编号、统一大小写与空白）与文件大小完全一致即视为重复。保留优先级：已挂章节 → 已确认 → 学生可见 → id 较小者；其余标记 `status = 'ignored'`（**不物理删除**，可在数据库改回 `active` 恢复）。

```powershell
cd backend
node scripts/netdisk-mapping/dedup-assets.cjs            # 预演，只输出重复组统计
node scripts/netdisk-mapping/dedup-assets.cjs --apply    # 实际写库
```

### 5. 当前基准数据（可作验收对照）

| 指标 | 数值 |
|---|---|
| 网盘资源总数 | 54,771 |
| 活跃资源（去重后） | 44,760 |
| 已确认挂接教材节 | 5,566 |
| 学生可见资源 | 3,593 |
| 有资源的教材节 | 307 / 338 |
| 数学覆盖 | 68 / 73 节 |
| 物理覆盖 | 113 / 124 节 |
| 化学覆盖 | 49 / 60 节 |
| 生物覆盖 | 77 / 81 节 |

### 6. 常见问题

- **学生端某节没有资源**：先看 `/netdisk-index` 该节的「未映射」数量。若资源存在但未确认，人工确认即可；若确实为空，说明网盘中没有对应主题的文件。
- **资源挂错节**：在「资源映射」页勾选后「解除映射」（`sectionId = null`），再挂到正确的小节；人工确认过的条目在后续自动映射中不会被覆盖（`mapSource='manual'`）。
- **重跑映射后学生端数量变少**：正常现象——新规则更严格，低置信度条目从「已确认」退回「候选」，可在页面人工确认。
- **换了学科选择器看不到内容**：章节与资源都按当前选中学科过滤，确认顶部学科切换器是否停在有教材目录的学科（数学/物理/化学/生物）。
- **化学等学科的视频分组名不对（出现「暑假」「秋季」等）**：非数学学科的分组名取自该视频已挂教材的册名；未挂上教材的视频会落到「其他」组，重新执行映射或人工确认后即可归位。
