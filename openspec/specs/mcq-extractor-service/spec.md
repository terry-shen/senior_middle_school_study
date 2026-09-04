# mcq-extractor-service Specification

## Purpose

提供数学公式感知的文档解析微服务，通过集成开源项目 mcq-extractor-api，实现对 PDF、Word、图片等格式文件中数学公式、化学方程式、物理符号等特殊内容的识别和结构化提取。

## Requirements

### Requirement: Python微服务启动与健康检查

系统 SHALL 提供一个基于 Python FastAPI 的微服务，封装 mcq-extractor-api 的核心功能，包括数学内容检测、OCR 图片预处理和多格式文档解析能力。

#### Scenario: 微服务正常启动

- **WHEN** 系统启动 Python 微服务（默认端口 8000）
- **THEN** 微服务 SHALL 在 `GET /health` 返回 200 状态码和 `{"status": "healthy"}`

#### Scenario: Node.js后端检测微服务可用性

- **WHEN** Node.js 后端启动时或首次调用提取功能前
- **THEN** 后端 SHALL 通过 HTTP 请求 `GET http://localhost:8000/health` 检测微服务是否可用
- **AND** 如果微服务不可用，后端 SHALL 回退到现有的纯文本提取方式并在日志中记录警告

### Requirement: 数学公式感知文档解析

系统 SHALL 通过 Python 微服务的 `POST /extract-mcq-enhanced` 端点，对上传的文档进行数学公式感知的内容提取，识别内容包括数学符号（∫、∑、√、π）、方程式、公式、表格和图表。

#### Scenario: PDF文档包含数学公式

- **WHEN** 用户上传包含数学公式的 PDF 文件（如函数公式、积分符号、根号表达式）
- **THEN** 微服务 SHALL 返回提取的文本内容，保留数学公式原文（Unicode 符号或 LaTeX 格式）
- **AND** 返回结果 SHALL 包含 `has_mathematical_content: true` 标记和数学元素分类

#### Scenario: Word文档包含数学公式

- **WHEN** 用户上传包含数学公式的 .docx 文件
- **THEN** 微服务 SHALL 通过 python-docx 提取文本并检测数学内容
- **AND** 数学公式 SHALL 以原文形式保留，不转换为纯文本或丢失符号

#### Scenario: 图片包含数学公式

- **WHEN** 用户上传包含手写或印刷数学公式的图片文件（.jpg/.png）
- **THEN** 微服务 SHALL 通过 Tesseract OCR（含图片预处理）提取文字和数学符号
- **AND** 提取结果 SHALL 保留可识别的数学符号

#### Scenario: 文档不包含数学公式

- **WHEN** 用户上传的文档不包含数学公式
- **THEN** 微服务 SHALL 返回正常提取的文本内容
- **AND** `has_mathematical_content` 字段 SHALL 为 `false`

### Requirement: 选择题结构化提取

系统 SHALL 从文档中自动识别和提取选择题（MCQ），包括题干、选项（A/B/C/D）和正确答案，返回结构化的题目数据。

#### Scenario: 标准选择题格式提取

- **WHEN** 文档包含标准格式的选择题（如 `1. 题目内容` + `A) 选项A` + `Answer: A`）
- **THEN** 微服务 SHALL 返回结构化的题目数组，每题包含 `question_number`、`question`、`options`、`correct_answer` 字段
- **AND** 题目内容中的数学公式 SHALL 被保留

#### Scenario: 多种题号格式支持

- **WHEN** 文档使用不同的题号格式（`1.`、`Q1:`、`1)`、`Question: 1`）
- **THEN** 微服务 SHALL 能识别所有格式并正确提取题目

### Requirement: Node.js适配层调用接口

系统 SHALL 提供 Node.js 适配层（`mcq-extractor-service.ts`），封装对 Python 微服务的 HTTP 调用，提供统一的提取接口给现有导入流程使用。

#### Scenario: 调用增强提取端点

- **WHEN** Node.js 后端需要解析包含数学内容的文档
- **THEN** 适配层 SHALL 通过 `POST http://localhost:8000/extract-mcq-enhanced` 上传文件并获取结构化提取结果
- **AND** 适配层 SHALL 返回统一的提取结果格式（包含 `rawText`、`items`、`hasMathContent` 字段）

#### Scenario: 微服务不可用时回退

- **WHEN** Python 微服务不可用或调用超时（超过 120 秒）
- **THEN** 适配层 SHALL 回退到现有的 `pdf-service.ts` 或 `word-service.ts` 纯文本提取方式
- **AND** 适配层 SHALL 在返回结果中标记 `fallback: true` 表示使用了回退方案
