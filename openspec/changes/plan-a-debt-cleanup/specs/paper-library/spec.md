# paper-library Delta

## MODIFIED Requirements

### Requirement: 试卷库一键发布为模拟考试
系统 SHALL 在试卷库列表行内提供"发布考试"按钮，点击后填写发布信息并选择参考班级或学生，创建 ExamSession（关联 paperId）并按选择创建 ExamSessionAssignment，发布后被分配学生可在模拟考试页面看到该考试并下载试卷线下作答。

#### Scenario: 发布整卷模拟考试
- **WHEN** 管理员在试卷库列表点击某张整卷的"发布考试"按钮
- **THEN** 系统弹出发布对话框，含总分、时长、起止时间和班级/学生选择
- **AND** 管理员必须选择至少一个班级或若干学生，否则发布被拒绝（400）
- **AND** 系统创建 ExamSession（paperId 指向该 ExamPaper，content 为空数组，status='draft'）
- **AND** 系统为每个被选择的学生创建 ExamSessionAssignment 记录
- **AND** 发布后 ExamSession 状态为 published，仅被分配学生可见

#### Scenario: 发布时元数据传递
- **WHEN** 管理员发布整卷模拟考试
- **THEN** ExamSession.totalScore 取自 ExamPaper.totalScore，duration 取自 ExamPaper.duration
- **AND** 若试卷缺元数据则使用默认值（totalScore=100，duration=120）
- **AND** 学科（subjectId）继承自试卷

#### Scenario: 取消发布
- **WHEN** 管理员在试卷库列表点击已发布卷的"取消发布"
- **THEN** 系统删除关联的 ExamSession（含 ExamSubmission、AnswerSheet、ExamSessionAssignment）
- **AND** 试卷回到可重新发布状态
