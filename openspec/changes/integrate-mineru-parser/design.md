## Context

当前试卷导入使用 pdfjs-dist 提取文本，数学公式丢失。已集成 mcq-extractor（PyMuPDF）但中文高考试卷质量差（10题→截断→回退pdfjs）。已实现页面图片渲染（PyMuPDF渲染整页PNG）和LLM数学重构（猜测公式→LaTeX）作为补救，但都是间接方案。MinerU 使用5个深度学习模型（版面检测、公式检测、公式识别UniMERNet、表格识别、OCR），直接输出Markdown+LaTeX，从根本上解决公式丢失。

## Goals / Non-Goals

**Goals:**
- MinerU 作为 PDF/Word 试卷的主解析器，输出 Markdown+LaTeX
- 题目内容保留 LaTeX 公式，前端 KaTeX 直接渲染
- 保留现有 fallback 链（mcq-extractor → pdfjs-dist），MinerU 不可用时不影响导入
- 保留页面图片渲染作为可视化补充

**Non-Goals:**
- 不替换前端 MathText/KaTeX 组件（已有，直接可用）
- 不替换 LLM 分析流程（AI分析照常运行，输入变为含LaTeX的文本）
- 不修改 mcq-extractor 代码（保留为 fallback）
- 不支持 PPTX/XLSX 导入（MinerU 虽支持但超出当前需求）

## Decisions

### Decision 1: MinerU 部署方式 — CLI 子进程调用

**选择**: 通过 Node.js `child_process.spawn` 调用 MinerU CLI (`mineru -p input.pdf -o output/`)，而非运行独立 Python API 服务。

**理由**:
- MinerU CLI 是官方推荐用法，稳定可靠
- 无需额外维护一个 Python API 服务进程（mcq-extractor 已有一个微服务）
- CLI 调用完成后进程退出，资源释放干净
- 输出为文件（Markdown + 图片），后端直接读取

**替代方案**:
- MinerU Python API 服务（类似 mcq-extractor 模式）→ 需要维护额外进程，增加部署复杂度
- Python `import mineru` 直接调用 → 需要 Python bridge，复杂度高

**实现**: `mineru-service.ts` 使用 `spawn('mineru', ['-p', filePath, '-o', outputDir])`，等待完成后读取输出目录中的 `.md` 文件和图片。

### Decision 2: 解析优先级链 — MinerU → mcq-extractor → pdfjs-dist

**选择**: 三级 fallback 链，MinerU 优先。

```
PDF 导入
  ├─ 1. MinerU 可用? → 调用 MinerU → Markdown+LaTeX ✅ (最优)
  ├─ 2. MinerU 不可用 → mcq-extractor 可用? → 结构化提取
  └─ 3. 都不可用 → pdfjs-dist 纯文本提取 (最差但可用)
```

**理由**: MinerU 输出质量最好（LaTeX公式），但依赖最重（Python+模型）。三级链确保任何环境都能导入。

### Decision 3: MinerU 输出存储 — parsedMarkdown 字段 + rawContent 兼容

**选择**: ExamPaper 模型新增 `parsedMarkdown` 字段存储 MinerU 输出的原始 Markdown。`rawContent` 继续存储拆分后的文本。

**理由**:
- `parsedMarkdown` 保留完整 Markdown（含LaTeX+HTML表格+图片引用），可用于重新拆分或展示
- `rawContent` 存储拆分后的纯文本/JSON，兼容现有题目拆分逻辑
- 两个字段分离，不破坏现有数据结构

### Decision 4: 题目拆分适配 — Markdown 格式解析

**选择**: 修改 `question-splitting-service.ts`，新增 `splitQuestionsFromMarkdown(markdown)` 方法，从 MinerU 输出的 Markdown 中拆分题目。

**理由**:
- MinerU 输出 Markdown 格式（标题 `#`/`##`，列表 `1.`/`2.`，公式 `$...$`/`$$...$$`）
- 现有 `splitQuestions()` 基于正则匹配中文题号，需适配 Markdown 格式
- 拆分后的题目内容保留 LaTeX 公式，直接存储到 Question.content

### Decision 5: 超时与资源管理

**选择**: MinerU 调用超时设为 5 分钟（300秒），超时后终止进程。首次运行需下载模型（约2-4GB），单独提示。

**理由**:
- 20页高考试卷在CPU上约2-5分钟，5分钟超时留足余量
- GPU模式下更快（30秒-1分钟）
- 模型下载仅在首次运行时发生，后续从缓存加载

## Risks / Trade-offs

- **[模型下载大]** MinerU 首次运行需下载2-4GB模型文件 → 安装脚本明确提示，建议在非高峰期下载
- **[CPU解析慢]** 无GPU环境下20页PDF需2-5分钟 → 前端显示进度提示，设置5分钟超时
- **[Python环境依赖]** MinerU需要Python 3.10+和大量依赖 → 安装脚本检测环境，不可用时自动降级到mcq-extractor
- **[Markdown拆分复杂度]** MinerU输出Markdown格式多样 → 先用正则匹配题号，后续可增加LLM辅助拆分
- **[模型准确性]** MinerU对中文数学公式的识别准确率 → 对比验证：MinerU输出 vs 原卷图片，如准确率不足可配置使用页面图片渲染替代

## Migration Plan

1. 安装 MinerU Python 环境（不影响现有功能）
2. 新增 `mineru-service.ts` 适配层（不影响现有路由）
3. 修改 `papers.ts` 导入路由：MinerU 可用时优先调用
4. 修改 `question-splitting-service.ts`：新增 Markdown 拆分方法
5. 数据库迁移：ExamPaper 新增 `parsedMarkdown` 字段
6. 测试：用高考试卷PDF验证端到端
7. 回滚策略：MinerU 不可用时自动回退到现有解析链，无需代码回滚
