# auto-exam-generation Specification

## Purpose
提供基于知识点覆盖和难度分布的自动出卷功能，允许用户自定义出卷参数，系统智能选题并生成符合要求的考卷，支持导出和进一步编辑。

## Requirements

### Requirement: 自定义出卷参数
系统 SHALL 允许用户设置出卷参数，包括总分、题型分布、知识点覆盖范围、难度比例等。

#### Scenario: 设置出卷参数
- **WHEN** 用户填写出卷参数表单（总分100分、选择题40%、填空题20%、解答题40%）
- **THEN** 系统保存参数并验证其合理性

#### Scenario: 参数冲突检测
- **WHEN** 用户设置的参数存在冲突（如总分与题型分值不匹配）
- **THEN** 系统提示错误并建议修正方案

### Requirement: 智能选题算法
系统 SHALL 基于出卷参数和试题库，使用智能算法选择最符合要求的试题组合。

#### Scenario: 自动生成考卷
- **WHEN** 用户确认出卷参数并点击"生成考卷"
- **THEN** 系统在30秒内生成一份符合要求的考卷，包含题目、分值和参考答案

#### Scenario: 知识点覆盖保证
- **WHEN** 系统生成考卷
- **THEN** 生成的考卷覆盖用户指定的所有知识点，且每个知识点至少有一道相关试题

### Requirement: 考卷预览与编辑
系统 SHALL 提供生成考卷的预览功能，并允许用户进行微调。

#### Scenario: 预览考卷
- **WHEN** 系统生成考卷后
- **THEN** 系统以排版好的格式显示完整考卷，包括题号、题目、分值

#### Scenario: 替换试题
- **WHEN** 用户对某道试题不满意并选择替换
- **THEN** 系统从候选试题库中推荐相似难度和知识点的替代试题

### Requirement: 考卷导出
系统 SHALL 支持将生成的考卷导出为多种格式。

#### Scenario: 导出PDF
- **WHEN** 用户选择"导出为PDF"
- **THEN** 系统生成排版好的PDF文件供下载

#### Scenario: 导出Word
- **WHEN** 用户选择"导出为Word"
- **THEN** 系统生成可编辑的Word文档供下载

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

### Requirement: 出卷学科强制过滤

系统 SHALL 在自动组卷时强制按 subjectId 过滤题目，杜绝跨学科混卷。

#### Scenario: 自动组卷按学科选题

- **WHEN** 管理员调用 POST /api/exams/preview 或 /generate 并指定 subjectId
- **THEN** selectQuestions 仅从 subjectId 匹配的题目池中选题
- **AND** 不返回其他学科的题目

#### Scenario: 未指定学科时兜底

- **WHEN** 自动组卷请求未携带 subjectId
- **THEN** 系统使用当前学科切换器的 subjectId（从请求头或 query 参数读取）
- **AND** 若仍无 subjectId，返回 400 错误"请先选择学科"

#### Scenario: 出卷预览显示学科

- **WHEN** 出卷预览结果返回
- **THEN** 预览数据包含 subjectId 和学科名称
- **AND** 生成的 ExamSession 记录写入 subjectId
