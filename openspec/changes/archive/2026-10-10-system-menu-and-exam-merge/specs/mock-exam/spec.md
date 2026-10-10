# mock-exam Delta

## MODIFIED Requirements

### Requirement: 模拟考试批改

系统 SHALL 在模拟考试结束后进行批改。在线模式由 AI 自动批改选择题和填空题，解答题等待人工审核；整卷模式由老师通过 AnswerSheet Canvas 批注打分。

#### Scenario: 自动批改
- **WHEN** 在线模式 ExamSubmission 提交后
- **THEN** 系统自动批改选择题（精确匹配），填空题使用等价识别
- **AND** 解答题使用 AI 辅助或等待人工批改
- **AND** 批改结果写入 ExamSubmission.answers JSON 的 score 和 feedback 字段

#### Scenario: 考试报告生成
- **WHEN** 批改完成
- **THEN** 系统生成考试报告，包含总分、各题得分
- **AND** 总分写入 ExamSubmission.totalScore
- **AND** status='graded'

#### Scenario: 错题自动归集
- **WHEN** 非整卷模拟考试（ExamSession.mode='online'，questionIds 非空）批改完成
- **AND** 存在答错的题目（AI 判定 isCorrect=false）
- **THEN** 系统提示学生可手动录入错题本
- **AND** 不自动创建 StudentWrongQuestion（学生自主录入）
- **AND** 整卷模拟考试（ExamSession.mode='whole_paper'）不触发自动归集，学生通过错题本自主录入

#### Scenario: 整卷模式批改
- **WHEN** 整卷模式 AnswerSheet 被批改
- **THEN** 老师通过 Canvas 批注 AnswerSheet 并保存得分+评语
- **AND** AnswerSheet.status='graded'
- **AND** 学生可查看批注图片+得分+评语
- **AND** 不触发 AI 批改（无 ExamSubmission）

#### Scenario: 手动调整分数
- **WHEN** 老师在批改界面手动调整某题分数
- **THEN** 更新 ExamSubmission.answers 中对应题目的 score
- **AND** 重新计算 ExamSubmission.totalScore

### Requirement: 模拟考试统一为ExamSession

模拟考试 SHALL 不再使用独立的 MockExam 表，统一为 ExamSession(mode='whole_paper' 或 'online')。整卷模式下学生下载试卷线下作答，上传 AnswerSheet；在线模式下学生在线答题。

#### Scenario: 从试卷库创建整卷模拟考试
- **WHEN** 管理员在试卷库中选择整卷并点击「发布考试」
- **THEN** 创建 ExamSession(mode='whole_paper', source='library', paperId=试卷ID, content=null, status='draft')
- **AND** 发布后 status='published'，学生可见

#### Scenario: 从题库自动组卷创建在线模拟考试
- **WHEN** 管理员在模拟考试创建中选择「从题库自动组卷」
- **THEN** 创建 ExamSession(mode='online', source='auto', content=题ID数组, status='draft')
- **AND** 发布后 status='published'

#### Scenario: 整卷模式学生考试流程
- **WHEN** 学生参加 mode='whole_paper' 的 ExamSession
- **THEN** 学生看到「下载试卷」按钮下载原始文件
- **AND** 线下作答后上传 AnswerSheet（拍照/Word）
- **AND** 不创建 ExamSubmission（只关联 AnswerSheet）

#### Scenario: 在线模式学生考试流程
- **WHEN** 学生参加 mode='online' 的 ExamSession
- **THEN** 学生在线答题，答案保存到 ExamSubmission.answers
- **AND** 提交后 ExamSubmission.status='submitted'

#### Scenario: 模拟考试历史列表
- **WHEN** 学生查看考试历史
- **THEN** 返回所有 status='published'|'ongoing'|'graded' 的 ExamSession
- **AND** 包含该学生的 ExamSubmission（如有）或 AnswerSheet（如有）的状态和分数

#### Scenario: 取消发布
- **WHEN** 管理员取消发布 ExamSession
- **THEN** 删除所有关联的 ExamSubmission 和 AnswerSheet
- **AND** ExamSession.status='draft'
- **AND** 学生不再可见
