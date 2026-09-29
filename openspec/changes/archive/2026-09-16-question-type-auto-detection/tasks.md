# Tasks: question-type-auto-detection

## 1. 后端题型识别增强

- [x] 1.1 扩展 `SplitQuestion` interface �?questionType 类型�?`'single_choice'|'multiple_choice'|'fill'|'essay'|'unknown'`（question-splitting-service.ts L10-19�?- [x] 1.2 重写 `detectQuestionType(content)` 函数：检�?`A.`/`B.`/`C.`/`D.` 选项模式→`single_choice`；检�?`____` 下划�?空括�?`�? ）`→`fill`；检测多个正确答案标记→`multiple_choice`；其余→`essay`；删�?长度>100→essay"兜底规则
- [x] 1.3 新增 `detectSectionType(title)` 函数：识别章节标题映射题型（一、单项选择题→single_choice，二、多项选择题→multiple_choice，三、填空题→fill，四、解答题→essay），兼容中文数字/阿拉伯数�?罗马数字/有无顿号/简�?- [x] 1.4 新增 `scanSectionTypes(markdown)` 函数：扫描全文识别所有章节标题位置，返回 `[{startIdx, endIdx, questionType}]` 区间列表

## 2. 后端拆分函数改�?
- [x] 2.1 改�?`splitQuestionsFromMarkdown()`：调�?`scanSectionTypes` 建立章节区间映射；拆分每道题时根据题目起始位置查找所属章节，继承章节题型；无章节时调用增�?`detectQuestionType` 兜底
- [x] 2.2 改�?`splitQuestionsByTags()`：同上，章节标题扫描 + 题型继承 + 规则兜底
- [x] 2.3 改�?`splitQuestionsFromDocx()`：同上（DOCX 无章节标题时纯规则兜底）

## 3. 后端出卷参数兼容

- [x] 3.1 `exams.ts` `normalizeParams()`：`typeDistribution.choice` 映射�?`typeDistribution.single_choice`（兼容旧参数�?
## 4. 前端题型枚举适配

- [x] 4.1 `papers-api.ts`：Question interface �?questionType 类型扩展为含 `single_choice`/`multiple_choice`；SplitPreviewQuestion 同步更新
- [x] 4.2 `QuestionList.tsx`：题型筛选下拉框增加 single_choice/multiple_choice 选项；题型标签显�?单选题"/"多选题"（旧 `choice` 值显示为"选择�?兼容�?- [x] 4.3 `exams-api.ts`：ExamGenerationParams typeDistribution 支持 `single_choice`/`multiple_choice`（替�?`choice`�?- [x] 4.4 `ExamGeneration.tsx`：出卷参数表单题型分布改�?单选题/多选题/填空�?解答�?
- [x] 4.5 `DifficultyManagement.tsx`/`OnlineExamManagement.tsx`/`MockExam.tsx` 等页面：题型标签显示适配新枚举�?
## 5. 前端编辑校准页面题型修正

- [x] 5.1 `SplitPreview.tsx`：每道题卡片加题型下拉框（single_choice/multiple_choice/fill/essay/unknown），修改后存入本�?questions 数组，确认导入时一起保存到 DB
- [x] 5.2 `SplitPreview.css`：题型下拉框样式

## 6. 验证

- [x] 6.1 后端 `npm run build` 编译通过
- [x] 6.2 前端 `npm run build` 构建通过
- [x] 6.3 E2E 测试：导�?`D:\2026年全国卷l数学卷高考真题带答案带解析文字版.docx`，验证拆分后题目题型正确（单选题/多选题/填空�?解答题区分，不再全部 essay�?- [x] 6.4 验证编辑校准页面题型下拉框可手动修正并保�?