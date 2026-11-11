# chapter-learning Specification

## Purpose
为学生提供以教材章节为导航入口的学习界面：从「我要学哪一章」出发，在同一页内看视频、读讲义、做练习、做试卷，学完的错题回到同一节。

## Requirements

### Requirement: 章节详情页

系统 SHALL 为每个 Section 提供详情页，聚合该节的精选视频、讲义、练习资源。

#### Scenario: 精选资源分组展示
- **WHEN** 学生打开某节详情页
- **THEN** 页面按视频 / 讲义 / 练习 / 试卷资料四组展示已确认的精选资源
- **AND** 每组最多展示 5 条，超出部分折叠在「更多资源」

#### Scenario: 空章节
- **WHEN** 该节没有任何已确认精选资源
- **THEN** 页面自动展开「更多资源」并给出「本节资源正在整理中」提示
- **AND** 不再展示试卷或错题入口

#### Scenario: 展开更多资源
- **WHEN** 学生点击「更多资源」
- **THEN** 展开该节全部学生侧可见资源并按类型分段
- **AND** 学生可直接点击任意资源打开阅读器

### Requirement: 统一资源阅读器

系统 SHALL 在同一阅读器内按资源类型提供不同的呈现方式，不得要求用户离开系统查看 PDF 与图片。

#### Scenario: 打开 PDF 资源
- **WHEN** 学生点击 PDF 类型的讲义/试卷
- **THEN** 阅读器以 PDF 视图加载内容，支持翻页与缩放
- **AND** 内容通过网盘流式接口读取，支持分段加载

#### Scenario: 打开图片资源
- **WHEN** 学生点击图片类型资源
- **THEN** 阅读器以图片视图显示，支持上一张/下一张切换
- **AND** 多页图片资源按页展示页码

#### Scenario: 打开视频资源
- **WHEN** 学生点击视频资源
- **THEN** 阅读器内嵌播放器播放该视频，支持暂停、进度拖动
- **AND** 播放进度通过流式接口按需拉取，不预下载整段视频

#### Scenario: 打开 Word / PPT 资源
- **WHEN** 学生点击 doc/docx/ppt/pptx 类型资源
- **THEN** 阅读器不尝试内嵌渲染
- **AND** 提供「下载文件」按钮与「该格式需下载后查看」的提示

#### Scenario: 资源不可达
- **WHEN** 网盘访问失败或文件已被删除
- **THEN** 阅读器显示明确错误信息与「返回章节」按钮
- **AND** 不显示空白页面

### Requirement: 学习进度记录

系统 SHALL 记录学生最近打开的章节与资源，用于「继续学习」与章节进度展示。

#### Scenario: 打开资源即记录进度
- **WHEN** 学生打开某节的任意资源
- **THEN** 系统更新该学生的「最近学习节」为该节
- **AND** 记录最近访问时间

#### Scenario: 章节完成度展示
- **WHEN** 学生在章节详情页查看某节
- **THEN** 显示该节已访问资源数 / 总可见资源数
- **AND** 该比例仅作参考，不参与成绩计算

#### Scenario: 进度不跨账号共享
- **WHEN** 学生 A 打开某节资源
- **THEN** 学生 B 的「继续学习」不受影响
- **AND** 进度记录按学生隔离

### Requirement: 学科学习导航

章节学习页 SHALL 在顶部以学科 Tab 条列出全部启用学科，并按学科是否有教材小节区分「可学习」与「待建设」。

#### Scenario: 列出全部学科

- **WHEN** 用户进入 /learning
- **THEN** 顶部显示学科 Tab 条，按 Subject.order 排列，每项显示学科图标、名称与该学科小节数
- **AND** 数据来自 GET /api/learning/subjects，返回 `{id, code, name, icon, color, sectionCount}`

#### Scenario: 可学习学科

- **WHEN** 某学科 sectionCount > 0
- **THEN** 该 Tab 使用学科自身颜色（Subject.color）着色且可点击
- **AND** 点击后加载该学科的视频主线课程与关联教材小节

#### Scenario: 待建设学科

- **WHEN** 某学科 sectionCount = 0
- **THEN** 该 Tab 灰显并标注「待建设」，不可点击
- **AND** 不发起该学科的课程请求

#### Scenario: 记住上次选择

- **WHEN** 用户选择某学科 Tab
- **THEN** 选择写入 localStorage（`selectedSubjectId`）
- **AND** 下次进入页面自动恢复；无记录时默认选中第一个有教材小节的学科（数学）

### Requirement: 学习工作台

学生首页 SHALL 是以学习为导向的工作台，展示继续学习、我的学科与最近打开。

#### Scenario: 继续学习

- **WHEN** 学生曾打开过某节资源
- **THEN** 顶部显示「继续学习：<册> <章> <节>」与「继续」按钮
- **AND** 点击直接进入该节详情页

#### Scenario: 无学习记录

- **WHEN** 学生从未打开过任何章节
- **THEN** 显示「从章节学习开始」引导入口
- **AND** 不显示空的继续学习卡片

#### Scenario: 我的学科

- **WHEN** 学生进入工作台
- **THEN** 显示有教材小节的学科卡片（数学 / 物理 / 化学 / 生物），每张显示学科名、小节总数
- **AND** 点击卡片进入 /learning 并选中该学科

#### Scenario: 最近打开

- **WHEN** 学生打开过资源
- **THEN** 显示最近 5 条打开记录（资源名 + 所属小节 + 时间）
- **AND** 点击可回到对应小节

### Requirement: 学生端导航

学生侧边栏 SHALL 仅保留学习相关内容：章节学习、学习资源、AI 助理。

#### Scenario: 学生侧边栏内容
- **WHEN** 学生登录后查看侧边栏
- **THEN** 显示「工作台」「章节学习」「学习资源」「AI 助理」
- **AND** 不显示试卷库、题库管理、题目列表、模拟考试、答题纸阅卷、错题本、学习激励、模型管理

#### Scenario: 学生直接访问已下线路径
- **WHEN** 学生直接输入 /paper-library、/question-bank、/mock-exams、/answer-sheets、/wrong-questions、/incentive 等已下线路径
- **THEN** 系统重定向到 /learning
- **AND** 不请求任何已下线接口
