# exam-taking Delta

## MODIFIED Requirements

### Requirement: 在线测验统一为ExamSession
在线测验 SHALL 不再使用独立的 Exam 表，统一为 ExamSession(mode='online')。学生答题记录统一为 ExamSubmission(answers JSON)。发布 SHALL 通过 ExamSessionAssignment 显式指定参考学生；学生只能看到并参加被分配给自己的测验。

#### Scenario: 创建在线测验ExamSession
- **WHEN** 管理员创建在线测验（手动选题或自动组卷）
- **THEN** 创建 ExamSession(mode='online', source='manual'|'auto', content=题ID数组, status='draft')

#### Scenario: 发布在线测验须选择分配对象
- **WHEN** 管理员发布在线测验
- **THEN** 必须选择班级或学生；系统为每个被分配学生创建 ExamSessionAssignment 记录
- **AND** 未选择时返回 400，测验保持 draft
- **AND** 发布后仅被分配学生可见

#### Scenario: 学生开始在线测验
- **WHEN** 学生（被分配）点击「开始考试」
- **THEN** 创建/获取 ExamSubmission(examSessionId, studentId, mode='online', status='pending')
- **AND** 学生可逐题答题，答案实时保存到 ExamSubmission.answers JSON

#### Scenario: 学生开始未被分配的测验被拒绝
- **WHEN** 学生对未被分配的在线测验调用开始
- **THEN** 返回 403「未分配该考试」

#### Scenario: ExamSubmission.answers 数据结构
- **WHEN** 学生保存某题答案
- **THEN** ExamSubmission.answers JSON 数组追加/更新 {questionId, answer, timeSpent}
- **AND** 不再创建独立的 AnswerRecord 记录

#### Scenario: 提交在线测验
- **WHEN** 学生点击「提交试卷」
- **THEN** ExamSubmission.status='submitted'
- **AND** 系统对选择题自动判分，填空题/解答题等待人工批改

#### Scenario: 整卷模式不创建ExamSubmission
- **WHEN** ExamSession.mode='whole_paper'
- **THEN** 学生考试时不创建 ExamSubmission
- **AND** 只关联 AnswerSheet（学生上传的答题纸照片/Word）

#### Scenario: ExamSession状态流转
- **WHEN** 考试创建时 status='draft'
- **AND** 发布时 status='published'
- **AND** 学生开始答题时 status='ongoing'
- **AND** 所有学生提交截止后 status='graded'
- **AND** 4 态统一（draft/published/ongoing/graded）

#### Scenario: 学生侧菜单整合
- **WHEN** 学生查看导航栏
- **THEN** 「在线测验」入口合并到「模拟考试」主入口中
- **AND** 学生看到的考试列表统一来自 ExamSession（含 online 和 whole_paper 两种模式），且仅含被分配给自己的考试
