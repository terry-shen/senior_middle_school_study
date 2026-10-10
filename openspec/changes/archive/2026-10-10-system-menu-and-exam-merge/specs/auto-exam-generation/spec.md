# auto-exam-generation Delta

## MODIFIED Requirements

### Requirement: 自动组卷生成考试会话

自动出卷 SHALL 不再生成独立的 GeneratedExam 记录，而是直接创建 ExamSession(source='auto', mode='online')。出卷参数包含题型分布、难度分布、分值分布，选题算法从题库中匹配题目填入 ExamSession.content（题 ID 数组 JSON）。

#### Scenario: 从题库自动组卷
- **WHEN** 管理员在考试管理→模拟考试→创建中选择「从题库自动组卷」
- **AND** 填写题型分布（单选/多选/填空/解答）、难度分布、分值分布
- **THEN** 系统从题库选题，创建 ExamSession(source='auto', mode='online', content=题ID数组, status='draft')
- **AND** 返回 ExamSession.id 供预览

#### Scenario: 自动组卷预览
- **WHEN** 管理员请求预览自动组卷结果
- **THEN** 系统返回 ExamSession.content 中的题 ID 对应的题目详情列表
- **AND** 包含题型/难度/分值覆盖统计

#### Scenario: 自动组卷转整卷模式降级
- **WHEN** 题库中某题型题目数量不足
- **THEN** 系统从其他题型补足或提示数量不足
- **AND** 不创建 ExamSession，返回 400 错误说明缺口

#### Scenario: 自动出卷不再独立菜单
- **WHEN** 管理员查找「自动出卷」导航入口
- **THEN** 该入口不存在于导航栏
- **AND** 功能合并到「考试管理→模拟考试→创建」流程中

### Requirement: 出卷模板保存与复用

管理员 SHALL 能保存出卷参数为模板，后续创建 ExamSession 时从模板快速生成。

#### Scenario: 保存模板
- **WHEN** 管理员完成出卷参数配置后点击「保存为模板」
- **THEN** 系统保存模板（题型分布/难度分布/分值分布 JSON）
- **AND** 模板列表可在创建时选择

#### Scenario: 从模板生成
- **WHEN** 管理员选择模板并点击「生成」
- **THEN** 系统用模板参数创建 ExamSession(source='auto', mode='online', status='draft')
- **AND** 返回 ExamSession 供预览和发布
