# subject-management Specification

## Purpose
提供可管理的学科字典表，支持按学科维度组织试卷、题目、考试、错题、知识点等业务数据，并通过全局学科切换器实现学科筛选。

## Requirements

### Requirement: 学科字典管理

系统 SHALL 提供可管理的学科字典表（Subject），支持新增、编辑、排序、启停学科。预置 12 个学科：语文（chinese）、数学（math）、英语（english）、物理（physics）、化学（chemistry）、生物（biology）、政治（politics）、历史（history）、地理（geography）、文综（liberal_arts）、理综（science）。

#### Scenario: 预置学科初始化

- **WHEN** 系统首次启动或执行种子脚本
- **THEN** 创建 12 个预置学科记录，每条含 code/name/icon/color/order/isActive 字段
- **AND** 数学（math）的 order=2，isActive=true

#### Scenario: 查询学科列表

- **WHEN** 前端调用 GET /api/subjects
- **THEN** 返回所有学科（按 order 排序），每条含 id/code/name/icon/color/order/isActive
- **AND** 无需认证（公开端点，供学科切换器使用）

#### Scenario: 新增学科

- **WHEN** 管理员调用 POST /api/subjects（requireAdmin）并提供 code/name/icon/color/order
- **THEN** 系统创建新学科记录，isActive 默认 true
- **AND** code 唯一，重复返回 400

#### Scenario: 编辑学科

- **WHEN** 管理员调用 PUT /api/subjects/:id（requireAdmin）
- **THEN** 系统更新学科的 name/icon/color/order/isActive 字段
- **AND** code 不可修改（已关联数据的标识符）

#### Scenario: 启停学科

- **WHEN** 管理员将某学科 isActive 设为 false
- **THEN** 该学科不出现在学科切换器中
- **AND** 已关联该学科的业务数据仍保留 subjectId，不受影响

#### Scenario: 删除学科

- **WHEN** 管理员调用 DELETE /api/subjects/:id（requireAdmin）
- **THEN** 若该学科有关联的业务数据（Question/ExamPaper 等），返回 409 拒绝删除
- **AND** 若无关联数据，删除成功
