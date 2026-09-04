## Why

当前试题导入功能（PDF/Word/富文本）无法正确识别数学公式、化学方程式、物理符号等特殊内容。现有 `pdf-service.ts`（pdfjs-dist）和 `word-service.ts`（mammoth）仅提取纯文本，数学符号如 ∫、∑、√、π、分数、上下标等在提取过程中丢失或变成乱码，导致导入的题目内容不完整、无法正确显示。

需要集成开源项目 [mcq-extractor-api](https://github.com/Deepak37699/mcq-extractor-api)，该项目基于 Python FastAPI 构建，具备数学内容检测（∫、∑、√、π 符号、方程式、公式识别）、OCR 图片预处理、多格式文档解析（PDF/DOCX/XLSX/TXT/图片）和选择题自动提取能力，能解决当前导入流程中数学公式丢失的问题。

## What Changes

- 集成 mcq-extractor-api 作为 Python 微服务（sidecar），与现有 Node.js 后端并行运行
- 后端新增 `mcq-extractor-service.ts` 适配层，通过 HTTP 调用 Python 微服务的 `/extract-mcq-enhanced` 端点
- 修改 `pdf-service.ts` 和 `word-service.ts`，在检测到数学内容时自动委托给 mcq-extractor 微服务处理
- 修改 `question-splitting-service.ts`，使用 mcq-extractor 返回的结构化题目数据（含数学公式标记）
- 前端题目导入流程不变，但后端提取的题目内容保留数学公式原文（LaTeX 或 Unicode 符号）
- 添加 Python 微服务部署配置（requirements.txt、启动脚本、PM2 进程管理）
- 数学公式在前端通过已有的 KaTeX MathText 组件渲染显示

## Capabilities

### New Capabilities
- `mcq-extractor-service`: Python 微服务集成层，封装 mcq-extractor-api 的调用，提供数学公式感知的文档解析能力

### Modified Capabilities
- `exam-paper-import`: 修改试题导入流程，当文档包含数学内容时自动切换到 mcq-extractor 微服务进行公式感知提取，替代纯文本提取方式

## Impact

- **新增代码**：
  - `mcq-extractor/` 目录：Python 微服务代码（从开源项目复制或克隆）
  - `backend/src/services/mcq-extractor-service.ts`：Node.js 适配层
  - 部署配置：PM2 进程配置、Python 依赖安装脚本
- **修改代码**：
  - `backend/src/services/pdf-service.ts`：添加数学内容检测 + 委托提取逻辑
  - `backend/src/services/word-service.ts`：同上
  - `backend/src/services/question-splitting-service.ts`：使用 mcq-extractor 返回的结构化数据
  - `backend/src/routes/papers.ts`：导入路由调用新的提取服务
- **新增依赖**：Python 3.8+、FastAPI、PyMuPDF、PyPDF2、pytesseract、OpenCV、python-docx、openpyxl、SymPy
- **运行时**：需同时启动 Node.js 后端（端口 3000）和 Python 微服务（端口 8000）
- **前端**：无需修改，已有 KaTeX MathText 组件可渲染数学公式
