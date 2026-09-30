> **归档说明（2026-09-30）**：本变更的 26 个任务在后续实施中全部完成并验证通过。
> 核对依据：后端 `question-splitting-service.ts` 含 `autoTagQuestions`(L745)/`splitQuestionsByTags`(L874，含无标签回退 + 未配对标签处理 L933)/
> `splitQuestionsByTagsAndSave`；`papers.ts` 导入路由 4 处调用 `autoTagQuestions` 并写入 `editedMarkdown`，
> 且已实现 `/:id/split-preview`、`/:id/confirm-import`、`/import-multiple`（多文件）、`/:id/download-source`；
> 前端 `PaperEdit.tsx` 含标签计数徽章 + 标签高亮提示 + 源文件下载按钮，`QuestionBank.tsx`（原 PaperImport.tsx，
> 后经 paper-library-restructure 重命名）含多文件选择 + 导入结果列表 + 编辑校准入口。
> 任务 2.6 采用 `paperId + questionNumber` 作为来源索引（未新增冗余字段），与设计决策一致。
> E2E 验证记录见 proposal.md。

## 1. 后端标签拆分逻辑

- [x] 1.1 在 `question-splitting-service.ts` 新增 `autoTagQuestions(markdown)` 函数：调用现有 `splitQuestionsFromMarkdown()` 获取题目列表，在markdown中每道题content开头前插入 `<!--QN_START-->`，下一题前插入 `<!--QN_END-->`，返回带标签的markdown字符串
- [x] 1.2 在 `question-splitting-service.ts` 新增 `splitQuestionsByTags(markdown)` 函数：使用正则 `/<!--Q(\d+)_START-->([\s\S]*?)<!--Q\1_END-->/g` 提取题目，从内容中查找 `【答案】` 和 `【解析】` 提取答案和解析，返回 SplitResult
- [x] 1.3 在 `splitQuestionsByTags()` 中添加无标签回退逻辑：检测markdown中无 `<!--Q` 标签时，调用 `splitQuestionsFromMarkdown()` 旧逻辑
- [x] 1.4 在 `splitQuestionsByTags()` 中添加未配对标签处理：检测到 `<!--QN_START-->` 但无对应 `<!--QN_END-->` 时，将该标签到下一题开始前的内容作为题目N的内容，记录警告

## 2. 后端导入路由修改

- [x] 2.1 修改 `papers.ts` 导入路由：MinerU解析完成后调用 `autoTagQuestions(parsedMarkdown)`，将带标签的markdown存储到 `editedMarkdown` 字段
- [x] 2.2 修改 `papers.ts` 的 `split-preview` 端点：优先调用 `splitQuestionsByTags(editedMarkdown || parsedMarkdown)`，无标签时回退到 `splitQuestionsFromMarkdown()`
- [x] 2.3 修改 `papers.ts` 的 `confirm-import` 端点：使用 `splitQuestionsByTags()` 替代 `splitQuestionsFromPaper()` 进行拆分入库；按 sourcePaperId + sourceQuestionNumber 匹配更新已有题目
- [x] 2.4 修改 `papers.ts` 导入路由：支持多文件上传（`upload.array('files', 10)`），逐个文件调用MinerU解析+autoTagQuestions，每个文件生成一张ExamPaper记录，返回导入结果数组
- [x] 2.5 新增 `GET /api/papers/:id/download-source` 端点：返回 ExamPaper.pdfUrl 对应的源文件（PDF/DOCX）供下载
- [x] 2.6 Question模型新增 `sourcePaperId Int?` + `sourceQuestionNumber Int?` 字段，执行 `npx prisma db push`
  - 实现说明：改用已有的 `paperId` + `questionNumber` 字段作为来源索引（`splitQuestionsByTagsAndSave` 按此二字段匹配更新），避免冗余字段

## 3. 前端编辑器标签增强

- [x] 3.1 修改 `PaperEdit.tsx`：添加标签CSS高亮样式，`<!--QN_START-->` 和 `<!--QN_END-->` 在源码区以特殊背景色显示
- [x] 3.2 修改 `PaperEdit.tsx`：添加"添加题目标签"按钮，点击后在光标位置插入 `<!--QN_START-->` 和 `<!--QN_END-->` 标签对，题号N自动递增为当前最大题号+1
- [x] 3.3 修改 `PaperEdit.tsx`：状态栏显示当前markdown中的标签对数量（`<!--QN_START-->` 的数量）
- [x] 3.4 修改 `PaperEdit.tsx`：添加源文件下载按钮，点击调用 `/api/papers/:id/download-source` 下载原始PDF/DOCX
- [x] 3.5 验证预览区标签自动隐藏：MathText渲染时HTML注释 `<!-- -->` 自动被浏览器忽略，不需要额外代码

## 4. 前端导入流程修改

- [x] 4.1 修改 `PaperImport.tsx`：文件选择控件支持 `multiple` 属性，允许同时选择多个文件（PDF/DOCX/TXT）
- [x] 4.2 修改 `PaperImport.tsx`：导入完成后**不跳转**到编辑器页面，留在导入页面显示导入结果列表（文件名、状态、paperId）
- [x] 4.3 修改 `PaperImport.tsx`：导入结果列表中每项显示状态（成功/失败/处理中），成功的项有"编辑校准"链接跳转到 `/papers/:id/edit`
- [x] 4.4 修改 `PaperImport.tsx`：试卷列表中 `uploaded` 状态的操作列显示"编辑校准"按钮（跳转编辑器），不再有"预览拆分"直接入口
- [x] 4.5 修改 `papers-api.ts`：新增 `importMultipleFiles(token, files)` 函数，使用 FormData 多 file 字段上传
  - 实现说明：`PaperImport.tsx` 后经 paper-library-restructure 重命名为 `QuestionBank.tsx`，功能保留

## 5. 端到端验证

- [x] 5.1 后端编译通过 `npm run build`，无TypeScript错误
- [x] 5.2 前端编译通过 `npm run build`，无TypeScript错误
- [x] 5.3 E2E测试：选择多个PDF文件导入 → 每个文件生成ExamPaper → 不跳转编辑器 → 导入页面显示结果列表
- [x] 5.4 E2E测试：从试卷列表进入编辑器 → 标签在源码区可见高亮 → 预览区标签隐藏 → 校准标签 → 预览拆分 → 标签配对拆分出正确数量题目 → 确认导入 → QuestionList显示正确题目
- [x] 5.5 E2E测试：导入旧试卷（无标签）→ 自动回退到正则拆分 → 验证向后兼容
- [x] 5.6 E2E测试：试卷状态completed后重新编辑 → 修改标签 → 重新拆分 → 验证题目更新而非新增（sourcePaperId匹配）
