# Implementation Tasks

## Module 1: 依赖安装与数据模型
- [x] 1.1 安装npm依赖：`mammoth`（.docx解析）、`jschardet`（编码检测）、`iconv-lite`（编码转换）
- [x] 1.2 在Prisma schema的ExamPaper模型中添加 `sourceFormat String?` 字段
- [x] 1.3 执行 `npx prisma db push` 同步数据库
- [x] 1.4 重新生成Prisma Client

## Module 2: Word文档解析服务
- [x] 2.1 创建 `backend/src/services/word-service.ts`
- [x] 2.2 实现 `parseDocx(filePath): Promise<string>` — 使用mammoth提取纯文本（段落+表格）
- [x] 2.3 实现 `parseDocLegacy(filePath): Promise<string>` — 旧版.doc文本提取兜底
- [x] 2.4 编写单元测试验证Word解析输出正确文本

## Module 3: 纯文本解析服务
- [x] 3.1 创建 `backend/src/services/text-service.ts`
- [x] 3.2 实现 `parseText(filePath): Promise<string>` — jschardet检测编码 + iconv-lite解码
- [x] 3.3 实现编码检测置信度判断（<50%默认UTF-8，解码失败抛错）
- [x] 3.4 编写单元测试验证UTF-8和GBK编码文件解析正确

## Module 4: 上传服务扩展
- [x] 4.1 修改 `backend/src/services/upload-service.ts` 文件类型白名单，新增.docx/.doc/.txt
- [x] 4.2 修改multer文件大小限制为50MB
- [x] 4.3 验证上传不支持的格式返回400错误

## Module 5: 导入API路由扩展
- [x] 5.1 修改 `backend/src/routes/papers.ts` 的import端点，根据扩展名路由到对应解析服务
- [x] 5.2 创建试卷记录时写入 `sourceFormat` 字段
- [x] 5.3 复用现有 `question-splitting-service` 进行试题拆分
- [x] 5.4 编写集成测试：分别上传.docx和.txt文件验证导入成功

## Module 6: 前端界面更新
- [x] 6.1 更新 `frontend/src/pages/PaperImport.tsx` 文件输入accept属性
- [x] 6.2 更新拖拽区域提示文字为"支持 PDF、图片、Word（.docx）、文本（.txt）"
- [x] 6.3 试卷列表表格显示sourceFormat列（PDF/图片/Word/文本）
- [x] 6.4 验证前端构建通过

## Module 7: 验证与文档
- [x] 7.1 端到端验证：上传真实Word试卷文件，确认解析和拆分正确
- [x] 7.2 端到端验证：上传真实TXT试卷文件，确认编码检测和解析正确
- [x] 7.3 验证不支持的格式（如.xlsx）被正确拒绝
- [x] 7.4 验证现有PDF和图片导入不受影响（回归测试）
