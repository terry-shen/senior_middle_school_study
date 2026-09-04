# answer-grading Specification

## Purpose
提供AI自动批改功能，支持选择题、填空题、解答题的自动评分，为掌握度评估提供准确率数据。

## Requirements

### Requirement: 选择题自动批改
系统 SHALL 自动判断选择题答案的正误并计算得分。

#### Scenario: 选择题批改
- **WHEN** 系统批改选择题答案
- **THEN** 系统将学生答案与标准答案比对，标注对错并计算得分

#### Scenario: 选择题评分规则
- **WHEN** 选择题答对
- **THEN** 系统按试题分值加分；答错则不得分

### Requirement: 填空题AI批改
系统 SHALL 使用大模型批改填空题，识别答案的正确性并评分。

#### Scenario: 填空题批改
- **WHEN** 系统使用AI批改填空题
- **THEN** 系统识别上传图片中的答案，判断是否与标准答案一致或等价

#### Scenario: 答案等价判断
- **WHEN** 学生答案与标准答案表述不同但数学等价
- **THEN** 系统识别为正确答案并得分

#### Scenario: 部分正确评分
- **WHEN** 填空题有多个空，学生部分答对
- **THEN** 系统按答对比例计算部分得分

### Requirement: 解答题AI批改
系统 SHALL 使用大模型批改解答题，分析解题过程并按步骤评分。

#### Scenario: 解答题过程分析
- **WHEN** 系统使用AI批改解答题
- **THEN** 系统识别学生解题过程，分析每一步骤的正确性

#### Scenario: 步骤得分计算
- **WHEN** 解答题有评分标准（各步骤分值）
- **THEN** 系统根据学生解题步骤的完成情况计算得分

#### Scenario: 生成批改评语
- **WHEN** AI完成解答题批改
- **THEN** 系统生成简要评语，指出错误点和改进建议

### Requirement: 批改结果审核
系统 SHALL 支持人工审核AI批改结果，修正错误评分。

#### Scenario: 教师审核批改
- **WHEN** 教师查看AI批改结果
- **THEN** 系统显示AI评分和理由，教师可修改评分

#### Scenario: 批改修正记录
- **WHEN** 教师修改AI批改结果
- **THEN** 系统记录修正前后分数和修正原因

### Requirement: 批改准确性监控
系统 SHALL 监控AI批改的准确性，统计人工修正率。

#### Scenario: 批改准确率统计
- **WHEN** 系统累计足够的批改数据
- **THEN** 系统计算AI批改准确率（无需人工修正的比例）

#### Scenario: 准确率预警
- **WHEN** 某题型AI批改准确率低于阈值
- **THEN** 系统提示需要优化该题型的Prompt模板
