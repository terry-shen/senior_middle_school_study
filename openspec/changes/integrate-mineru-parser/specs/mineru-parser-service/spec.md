## Purpose

MinerU 文档解析微服务能力：通过集成 OpenDataLab 的 MinerU 开源工具，将 PDF/Word 文档中的数学公式自动识别并转换为 LaTeX 格式，同时提取表格为 HTML、图片为独立文件，输出结构化 Markdown 供题库系统使用。

## ADDED Requirements

### Requirement: MinerU 环境安装与配置

系统 SHALL 提供 MinerU Python 环境的安装脚本，包括 Python 3.10+ 检测、mineru 包安装、模型文件下载验证。安装脚本 SHALL 支持 Windows (PowerShell) 和 Linux/macOS (Bash) 平台。

#### Scenario: 首次安装 MinerU
- **WHEN** 管理员运行安装脚本 `scripts/install-mineru.ps1`（Windows）或 `scripts/install-mineru.sh`（Linux）
- **THEN** 脚本检测 Python 3.10+ 是否安装，若未安装则提示安装方法
- **AND** 脚本执行 `pip install mineru` 安装 MinerU 及其依赖
- **AND** 脚本验证 `mineru` 命令可用，输出版本号
- **AND** 脚本提示首次运行将自动下载模型文件（约2-4GB）

#### Scenario: MinerU 健康检查
- **WHEN** 系统调用 MinerU 健康检查接口
- **THEN** 返回 MinerU 是否已安装、版本号、模型是否就绪
- **AND** 如果 MinerU 不可用，系统继续使用 fallback 解析链（pdfjs-dist + mcq-extractor）

### Requirement: 文档解析为 Markdown+LaTeX

系统 SHALL 通过 MinerU 将 PDF/Word 文档解析为 Markdown 格式输出，其中数学公式自动识别并转为 LaTeX（行内公式 `$...$`，独立公式 `$$...$$`），表格转为 HTML，图片提取为独立文件。

#### Scenario: 解析含数学公式的 PDF
- **WHEN** 系统调用 MinerU 解析一份包含数学公式的高考数学试卷 PDF
- **THEN** 返回 Markdown 格式文本，其中行内公式包裹在 `$...$` 中（如 `$\vec{a}=(1,2)$`）
- **AND** 独立公式包裹在 `$$...$$` 中（如 `$$\frac{1}{2}$$`）
- **AND** 文本中的中文内容完整保留，无截断或乱码
- **AND** 表格转为 HTML `<table>` 格式
- **AND** 图片提取为独立文件，Markdown 中以 `![](image_path)` 引用

#### Scenario: 解析不含数学公式的 PDF
- **WHEN** 系统调用 MinerU 解析一份不含数学公式的普通文本 PDF
- **THEN** 返回 Markdown 格式文本，保留原文内容
- **AND** 输出符合人类阅读顺序，自动去除页眉页脚

#### Scenario: 解析 Word 文档
- **WHEN** 系统调用 MinerU 解析 .docx 格式的试卷
- **THEN** 返回与 PDF 相同格式的 Markdown+LaTeX 输出
- **AND** Word 中的公式对象（OMML）正确转换为 LaTeX

### Requirement: Node.js 适配层调用接口

系统 SHALL 提供 Node.js 适配层 `mineru-service.ts`，封装对 MinerU CLI/API 的调用，提供统一的 TypeScript 接口供后端路由使用。

#### Scenario: 调用 MinerU 解析文档
- **WHEN** 后端调用 `parseWithMinerU(filePath)` 方法
- **THEN** 适配层通过子进程或 HTTP API 调用 MinerU 解析指定文件
- **THEN** 返回 `{ success, markdown, images, latexFormulas, processingTime }` 结构
- **AND** 如果 MinerU 不可用或解析失败，返回 `{ success: false, error }` 而不抛出异常
- **AND** 设置超时时间（默认5分钟），超时后终止进程并返回失败

#### Scenario: MinerU 解析超时
- **WHEN** MinerU 解析一份大型 PDF（50页+）超过配置的超时时间
- **THEN** 适配层终止 MinerU 进程
- **AND** 返回 `{ success: false, error: 'timeout' }`
- **AND** 调用方继续使用 fallback 解析链
