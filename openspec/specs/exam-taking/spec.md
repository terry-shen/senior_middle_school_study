# exam-taking Specification

## Purpose
提供在线测验功能，支持学生在线答题（选择题）和拍照上传答案（其他题型），记录答题过程数据，为AI批改和掌握度评估提供原始数据。

## Requirements

### Requirement: 在线答题（选择题）
系统 SHALL 支持学生在Web界面直接完成选择题的作答。

#### Scenario: 开始答题
- **WHEN** 学生点击"开始测验"按钮
- **THEN** 系统显示试题界面并开始计时

#### Scenario: 提交选择题答案
- **WHEN** 学生选择选项并点击"下一题"或"提交"
- **THEN** 系统记录学生的选择并更新答题进度

#### Scenario: 答题过程保存
- **WHEN** 学生在答题过程中刷新页面或中断
- **THEN** 系统保存当前答题状态，学生可继续答题

### Requirement: 拍照上传答案
系统 SHALL 支持学生使用手机或电脑拍照上传填空题、解答题的答案。

#### Scenario: 拍照上传界面
- **WHEN** 学生进入填空题或解答题作答页面
- **THEN** 系统显示拍照上传按钮和图片预览区域

#### Scenario: 上传答案图片
- **WHEN** 学生拍摄或选择答案图片并上传
- **THEN** 系统保存图片并进行OCR识别，提取答案文本

#### Scenario: 手写答案识别
- **WHEN** 系统完成上传图片的OCR识别
- **THEN** 系统显示识别出的文本，学生可手动修正

### Requirement: 答题时间记录
系统 SHALL 记录学生的答题时间信息（开始时间、提交时间、每题用时）。

#### Scenario: 记录答题用时
- **WHEN** 学生提交答案
- **THEN** 系统记录该题的答题用时

#### Scenario: 查看答题时间统计
- **WHEN** 学生或管理员查看答题记录详情
- **THEN** 系统显示每题的答题用时和总用时

### Requirement: 答题记录存储
系统 SHALL 完整保存学生的答题记录，包括试题、答案、答题时间、答题方式等。

#### Scenario: 保存答题记录
- **WHEN** 学生完成测验并提交
- **THEN** 系统创建完整的答题记录，状态标记为"待批改"

#### Scenario: 查看答题历史
- **WHEN** 学生查看答题历史列表
- **THEN** 系统返回该学生的所有答题记录及批改状态

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

### Requirement: 整卷模拟考试学生端
系统 SHALL 在学生参加整卷模拟考试（MockExam 关联整卷 ExamPaper，questionIds 为空）时提供线下作答模式：下载原始试卷、线下答题、上传答题纸回收。该场景不渲染在线答题界面（无题目可显示），仅提供下载入口和答题纸上传入口。

#### Scenario: 学生下载整卷试卷
- **WHEN** 学生在模拟考试列表点击整卷模拟考试的"下载试卷"按钮
- **THEN** 系统通过 fetch + Authorization 头获取原始试卷文件并触发浏览器下载
- **AND** 下载文件名取自服务端 Content-Disposition（UTF-8 编码），回退为试卷标题 + 扩展名

#### Scenario: 整卷模拟考试页面渲染
- **WHEN** 学生进入整卷模拟考试的考试详情页
- **THEN** 系统显示"此为整卷考试（无在线题目）"提示 + 下载试卷按钮 + 答题纸上传区
- **AND** 系统 SHALL NOT 渲染在线答题界面（题目导航、选项 radio、计时器等）

#### Scenario: 学生上传答题纸
- **WHEN** 学生线下完成作答后在考试详情页上传答题纸
- **THEN** 系统接受图片或 Word 文件上传，创建 AnswerSheet（mockExamId 关联，status=submitted）
- **AND** 若已有答题纸则覆盖旧文件并清理

#### Scenario: 学生查看批改结果
- **WHEN** 老师完成批改后学生再次访问考试详情页
- **THEN** 系统显示答题纸批改结果（批注 overlay + 得分 + 评语），并提供批改版 Word 下载入口（如老师上传）

#### Scenario: 整卷考试不计时
- **WHEN** 学生参加整卷模拟考试
- **THEN** 系统 SHALL NOT 启动倒计时（整卷考试为线下作答，不受在线时间约束）
- **AND** MockExam.duration 仅作为建议考试时长显示，不强制提交
