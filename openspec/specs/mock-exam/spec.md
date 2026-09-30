# mock-exam Specification

## Purpose
提供模拟考试功能，支持限时答题、真实考试场景模拟，帮助学生在考前进行实战演练，熟悉考试节奏，发现备考盲点，提升应试能力。

## Requirements

### Requirement: 模拟试卷生成
系统 SHALL 支持生成符合真实考试标准的模拟试卷。

#### Scenario: 按考试标准生成
- **WHEN** 学生或教师创建模拟考试
- **THEN** 系统按照高考或期中期末考试的标准生成试卷（题型分布、分值、时长）

#### Scenario: 指定知识点范围
- **WHEN** 创建模拟考试时指定知识点范围
- **THEN** 系统生成的试卷覆盖指定知识点

#### Scenario: 难度配置
- **WHEN** 创建模拟考试时设置难度比例
- **THEN** 系统按设置生成试卷（如简单30%、中等50%、困难20%）

### Requirement: 限时答题模式
系统 SHALL 支持限时答题，模拟真实考试时间压力。

#### Scenario: 开始模拟考试
- **WHEN** 学生点击"开始模拟考试"
- **THEN** 系统进入答题界面，启动倒计时，隐藏答案和解析

#### Scenario: 倒计时显示
- **WHEN** 模拟考试进行中
- **THEN** 系统在页面顶部显示剩余时间，时间不足时颜色变为红色并提醒

#### Scenario: 时间到自动提交
- **WHEN** 倒计时结束
- **THEN** 系统自动提交试卷并进入批改流程

#### Scenario: 提前提交
- **WHEN** 学生在时间未结束前点击"提交试卷"
- **THEN** 系统提示确认提交，确认后提交试卷

### Requirement: 考试场景模拟
系统 SHALL 模拟真实考试场景，限制非必要功能。

#### Scenario: 隐藏答案解析
- **WHEN** 模拟考试进行中
- **THEN** 系统隐藏所有题目的答案和解析，不允许查看

#### Scenario: 禁止跳题提示
- **WHEN** 模拟考试进行中
- **THEN** 系统显示未作答题目列表，但不强制答题顺序

#### Scenario: 答题卡功能
- **WHEN** 模拟考试进行中
- **THEN** 系统提供答题卡视图，直观显示已答和未答题目

#### Scenario: 题目标记
- **WHEN** 学生标记某道题目为"待检查"
- **THEN** 系统记录标记，方便后续快速定位

### Requirement: 模拟考试批改
系统 SHALL 在模拟考试结束后自动批改并生成考试报告。

#### Scenario: 自动批改
- **WHEN** 模拟考试提交后
- **THEN** 系统自动批改选择题，其他题型使用AI批改或等待人工批改

#### Scenario: 考试报告生成
- **WHEN** 批改完成
- **THEN** 系统生成考试报告，包含总分、各题得分、知识点掌握度变化

#### Scenario: 错题自动归集
- **WHEN** 非整卷模拟考试（questionIds 非空）批改完成
- **THEN** 系统将答错的试题自动归入学生的错题本
- **AND** 整卷模拟考试（questionIds 为空）不触发自动归集，学生通过错题本自主录入

### Requirement: 考试历史记录
系统 SHALL 保存学生的模拟考试历史，支持回顾和分析。

#### Scenario: 查看考试历史
- **WHEN** 学生访问"模拟考试历史"
- **THEN** 系统按时间倒序展示历次模拟考试记录

#### Scenario: 考试详情回顾
- **WHEN** 学生点击某次模拟考试记录
- **THEN** 系统展示该次考试的试卷、作答、批改结果和解析

#### Scenario: 成绩趋势分析
- **WHEN** 学生查看考试历史
- **THEN** 系统展示模拟考试成绩的变化曲线

### Requirement: 考试对标分析
系统 SHALL 将模拟考试结果与标准或平均水平进行对标分析。

#### Scenario: 与满分对标
- **WHEN** 学生查看模拟考试报告
- **THEN** 系统显示与满分的差距，以及各题型的得分率

#### Scenario: 与班级平均对标
- **WHEN** 学生查看模拟考试报告
- **THEN** 系统显示班级平均分和学生在班级中的排名（如果班级功能开启）

#### Scenario: 与历史考试对标
- **WHEN** 学生查看模拟考试报告
- **THEN** 系统与历次模拟考试对比，显示进步或退步

### Requirement: 模拟考试配置
系统 SHALL 支持教师或学生自定义模拟考试参数。

#### Scenario: 自定义考试时长
- **WHEN** 创建模拟考试
- **THEN** 支持设置考试时长（如60分钟、90分钟、120分钟）

#### Scenario: 自定义题型比例
- **WHEN** 创建模拟考试
- **THEN** 支持设置选择题、填空题、解答题的分值比例

#### Scenario: 知识点权重配置
- **WHEN** 创建模拟考试
- **THEN** 支持设置各知识点的出题权重

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
