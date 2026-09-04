## Why

当前试卷导入使用 pdfjs-dist 提取文本，数学公式（分数、根号、向量、积分等）作为特殊字体/图形嵌入 PDF 中，文本提取完全丢失。已集成的 mcq-extractor（PyMuPDF）对中文高考试卷提取质量差（10题→截断→回退pdfjs）。虽然已实现页面图片渲染和 LLM 数学重构作为补救，但都是间接方案——前者不可编辑/搜索，后者依赖 LLM 猜测公式。MinerU（OpenDataLab，GitHub 78K+ stars）使用深度学习模型自动识别数学公式并转换为 LaTeX，输出的 Markdown 可直接被前端 KaTeX 组件渲染，从根本上解决公式丢失问题。

## What Changes

- 集成 MinerU 作为 PDF/Word 试卷的主解析器，输出 Markdown + LaTeX 公式 + HTML 表格 + 图片引用
- 新建 `mineru-service.ts` Node.js 适配层，调用 MinerU CLI/API 解析文档
- 修改 `papers.ts` 导入路由：PDF 导入优先使用 MinerU，mcq-extractor 降级为 fallback
- 适配 `question-splitting-service.ts`：从 MinerU 输出的 Markdown 格式中拆分题目（含 LaTeX 公式）
- 修改 `ExamPaper` 模型：新增 `parsedMarkdown` 字段存储 MinerU 输出的 Markdown
- 保留现有 pdfjs-dist + mcq-extractor + 页面图片渲染作为回退链
- 前端无需改动（MathText/KaTeX 组件已就绪，LaTeX 公式直接渲染）

## Capabilities

### New Capabilities
- `mineru-parser-service`: MinerU 文档解析微服务能力，包括 Python 环境安装、CLI/API 调用适配、Markdown+LaTeX 输出格式处理、公式/表格/图片提取

### Modified Capabilities
- `exam-paper-import`: 试卷导入流程变更——PDF 导入优先使用 MinerU 解析（输出 Markdown+LaTeX），MinerU 不可用时回退到 pdfjs-dist+mcq-extractor 链；导入后题目内容包含 LaTeX 公式，前端 KaTeX 直接渲染

## Impact

- **后端新增依赖**: MinerU Python 包（`pip install mineru`），需要 Python 3.10+ 环境和模型文件
- **后端服务**: 新建 `mineru-service.ts` 适配层，修改 `pdf-service.ts`、`papers.ts`、`question-splitting-service.ts`
- **数据库**: ExamPaper 模型新增 `parsedMarkdown` 字段
- **部署**: ecosystem.config.js 新增 MinerU 相关配置，安装脚本更新
- **前端**: 无需改动（MathText/KaTeX 组件已有，LaTeX 公式直接渲染）
- **性能**: MinerU 首次运行需下载模型（约2-4GB），解析速度取决于 GPU/CPU（CPU模式20页约2-5分钟）
- **现有功能**: mcq-extractor 保留为 fallback，页面图片渲染保留为可视化补充
