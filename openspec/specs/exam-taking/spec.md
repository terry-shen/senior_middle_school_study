# exam-taking Specification

## Purpose
提供在线测验功能，支持学生在线答题（选择题）和拍照上传答案（其他题型），记录答题过程数据，为AI批改和掌握度评估提供原始数据。

## Requirements

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

### Requirement: 学生端学科筛选

系统 SHALL 在学生端支持按学科筛选考试和错题。

#### Scenario: 学生按学科查看考试

- **WHEN** 学生在学科切换器中选择某学科
- **THEN** 考试列表刷新为该学科的考试
- **AND** 其他学科的考试不显示

#### Scenario: 学生学科切换器默认行为

- **WHEN** 学生首次登录
- **THEN** 学科切换器默认选中「数学」（或上次选择的学科，从 localStorage 恢复）
- **AND** 学生端切换器不显示「全部学科」选项（仅管理员可看全部）

### Requirement: 整卷考试统一为 ExamSession

v2 的考试 SHALL 只有一种形态：整卷考试（ExamSession.mode='whole_paper'），学生下载试卷后线下作答，再上传答题纸。在线逐题作答路径 SHALL 不再提供。

#### Scenario: 从试卷库发布整卷考试
- **WHEN** 管理员在试卷库选中一份整卷试卷并点击「发布考试」
- **THEN** 创建 ExamSession(mode='whole_paper', source='library', paperId=试卷 id, status='draft')
- **AND** 继续发布时 status='published'，并为选定班级/学生写入 ExamSessionAssignment

#### Scenario: 学生只能看到被分配的整卷考试
- **WHEN** 学生请求考试列表
- **THEN** 只返回 status in (published, ongoing, graded) 且存在本人 ExamSessionAssignment 的整卷考试
- **AND** 不返回在线模式考试

#### Scenario: 学生打开整卷考试
- **WHEN** 学生点击某场整卷考试
- **THEN** 页面提供「下载试卷」与「上传答题纸」两个操作
- **AND** 不进入逐题答题界面，不显示答题倒数计时

#### Scenario: 未分配学生访问
- **WHEN** 学生访问未被分配的整卷考试
- **THEN** 返回 403 并提示「未分配该考试」

#### Scenario: 整卷考试不创建逐题提交记录
- **WHEN** 学生参加整卷考试
- **THEN** 系统不创建 ExamSubmission
- **AND** 只创建/更新 AnswerSheet（学生上传的答题纸图片或 Word）

#### Scenario: 整卷考试状态流转
- **WHEN** 考试创建时 status='draft'
- **AND** 发布时 status='published'
- **AND** 学生首次打开时 status='ongoing'
- **AND** 教师完成批改后 status='graded'

#### Scenario: 取消发布
- **WHEN** 管理员取消发布某整卷考试
- **THEN** status 回到 'draft'
- **AND** 相关 ExamSessionAssignment 删除，学生端不再可见
- **AND** 已上传的答题纸保留，不随取消发布删除

### Requirement: 整卷考试章节过滤

系统 SHALL 支持整卷考试按章节（Section）归属与筛选，让学生从章节入口直接进入该节的试卷。

#### Scenario: 发布时指定章节
- **WHEN** 管理员发布整卷考试并选择所属章节
- **THEN** 考试从关联试卷继承或显式写入 `sectionId`
- **AND** 学生端「我的试卷」按章节分组展示

#### Scenario: 从章节进入试卷
- **WHEN** 学生位于某节详情页并点击该节的试卷
- **THEN** 直接进入该场整卷考试的详情（下载试卷 / 上传答题纸）
- **AND** 不需要先在全局考试列表中查找
