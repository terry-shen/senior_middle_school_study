## MODIFIED Requirements

### Requirement: 试题批量操作
系统 SHALL 支持试题的批量导入、导出、单题删除、批量删除和属性修改，并在删除前清理关联数据、阻断被进行中测验引用的题目。

#### Scenario: 批量修改难度
- **WHEN** 用户选择多道试题并批量修改难度等级
- **THEN** 系统更新所有选中试题的难度属性

#### Scenario: 批量导出试题
- **WHEN** 用户选择多道试题并点击导出
- **THEN** 系统生成包含选中试题的文件（Word/PDF）

#### Scenario: 单题删除
- **WHEN** 管理员在某道试题上点击删除并确认
- **THEN** 系统校验该题目未被任何"进行中"的在线测验或模拟考试引用
- **AND** 系统以事务方式清理该题目的关联数据（学生答案、答题记录、错题本、变式题、AI审核记录、难度调整记录、模拟考试答题）
- **AND** 系统删除题目本身并返回成功

#### Scenario: 批量删除
- **WHEN** 管理员勾选多道试题并点击"批量删除"并确认
- **THEN** 系统校验所有选中题目均未被"进行中"的测验引用
- **AND** 系统以事务方式清理每道题目的关联数据后删除题目
- **AND** 系统返回实际删除题数

#### Scenario: 被进行中测验引用时阻断删除
- **WHEN** 管理员尝试删除一道或多道被"进行中"在线测验/模拟考试引用的题目
- **THEN** 系统返回错误并附上被阻断的题目列表及引用该题目的测验名称
- **AND** 系统不删除任何题目（整体回滚）

#### Scenario: 关联数据级联清理
- **WHEN** 系统删除一道题目
- **THEN** 系统同步删除该题目关联的 StudentAnswer、AnswerRecord、WrongQuestion、VariationQuestion、AIContentReview、DifficultyAdjustment、MockExamAnswer 记录
- **AND** 不留下任何引用已删除题目的孤儿记录
