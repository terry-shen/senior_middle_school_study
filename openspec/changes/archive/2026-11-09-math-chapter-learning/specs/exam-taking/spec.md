## ADDED Requirements

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

## REMOVED Requirements

### Requirement: 在线答题（选择题）
**Reason**: 系统改为整卷线下作答 + 答题纸批改，逐题在线作答不再提供。
**Migration**: 使用「我的试卷」中整卷考试的下载/上传答题纸流程；历史在线测验作答数据保留在库中，不再提供入口。

### Requirement: 拍照上传答案
**Reason**: 逐题在线作答移除，题目级图片上传随之失去使用场景。
**Migration**: 学生改为上传整份答题纸（拍照或 Word），复用既有答题纸上传能力。

### Requirement: 答题时间记录
**Reason**: 无逐题作答后不再有题目级耗时记录。
**Migration**: 整卷考试的作答时长由线下考试时间与实际批改记录体现，不做逐题计时。

### Requirement: 答题记录存储
**Reason**: ExamSubmission 的逐题 answers JSON 在整卷模式下不再创建。
**Migration**: 整卷考试的学习结果由 AnswerSheet 承载（作答文件 + 批注 + 得分）。

### Requirement: 在线测验统一为ExamSession
**Reason**: 该要求描述的是在线逐题模式（mode='online'）的统一方案，v2 下掉在线测验后整体失效。
**Migration**: 由新增的「整卷考试统一为 ExamSession」要求取代，ExamSession 结构保留但只使用 whole_paper 模式。
