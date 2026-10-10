# answer-grading Delta

## MODIFIED Requirements

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
