# mock-exam Delta

## MODIFIED Requirements

### Requirement: 模拟考试统一为ExamSession
模拟考试 SHALL 不再使用独立的 MockExam 表，统一为 ExamSession(mode='whole_paper' 或 'online')。发布 SHALL 通过 ExamSessionAssignment 显式指定参考学生，学生只能看到被分配给自己的考试。

#### Scenario: 从试卷库创建整卷模拟考试
- **WHEN** 管理员在试卷库中选择整卷并点击「发布考试」
- **THEN** 创建 ExamSession(mode='whole_paper', source='library', paperId=试卷ID, content=null, status='draft')
- **AND** 发布时必须选择班级或学生，系统为每个被分配学生创建 ExamSessionAssignment 记录

#### Scenario: 从题库自动组卷创建在线模拟考试
- **WHEN** 管理员在模拟考试创建中选择「从题库自动组卷」
- **THEN** 创建 ExamSession(mode='online', source='auto', content=题ID数组, status='draft')
- **AND** 发布时必须选择班级或学生

#### Scenario: 发布未选择分配对象被拒绝
- **WHEN** 管理员发布考试时未选择任何班级或学生
- **THEN** 返回 400 错误「请选择参考班级或学生」，考试保持 draft 状态

#### Scenario: 整卷模式学生考试流程
- **WHEN** 学生参加 mode='whole_paper' 的 ExamSession（且被分配）
- **THEN** 学生看到「下载试卷」按钮下载原始文件
- **AND** 线下作答后上传 AnswerSheet（拍照/Word）
- **AND** 不创建 ExamSubmission（只关联 AnswerSheet）

#### Scenario: 在线模式学生考试流程
- **WHEN** 学生参加 mode='online' 的 ExamSession（且被分配）
- **THEN** 学生在线答题，答案保存到 ExamSubmission.answers
- **AND** 提交后 ExamSubmission.status='submitted'

#### Scenario: 模拟考试历史列表
- **WHEN** 学生查看考试历史
- **THEN** 仅返回该学生被分配（存在 ExamSessionAssignment）且 status='published'|'ongoing'|'graded' 的 ExamSession
- **AND** 包含该学生的 ExamSubmission（如有）或 AnswerSheet（如有）的状态和分数

#### Scenario: 学生开始未被分配的考试被拒绝
- **WHEN** 学生对未被分配给自己的考试调用开始考试
- **THEN** 返回 403 错误「未分配该考试」

#### Scenario: 取消发布
- **WHEN** 管理员取消发布 ExamSession
- **THEN** 删除所有关联的 ExamSubmission、AnswerSheet 和 ExamSessionAssignment
- **AND** ExamSession.status='draft'
- **AND** 学生不再可见
