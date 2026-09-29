## ADDED Requirements

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
