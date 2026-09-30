# Proposal: 错题本重构（整卷模式下学生自主录入）

## Why

paper-library-restructure 把测验从"在线逐题答+系统判分"改成"下载试卷/线下作答/上传答题纸"之后，原错题本 spec 第 8-9 行"答题批改完成后自动归集"的触发路径事实上断了——学生作答发生在纸上，系统不再逐题判分，无法自动归集错题。错题本需要从"系统自动归集"转向"学生主动上传"。

同时原数据模型 `WrongQuestion` 通过 `questionId` 外键强绑定 Question 表，但 paper-library-restructure 之后整卷测验不再产生逐题 Question 记录，旧表事实上无数据来源。

## What Changes

### 1. 数据模型：彻底解耦 Question 表
- **BREAKING**：删除 `WrongQuestion`、`WrongQuestionPractice`、`VariationQuestion` 三张表
- 新建 `StudentWrongQuestion` 表：学生私域，题面内容冗余存储，不依赖任何 Question 外键
  - `source: 'photo' | 'manual'`（拍照录入/手动录入）
  - `imageUrl?`（photo 模式的错题图片）
  - `content?`（manual 模式的题面 Markdown/LaTeX，或 photo 模式后续补录的文本）
  - `options?`（JSON 数组，选择题选项）
  - `myAnswer?` / `correctAnswer?` / `analysis?`
  - `questionType: single_choice | multiple_choice | fill | essay | unknown`（允许 unknown 兜底）
  - `difficulty: easy | medium | hard | very_hard | unknown`（允许 unknown 兜底）
  - `knowledgePointTags?`（自由文本，逗号分隔，不外键引用 KnowledgePoint 表）
  - `reviewStatus: new | reviewing | mastered`
  - `wrongCount`（默认 1，重练答错 +1）
  - `createdAt` / `lastReviewAt`

### 2. 录入路径
- **拍照录入**：上传错题图片 + 元数据表单（题型/难度/知识点标签/我的答案/正确答案/备注）+ 支持后续补录题面文本（便于搜索）
- **手动录入**：复用 PaperEdit/KPEdit 的 MathLive + textarea dual-pane 模式，简化为单题录入（题面/选项/我的答案/正确答案/解析 + 元数据）

### 3. 重练模式
- 卡片盒模型：遮挡答案与解析 → 学生作答 → 揭示答案对比 → 学生自评对错
- 答对 → 标记已掌握（reviewStatus=mastered）；答错 → wrongCount + 1
- 不再依赖系统判分（整卷模式下系统无逐题答案数据）

### 4. 掌握度概览
- 按知识点标签分组，展示每组的掌握比例（已掌握数 / 总数 × 100%，简单比例算法）
- 未打标签的错题单独归入"未分类"行
- 薄弱知识点高亮（掌握度 < 50%）

### 5. 视图消减
- 默认视图：仅未掌握错题（reviewStatus != mastered）
- 全量视图：所有错题（含已掌握）
- 视图切换，数据不删

### 6. 导出/打印
- 选中错题 → 浏览器打印预览（window.print）→ 学生自行打印
- 拍照题渲染为图片，手动题渲染为 LaTeX 文本（MathText 组件复用）
- 不再生成 PDF/Word 文件

### 7. 移除依赖
- **BREAKING**：移除 `mock-exam-service.ts` 的 `getWrongQuestionAnalysis`（该函数依赖 MockExamAnswer 逐题作答数据，整卷模式下无数据来源）
- 移除 `wrong-questions-service.ts` 的 `collectWrongQuestion`、`generateVariationQuestion`、`getVariationQuestions`（自动归集与变式题生成不再适用）

## Capabilities

- **MODIFIED** `wrong-question-collection`：5 个 requirement 全部替换（自动归集→自主录入、多维度分类→标签筛选+掌握度、系统判分重练→自评重练、复习状态→掌握度消减视图、PDF/Word 导出→浏览器打印）
- **MODIFIED** `mock-exam`：移除 `getWrongQuestionAnalysis`（错题分析场景从模拟考试能力中删除）
