# mock-exam Specification Delta

## MODIFIED Requirements

### Requirement: 模拟考试批改
系统 SHALL 在模拟考试结束后自动批改并生成考试报告。

#### Scenario: 自动批改
- **WHEN** 模拟考试提交后
- **THEN** 系统自动批改选择题，其他题型使用AI批改或等待人工批改

#### Scenario: 考试报告生成
- **WHEN** 批改完成
- **THEN** 系统生成考试报告，包含总分、各题得分、知识点掌握度变化

#### Scenario: 错题自动归集
- **WHEN** 非整卷模拟考试（questionIds 非空）批改完成
- **THEN** 系统将答错的试题自动归入学生的错题本
- **AND** 整卷模拟考试（questionIds 为空）不触发自动归集，学生通过错题本自主录入

## REMOVED Requirements

### Requirement: 考后错题分析

**Reason**: 整卷模拟考试（paper-library-restructure 之后的主要模式）questionIds 为空数组，不创建 MockExamAnswer 题目级答题记录，`getWrongQuestionAnalysis` 依赖的逐题作答数据不存在。错题本已重构为学生自主录入（wrong-question-restructure），不再依赖模拟考试批改结果触发自动归集。

**Migration**: 学生通过错题本自主录入错题（拍照/手动），错题分析场景由错题本自身的掌握度概览覆盖。
