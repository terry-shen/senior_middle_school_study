## Context

### 现有架构
- 后端：Node.js + Express + Prisma (SQLite)
- 现有文件处理服务：`upload-service.ts`（multer上传）、`pdf-service.ts`（PDF解析）、`ocr-service.ts`（Tesseract OCR）
- 导入入口：`POST /api/papers/import`，接收 `multipart/form-data`，字段 `file` + `title` 等元数据
- 试题拆分：`question-splitting-service.ts`，接收纯文本，按题型/题号拆分
- ExamPaper模型：已有 `rawContent`（文本内容）、`pdfUrl`、`imageUrl` 字段

### 设计约束
- 必须复用现有试题拆分流程，不重复造轮子
- Word解析必须处理中文内容（段落顺序、表格）
- TXT文件需自动检测编码（UTF-8 BOM / UTF-8无BOM / GBK）
- 文件大小限制：单文件不超过50MB
- 不改变现有PDF/图片导入行为

## Decisions

### Decision 1：Word文档解析库选择 — mammoth

**选项对比：**

| 方案 | 优点 | 缺点 |
|------|------|------|
| **mammoth** | 专注.docx→文本/HTML转换，API简单，支持段落和表格，活跃维护 | 不支持旧版.doc |
| docx (npm) | 可读写.docx，功能全面 | 偏底层，需手动遍历，代码量大 |
| libreoffice-convert | 支持所有格式 | 需安装LibreOffice，部署复杂 |

**决策**：使用 `mammoth` 处理 .docx（覆盖95%场景），.doc 格式降级为提示用户转换或使用文本提取兜底。

### Decision 2：TXT编码检测策略 — jschardet + iconv-lite

**策略**：
1. 读取文件前4KB，使用 `jschardet` 检测编码（UTF-8/GBK/GB2312）
2. 用 `iconv-lite` 按检测到的编码解码全文
3. 检测置信度低于50%时默认UTF-8，解码失败提示"编码无法识别"

### Decision 3：解析器路由模式 — 基于扩展名的策略分发

```
POST /api/papers/import
  → multer接收文件 → 检查扩展名
  → .pdf  → pdf-service.parsePDF()
  → image/* → ocr-service.recognize()
  → .docx  → word-service.parseDocx()     [新增]
  → .doc   → word-service.parseDocLegacy() [新增，兜底]
  → .txt   → text-service.parseText()      [新增]
  → 其他   → 400 不支持的格式
  → 提取纯文本 → question-splitting-service.splitQuestions()
  → 创建ExamPaper + Question记录
```

### Decision 4：sourceFormat字段 — 数据库增量迁移

ExamPaper模型新增 `sourceFormat` 字段（可选，默认null）：
```prisma
sourceFormat String? // pdf | image | word | txt
```
使用 `npx prisma db push` 增量同步，不破坏现有数据。迁移后已有记录的sourceFormat为null，前端显示为"未知"。

### Decision 5：上传白名单扩展

```typescript
// upload-service.ts
const allowedMimeTypes = [
  'application/pdf',
  'image/png', 'image/jpeg', 'image/webp',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/msword', // .doc
  'text/plain', // .txt
];
```

multer配置增加文件大小限制50MB（现有默认10MB）。

### Decision 6：前端文件选择器

PaperImport页面文件输入框：
- `accept` 属性更新为 `.pdf,.docx,.doc,.txt,image/*`
- 拖拽区域提示文字更新为"支持 PDF、图片、Word（.docx）、文本（.txt）"
- 新增格式选择下拉（可选）：用户可手动指定格式，用于.docx扩展名异常的情况

## Risks

### 风险：mammoth无法解析复杂排版试卷
**影响**：含多栏、复杂表格的Word试卷解析后文本顺序混乱
**缓解**：mammoth按段落顺序输出，表格转为行文本。若解析质量差，用户可在预览界面手动修正拆分结果（现有功能）。

### 风险：GBK编码检测误判
**影响**：少数混合编码文件可能检测错误
**缓解**：检测置信度阈值 + 解码失败兜底为UTF-8 + 用户预览确认。

### 风险：.doc格式支持有限
**影响**：旧版.doc无法用mammoth解析
**缓解**：.doc走文本提取兜底（可能丢失格式），或提示用户另存为.docx。
