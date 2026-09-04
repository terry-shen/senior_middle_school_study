## Why

当前题目拆分依赖正则表达式在MinerU输出的Markdown中猜测题目边界（`N.` 行首匹配、`【答案】` 分割等），但高考数学试卷格式复杂多变：题号可能出现在解析文本中、`故选B5.` 这种粘连情况、`【答案】` 标记位置不一致等。导致拆分结果不稳定（18题 vs 应有19题、内容错位、答案/解析归属错误）。

根本问题是**检测和拆分耦合在一起**——检测错误直接导致拆分错误，没有人工校准环节。用户提出的方案通过在Markdown中插入HTML注释标签（`<!--QN_START-->` / `<!--QN_END-->`）将题目边界显式化，拆分阶段只需找标签配对，实现零猜测的可靠拆分。

此外，当前流程在确认导入后编辑器不可再次使用，且重新拆分会删除旧题目再新增，导致题目ID变化、关联关系（答案记录、错题本、掌握度等）丢失。用户要求：编辑能力永久保留、重新拆分时更新而非新增题目、源文件保留可下载对比。

## What Changes

- 在导入流程中新增**自动打标签**步骤：MinerU解析完成后，系统基于启发式规则在Markdown中自动插入 `<!--QN_START-->` 和 `<!--QN_END-->` 标签标记每道题的边界
- **多文件批量导入**：导入界面支持同时选择多个文件（PDF/DOCX/TXT），后端逐个文件调用MinerU解析并存储，每个文件生成一张ExamPaper记录
- **导入与校准分离**：导入完成后**不自动跳转**到编辑器页面，用户留在导入页面可继续导入更多文件；导入操作和手工校准动作分开并行处理，互不阻塞——用户可随时从试卷列表进入编辑器校准
- 编辑器中新增**标签可见化**：左侧源码区显示标签供用户校准（添加/删除/移动标签），右侧预览区隐藏标签只显示渲染效果
- 拆分逻辑从正则猜测改为**标签配对**：`<!--QN_START-->([\s\S]*?)<!--QN_END-->` 提取题目内容，再从内容中用简单规则提取答案/解析
- 编辑器新增"添加题目标签"快捷按钮：方便用户在系统漏检时手动插入标签
- 标签格式使用HTML注释 `<!--QN_START-->` / `<!--QN_END-->`，不破坏Markdown渲染、预览区自动隐藏
- **编辑能力永久保留**：试卷状态 `completed` 后仍可回到编辑器修改Markdown，重新拆分更新题目
- **重新拆分更新而非新增**：Question模型新增 `sourcePaperId` + `sourceQuestionNumber` 来源索引字段；重新拆分时按来源索引匹配已有题目，更新内容而非删除重建
- **按源试卷批量删除**：题目列表支持按源试卷删除该试卷的所有题目，便于整试卷重新导入
- **源文件保留与下载**：导入的原始文件（PDF/DOCX）永久保留在 `uploads/papers/`，试卷详情页和编辑器提供下载链接，便于人工对比富文本内容与源文档

## Capabilities

### New Capabilities

- `tag-based-splitting`: 基于HTML注释标签的题目边界标注与拆分能力，包含自动打标签启发式、标签格式规范、标签配对拆分逻辑

### Modified Capabilities

- `exam-paper-import`: 导入流程支持多文件批量导入；导入与校准分离（不自动跳转编辑器）；导入后自动打标签；新增源文件保留与下载能力
- `paper-edit-workflow`: 编辑器新增标签可见化、标签快捷操作、拆分逻辑改为标签配对；编辑能力永久保留（completed状态可回编辑器）；重新拆分更新而非新增题目
- `question-bank-management`: Question新增来源索引字段（sourcePaperId + sourceQuestionNumber），支持按来源索引更新已有题目；新增按源试卷批量删除题目能力

## Impact

- **后端**：`question-splitting-service.ts` 新增 `autoTagQuestions()` + `splitQuestionsByTags()`；`papers.ts` 导入路由支持多文件上传（multipart多file字段）、逐个解析存储、不自动跳转、新增源文件下载端点；confirm-import端点改为更新逻辑（匹配sourcePaperId+sourceQuestionNumber）
- **前端**：`PaperEdit.tsx` 新增标签高亮+快捷按钮+状态栏标签计数+源文件下载链接；`PaperImport.tsx` 支持多文件选择、导入后不跳转、显示导入进度列表；`SplitPreview.tsx` 拆分逻辑改为标签配对
- **数据库**：Question模型新增 `sourcePaperId Int?` + `sourceQuestionNumber Int?` 字段；ExamPaper.pdfUrl已存在（源文件路径）
- **向后兼容**：已有无标签的试卷仍可用旧regex拆分作为回退；已有题目sourcePaperId为null，不影响现有逻辑
