# learning-incentive Delta

## MODIFIED Requirements

### Requirement: 学习徽章系统
系统 SHALL 提供多种学习徽章，奖励学生的学习成就。徽章条件 SHALL 全部基于现存数据源（练习数、连续打卡、满分试卷、错题掌握）计算，不依赖已删除的掌握度数据。

#### Scenario: 徽章类型
- **WHEN** 系统初始化徽章系统
- **THEN** 系统创建多类徽章：练习徽章（完成指定数量练习，源自 ExamSubmission.answers）、毅力徽章（连续打卡）、满分徽章（考试满分，源自已批改 ExamSubmission）、突破徽章（攻克错题，源自 StudentWrongQuestion 已掌握数）
- **AND** 不再提供依赖掌握度历史的进步徽章（progress_10/30/50 移除，数据源 MasteryHistory 已删除）

#### Scenario: 自动颁发徽章
- **WHEN** 学生达成徽章条件
- **THEN** 系统自动颁发徽章并通知学生

#### Scenario: 徽章展示
- **WHEN** 学生访问个人中心
- **THEN** 系统展示学生已获得的徽章列表，按获得时间排序

#### Scenario: 徽章进度
- **WHEN** 学生查看某类徽章
- **THEN** 系统显示获得该徽章的进度（如"已完成10/20道练习"）

### Requirement: 学习统计与排行
系统 SHALL 提供学习统计功能，支持学生了解自己的学习数据。统计数据 SHALL 全部源自现存数据（练习数、学习时长、正确率、打卡），不包含掌握度变化。

#### Scenario: 个人学习统计
- **WHEN** 学生访问"学习统计"
- **THEN** 系统展示总练习题数、总学习时长、平均正确率（均源自 ExamSubmission.answers 聚合）

#### Scenario: 周期统计报告
- **WHEN** 每周一生成学习周报
- **THEN** 系统推送上周的学习统计报告给学生

#### Scenario: 排行榜（可选）
- **WHEN** 教师开启班级排行榜功能
- **THEN** 系统展示班级学生的练习数量排名（前10名）

#### Scenario: 匿名排行
- **WHEN** 教师选择匿名排行榜
- **THEN** 排行榜中不显示学生姓名，仅显示排名和学习数据

### Requirement: 激励消息推送
系统 SHALL 在关键时刻推送激励消息，增强学生的学习动力。

#### Scenario: 鼓励消息
- **WHEN** 学生答题正确率低于50%
- **THEN** 系统显示鼓励消息（如"继续加油，每道错题都是进步的机会"）

#### Scenario: 达成目标祝贺
- **WHEN** 学生达成个人目标（如某场考试正确率达到80%）
- **THEN** 系统显示祝贺消息和庆祝动画

#### Scenario: 进步提醒
- **WHEN** 学生连续3天未登录
- **THEN** 系统发送学习提醒（如"你已经3天没练习了，快来保持手感"）

### Requirement: 个性化激励
系统 SHALL 基于学生的学习数据提供个性化激励内容。推荐与文案 SHALL 基于练习与正确率数据，不依赖已删除的掌握度数据。

#### Scenario: 推荐学习目标
- **WHEN** 学生设定学习目标
- **THEN** 系统基于当前练习正确率与练习量推荐合理的学习目标

#### Scenario: 激励文案个性化
- **WHEN** 系统推送激励消息
- **THEN** 消息内容根据学生的练习数据动态调整（如"你的练习正确率提升了10%！"）

#### Scenario: 生日特殊祝福
- **WHEN** 学生生日当天登录
- **THEN** 系统显示生日祝福和特殊庆祝动画

## REMOVED Requirements

### Requirement: 进步可视化
**Reason**: 依赖 MasteryHistory 表（掌握度历史）绘制曲线、计算进步高光与薄弱点攻克。MasteryHistory 的唯一写入方（mastery-service）已在 decouple-knowledge-from-questions 变更中删除，本需求永远无法产生真实数据。
**Migration**: 无替代。学生的练习正确率变化可在学习统计中观察。
