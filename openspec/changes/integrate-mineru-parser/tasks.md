# Tasks: integrate-mineru-parser

## 1. MinerU 环境安装与配置

- [x] 1.1 安装 MinerU Python 包 (`pip install mineru`)，验证 `mineru --version` 可用
- [x] 1.2 首次运行触发模型下载，验证模型文件就绪
- [x] 1.3 创建安装脚本 `scripts/install-mineru.ps1`（Windows）和 `scripts/install-mineru.sh`（Linux）
- [x] 1.4 更新 `ecosystem.config.js`：无需新增进程（CLI调用方式），但添加配置注释

## 2. Node.js 适配层

- [x] 2.1 创建 `backend/src/services/mineru-service.ts`
  - `checkMinerUAvailable()`: 检测 mineru 命令是否可用
  - `parseWithMinerU(filePath)`: 调用 mineru CLI 解析文档，返回 `{ success, markdown, images, processingTime }`
  - `parseWithFallback(filePath)`: MinerU 优先 → mcq-extractor → pdfjs-dist 三级回退
  - 超时管理（300秒），进程管理（spawn + kill）
- [x] 2.2 定义 TypeScript 接口 `MinerUParseResult { success, markdown, images: string[], latexFormulas: string[], processingTime, fallback, error? }`

## 3. 数据库变更

- [x] 3.1 ExamPaper 模型新增 `parsedMarkdown String? @map("parsed_markdown")` 字段
- [x] 3.2 执行 `npx prisma db push` 同步数据库
- [x] 3.3 执行 `npx prisma generate` 更新 Prisma Client

## 4. 导入路由修改

- [x] 4.1 修改 `backend/src/routes/papers.ts` 导入路由：
  - PDF 导入优先调用 `parseWithMinerU(filePath)`
  - 成功则存储 `parsedMarkdown` 字段，rawContent 存储拆分后文本
  - MinerU 失败回退到 `extractTextFromPDFEnhanced`（现有逻辑）
  - 响应中新增 `parserUsed` 字段（mineru/mcq-extractor/pdfjs）
- [x] 4.2 Word 导入同样适配：`.docx/.doc` 文件优先调用 MinerU

## 5. 题目拆分适配

- [x] 5.1 修改 `backend/src/services/question-splitting-service.ts`：
  - 新增 `splitQuestionsFromMarkdown(markdown)` 方法
  - 从 Markdown 格式中识别题号（`## 1.`、`### 一、`等）
  - 拆分后的题目内容保留 LaTeX 公式（`$...$`/`$$...$$`）
  - 提取选项（A. B. C. D. 格式，保留公式）
  - 提取答案（`【答案】` 标记）
- [x] 5.2 修改 `papers.ts` split 路由：如果 paper 有 `parsedMarkdown`，从中拆分题目

## 6. 前端适配（最小改动）

- [x] 6.1 `papers-api.ts`: ExamPaper 接口新增 `parsedMarkdown?` 字段，ImportResult 新增 `parserUsed?` 字段
- [x] 6.2 `PaperImport.tsx`: 导入成功提示显示 `parserUsed`（MinerU/mcq-extractor/pdfjs）
- [x] 6.3 验证 QuestionList 的 MathText(KaTeX) 组件能正确渲染 MinerU 输出的 LaTeX

## 7. 验证

- [x] 7.1 后端 `npm run build` (tsc) 编译通过
- [x] 7.2 前端 `npm run build` (vite) 构建通过
- [x] 7.3 E2E 测试：用高考试卷PDF导入 → 验证 MinerU 解析 → 验证题目含LaTeX → 验证前端KaTeX渲染
- [x] 7.4 Fallback 测试：MinerU 不可用时 → 回退到 mcq-extractor → 回退到 pdfjs-dist
- [x] 7.5 更新 `docs/deployment-native.md`：添加 MinerU 安装与配置说明
