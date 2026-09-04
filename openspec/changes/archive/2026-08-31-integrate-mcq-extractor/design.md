## Context

当前系统的试题导入流程使用 `pdf-service.ts`（pdfjs-dist）和 `word-service.ts`（mammoth）提取纯文本，无法识别数学公式。前端已有 KaTeX MathText 组件可渲染 LaTeX 公式，但后端提取阶段公式就已丢失。mcq-extractor-api 是一个 Python FastAPI 项目，提供数学内容检测、OCR 和结构化 MCQ 提取能力，需作为微服务集成到现有 Node.js 后端架构中。

## Goals / Non-Goals

**Goals:**
- 集成 mcq-extractor-api Python 微服务，实现数学公式感知的文档解析
- 在试题导入流程中自动检测数学内容并委托微服务处理
- 保留数学公式原文（Unicode 符号），前端通过 KaTeX 正确渲染
- 微服务不可用时自动回退到现有纯文本提取方式
- 支持 PM2 统一进程管理（Node.js + Python 同时运行）

**Non-Goals:**
- 不重写 mcq-extractor-api 的核心逻辑（直接使用开源项目代码）
- 不替代现有 question-splitting-service（仅作为上游输入增强）
- 不修改前端导入界面（后端提取能力增强，前端无感知）
- 不实现 LaTeX 公式的自动格式转换（保留原文即可，KaTeX 支持 Unicode 和 LaTeX 两种格式）

## Decisions

### 1. 微服务架构（Sidecar 模式）

**决策**：将 mcq-extractor-api 作为独立 Python 微服务运行（端口 8000），Node.js 后端通过 HTTP 调用。

**理由**：
- mcq-extractor-api 基于 Python FastAPI，依赖 PyMuPDF、OpenCV、Tesseract 等 Python 库，无法直接在 Node.js 中运行
- Sidecar 模式保持技术栈分离，Python 服务可独立更新
- HTTP 调用简单可靠，故障隔离性好

**替代方案**：
- 用 Node.js 重写核心逻辑 → 工作量大，且 Python OCR/数学分析库更成熟
- 使用 child_process 调用 Python 脚本 → 不支持文件上传、难以管理生命周期

### 2. 数学内容检测策略

**决策**：先使用 Node.js 端快速检测文档是否可能包含数学内容（正则匹配 ∫∑√π∂∇∞≤≥≠±×÷²³ 等符号），检测结果为"可能包含"时才调用微服务。

**理由**：
- 避免所有文档都走微服务（大部分试卷不含数学公式或公式简单）
- 快速检测只需正则扫描纯文本，耗时极低
- 检测为 true 时委托微服务做完整增强提取

### 3. 回退机制

**决策**：微服务不可用（连接失败或超时 120s）时，自动回退到现有 pdfjs-dist/mammoth 纯文本提取。

**理由**：
- 保证系统可用性，微服务故障不影响基本导入功能
- 回退结果标记 `fallback: true`，前端可提示用户数学公式可能丢失

### 4. 部署方式

**决策**：Python 微服务代码放在项目根目录 `mcq-extractor/` 子目录，通过 PM2 与 Node.js 一起管理。

**理由**：
- 统一进程管理，`pm2 start ecosystem.config.js` 同时启动两个服务
- 代码集中管理，便于版本控制和部署
- ecosystem.config.js 已有 PM2 配置，添加 Python 进程配置即可

### 5. 统一提取结果格式

**决策**：Node.js 适配层 `mcq-extractor-service.ts` 返回统一格式 `{ rawText, items, hasMathContent, fallback }`。

**理由**：
- 对上层调用方（papers.ts 路由）透明，无需区分是微服务还是纯文本提取的结果
- `items` 为结构化题目数组（mcq-extractor 返回时）或 null（纯文本回退时）
- 上层根据 `items` 是否存在决定使用结构化数据还是调用 question-splitting-service

## Risks / Trade-offs

- **Python 环境依赖**：需要安装 Python 3.8+、Tesseract OCR、OpenCV 等依赖，部署复杂度增加。通过提供安装脚本（`scripts/install-python-deps.sh/ps1`）缓解
- **性能开销**：微服务 HTTP 调用有网络延迟，OCR 处理大文件可能耗时较长。通过超时机制（120s）和回退策略缓解
- **OCR 准确性**：Tesseract 对复杂数学公式（如手写公式、特殊符号）的识别准确率有限。这是 OCR 技术的固有局限，非代码问题
- **微服务故障**：Python 服务可能崩溃或内存泄漏。通过 PM2 自动重启和回退机制缓解
- **维护成本**：需要维护两套技术栈（Node.js + Python）。但 mcq-extractor-api 是独立开源项目，可直接更新上游代码
