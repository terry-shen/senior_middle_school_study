## ADDED Requirements

### Requirement: 整卷模拟考试
系统 SHALL 支持基于整卷试卷（ExamPaper purpose=whole_paper）创建整卷模拟考试，MockExam 通过 paperId 关联 ExamPaper，questionIds 为空数组。整卷模拟考试不依赖题库中的独立试题，学生通过下载原始试卷线下作答，考后上传答题纸回收批改。

#### Scenario: 从试卷库创建整卷模拟考试
- **WHEN** 管理员在试卷库列表点击某整卷的"发布考试"按钮
- **THEN** 系统创建 MockExam（paperId 指向 ExamPaper，questionIds=[]，standard=custom，totalScore/duration 取自 ExamPaper 元数据或默认值）
- **AND** 系统自动分配全部学生到该模拟考试
- **AND** MockExam 状态为 published，学生立即可见

#### Scenario: 学生查看整卷模拟考试
- **WHEN** 学生访问模拟考试列表
- **THEN** 系统显示已发布的整卷模拟考试（questionIds 为空），列表项显示"下载试卷"按钮（替代"开始考试"）
- **AND** 学生点击"下载试卷"获取原始试卷文件（PDF/Word）

#### Scenario: 学生上传答题纸
- **WHEN** 学生线下完成整卷模拟考试后回到系统
- **THEN** 学生在模拟考试结果页可上传答题纸（拍照图片或 .doc/.docx 文件）作为作答凭证
- **AND** 上传后系统创建 AnswerSheet（mockExamId 关联，status=submitted）

#### Scenario: 整卷模拟考试不创建题目答题记录
- **WHEN** 学生参加整卷模拟考试（questionIds 为空）
- **THEN** 系统 SHALL NOT 创建 MockExamAnswer 题目级答题记录
- **AND** 学生作答凭证通过 AnswerSheet（整张答题纸）回收，不依赖逐题答案

#### Scenario: 取消整卷模拟考试发布
- **WHEN** 管理员在试卷库列表取消某整卷的发布
- **THEN** 系统删除关联的 MockExam 及其 AnswerSheet 记录，ExamPaper 回到 uploaded 状态
