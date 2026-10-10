# answer-grading Specification

## Purpose
提供AI自动批改功能，支持选择题、填空题、解答题的自动评分，为掌握度评估提供准确率数据。

## Requirements

### Requirement: 选择题自动批改
系统 SHALL 自动判断选择题答案的正误并计算得分。

#### Scenario: 选择题批改
- **WHEN** 系统批改选择题答案
- **THEN** 系统将学生答案与标准答案比对，标注对错并计算得分

#### Scenario: 选择题评分规则
- **WHEN** 选择题答对
- **THEN** 系统按试题分值加分；答错则不得分

### Requirement: 填空题AI批改
系统 SHALL 使用大模型批改填空题，识别答案的正确性并评分。

#### Scenario: 填空题批改
- **WHEN** 系统使用AI批改填空题
- **THEN** 系统识别上传图片中的答案，判断是否与标准答案一致或等价

#### Scenario: 答案等价判断
- **WHEN** 学生答案与标准答案表述不同但数学等价
- **THEN** 系统识别为正确答案并得分

#### Scenario: 部分正确评分
- **WHEN** 填空题有多个空，学生部分答对
- **THEN** 系统按答对比例计算部分得分

### Requirement: 解答题AI批改
系统 SHALL 使用大模型批改解答题，分析解题过程并按步骤评分。

#### Scenario: 解答题过程分析
- **WHEN** 系统使用AI批改解答题
- **THEN** 系统识别学生解题过程，分析每一步骤的正确性

#### Scenario: 步骤得分计算
- **WHEN** 解答题有评分标准（各步骤分值）
- **THEN** 系统根据学生解题步骤的完成情况计算得分

#### Scenario: 生成批改评语
- **WHEN** AI完成解答题批改
- **THEN** 系统生成简要评语，指出错误点和改进建议

### Requirement: 批改结果审核
系统 SHALL 支持人工审核AI批改结果，修正错误评分。

#### Scenario: 教师审核批改
- **WHEN** 教师查看AI批改结果
- **THEN** 系统显示AI评分和理由，教师可修改评分

#### Scenario: 批改修正记录
- **WHEN** 教师修改AI批改结果
- **THEN** 系统记录修正前后分数和修正原因

### Requirement: 批改准确性监控
系统 SHALL 监控AI批改的准确性，统计人工修正率。

#### Scenario: 批改准确率统计
- **WHEN** 系统累计足够的批改数据
- **THEN** 系统计算AI批改准确率（无需人工修正的比例）

#### Scenario: 准确率预警
- **WHEN** 某题型AI批改准确率低于阈值
- **THEN** 系统提示需要优化该题型的Prompt模板

### Requirement: AI批改适配ExamSubmission
AI 批改 SHALL 从 ExamSubmission.answers JSON 中读取学生答案进行判分，不再从独立的 AnswerRecord 表查询。批改结果写回 ExamSubmission.answers 的 score 和 feedback 字段。
#### Scenario: 选择题自动判分
- **WHEN** 在线模式 ExamSubmission 提交
- **AND** 题目 questionType 为 single_choice 或 multiple_choice
- **THEN** 系统从 ExamSubmission.answers 读取学生答案
- **AND** 与 Question.answer 精确匹配（多选排序后比较）
- **AND** 写回 score 到 answers JSON 对应项
#### Scenario: 填空题等价识别
- **WHEN** 题目 questionType 为 fill
- **THEN** 系统对答案进行等价识别（全角→半角、去标点、数值比较）
- **AND** 写回 score 和 feedback
#### Scenario: 解答题等待人工批改
- **WHEN** 题目 questionType 为 essay
- **THEN** AI 可选生成参考评分建议
- **AND** 等待老师在批改界面确认最终分数
#### Scenario: 批改完成状态
- **WHEN** 所有题目批改完成（自动+人工）
- **THEN** ExamSubmission.status='graded'
- **AND** 计算总分写入 ExamSubmission.totalScore
#### Scenario: 整卷模式无AI批改
- **WHEN** ExamSession.mode='whole_paper'
- **THEN** 不触发 AI 批改（无 ExamSubmission）
- **AND** 老师通过 AnswerSheet Canvas 手动批注打分
#### Scenario: 手动调整分数
- **WHEN** 老师在批改界面手动调整某题分数
- **THEN** 更新 ExamSubmission.answers 中对应题目的 score
- **AND** 重新计算 ExamSubmission.totalScore

### Requirement: 批改统计
系统 SHALL 提供基于 ExamSubmission 的批改统计，包括总答题数、已批改数、待批改数、平均分、按题型分布。
#### Scenario: 批改统计查询
- **WHEN** 老师查看批改统计
- **THEN** 返回 {totalRecords, gradedRecords, pendingRecords, averageScore, byQuestionType}
- **AND** 数据来源为 ExamSubmission 表（不再查 ExamRecord）
#### Scenario: 按考试会话查询
- **WHEN** 老师查看某个 ExamSession 的批改统计
- **THEN** 返回该考试下所有学生的 ExamSubmission 批改状态
- **AND** 包含整卷模式的 AnswerSheet 批改状态
