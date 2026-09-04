## 1. Python 微服务搭建

- [x] 1.1 创建 `mcq-extractor/` 目录，从 https://github.com/Deepak37699/mcq-extractor-api 克隆或复制核心代码（main.py、requirements.txt、pyproject.toml）
- [x] 1.2 安装 Python 依赖（`pip install -r mcq-extractor/requirements.txt`），确保 Tesseract OCR 已安装
- [x] 1.3 验证微服务可启动：`cd mcq-extractor && uvicorn main:app --port 8000`，访问 `GET /health` 返回 200
- [x] 1.4 创建 `scripts/install-python-deps.ps1` 和 `scripts/install-python-deps.sh` 安装脚本（检测 Python、pip install、检测 Tesseract）
- [x] 1.5 更新 `ecosystem.config.js` 添加 Python 微服务 PM2 进程配置（interpreter: python, script: mcq-extractor/main.py, name: mcq-extractor）

## 2. Node.js 适配层

- [x] 2.1 创建 `backend/src/services/mcq-extractor-service.ts`，实现 `checkHealth()` 方法（GET http://localhost:8000/health，返回 boolean）
- [x] 2.2 实现 `extractEnhanced(filePath)` 方法（POST /extract-mcq-enhanced 上传文件，返回 `{ rawText, items, hasMathContent, fallback }` 统一格式）
- [x] 2.3 实现 `detectMathContent(text)` 方法（正则匹配 ∫∑√π∂∇∞≤≥≠±×÷²³等数学符号，返回 boolean）
- [x] 2.4 实现超时回退逻辑（HTTP 调用超时 120s 时返回 fallback 结果，调用现有 pdf-service/word-service）
- [x] 2.5 安装 `form-data` npm 依赖（用于 Node.js 中构建 multipart/form-data 请求上传文件到 Python 微服务）

## 3. 导入流程改造

- [x] 3.1 修改 `backend/src/services/pdf-service.ts`：添加数学内容检测，检测到数学符号时委托 mcq-extractor-service 提取
- [x] 3.2 修改 `backend/src/services/word-service.ts`：同上，检测数学内容时委托微服务
- [x] 3.3 修改 `backend/src/routes/papers.ts`：导入路由调用新的提取逻辑，处理 `items`（结构化数据）和 `rawText`（纯文本回退）两种情况
- [x] 3.4 修改 `backend/src/services/question-splitting-service.ts`：当 mcq-extractor 返回结构化 `items` 时，直接使用该数据创建 Question 记录，跳过正则拆分
- [x] 3.5 确保提取的数学公式原文在 Question.content 字段中保留（前端已有 KaTeX MathText 组件可渲染）

## 4. 前端适配（最小改动）

- [x] 4.1 在 PaperImport.tsx 导入结果中显示 `fallback` 警告（当微服务回退时提示"数学公式可能丢失"）
- [x] 4.2 确认 QuestionList.tsx 的 MathText 组件能正确渲染 mcq-extractor 提取的 Unicode 数学符号

## 5. 验证

- [x] 5.1 后端 TypeScript 编译通过（`npm run build`）
- [x] 5.2 启动 Python 微服务 + Node.js 后端 + 前端，验证三个服务同时运行
- [x] 5.3 E2E 测试：上传包含数学公式的 PDF 文件 → 验证公式保留 → 验证前端 KaTeX 渲染正确
- [x] 5.4 E2E 测试：上传不包含数学公式的文件 → 验证使用纯文本提取（不走微服务）
- [x] 5.5 E2E 测试：停止 Python 微服务 → 上传含数学公式文件 → 验证回退到纯文本提取 + fallback 警告
- [x] 5.6 更新 `docs/deployment-native.md` 添加 Python 微服务部署说明
