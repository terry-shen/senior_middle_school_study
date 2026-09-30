## MODIFIED Requirements

### Requirement: 测验状态管理
系统 SHALL 管理测验的生命周期状态（未开始、进行中、已提交、已批改）。对于整卷考试（questionIds 为空的 Exam），系统不创建答题记录，状态保持 published。

#### Scenario: 测验状态流转
- **WHEN** 学生的测验完成批改
- **THEN** 系统更新状态为"已批改"，学生可查看成绩和解析

#### Scenario: 未完成测验提醒
- **WHEN** 学生有进行中但未提交的测验
- **THEN** 系统在测验列表中显示"继续答题"提示

#### Scenario: 整卷考试列表区分显示
- **WHEN** 学生查看测验列表
- **THEN** questionIds 非空的测验显示"进入考试"按钮并支持在线答题流程；questionIds 为空的整卷显示"下载试卷"按钮且不提供在线答题入口

#### Scenario: 整卷考试不创建答题记录
- **WHEN** 学生下载整卷并完成线下纸笔考试
- **THEN** 系统不创建 ExamRecord 或 AnswerRecord，整卷 Exam 状态保持 published 不流转
