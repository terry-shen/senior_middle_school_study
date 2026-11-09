## Purpose

以「教材 → 章 → 节」三级结构定义学习主轴，让学生的入口从"一堆试卷"变成"我要学哪一章"，并让网盘资源、试卷、错题都能挂到同一个坐标上。

## ADDED Requirements

### Requirement: 教材版本与册章节的层级结构

系统 SHALL 提供 Textbook（教材册）/ Chapter（章）/ Section（节）三级结构，任意一个 Section 唯一归属于一个 Chapter，任意一个 Chapter 唯一归属于一个 Textbook，任意一个 Textbook 归属一个 Subject。

#### Scenario: 查询完整章节树
- **WHEN** 客户端请求某学科的章节课树
- **THEN** 返回按 `order` 升序排列的三级嵌套结构：册 → 章 → 节
- **AND** 每一级节点包含 `id`、`title`、`order`
- **AND** 空册或空章仍出现在树中，`children` 为空数组

#### Scenario: 章节标题唯一性
- **WHEN** 在同一父节点下创建标题重复的章或节
- **THEN** 系统拒绝创建并返回 409
- **AND** 不同父节点下允许同名

#### Scenario: 排序调整
- **WHEN** 管理员把某章节的 `order` 从 N 调整为 M
- **THEN** 同一父节点下其他节点的 `order` 自动重排为连续整数
- **AND** 章节树查询结果的顺序随之改变

### Requirement: 人教版 A 版数学初始章节数据

系统 SHALL 预置人教版 A 版高中数学的完整章节结构：5 册、19 章、约 90 节，作为系统初始化数据。

#### Scenario: 初始化人教版 A 数学章节
- **WHEN** 系统首次初始化或执行章节种子数据脚本
- **THEN** 创建 5 个 Textbook：必修第一册、必修第二册、选择性必修第一册、选择性必修第二册、选择性必修第三册
- **AND** 每个 Textbook 的 `edition` 为「人教A」、`subjectId` 指向数学学科
- **AND** 必修第一册与必修第二册各 5 章，选择性必修第一册 3 章、第二册 2 章、第三册 3 章
- **AND** 每章下的节数与教材目录一致，合计约 90 节

#### Scenario: 种子数据幂等
- **WHEN** 重复执行章节种子脚本
- **THEN** 已存在的册/章/节按 `(parentId, order)` 匹配并跳过，不产生重复记录

### Requirement: 章节管理

管理员 SHALL 能在管理端新增、重命名、删除、排序教材册、章、节。

#### Scenario: 新增章
- **WHEN** 管理员在某册下新增章并填写标题
- **THEN** 新章追加到该册末尾（`order` = 当前最大值 + 1）
- **AND** 章节树中立即出现该章

#### Scenario: 删除含下级的节点
- **WHEN** 管理员删除仍有子节点的章或册
- **THEN** 系统返回 400 并说明存在子节点
- **AND** 只有显式传入级联参数时才连同下级一起删除

#### Scenario: 删除被引用的节
- **WHEN** 管理员删除已被试卷、视频资源或错题引用的节
- **THEN** 系统返回 409 并返回引用计数
- **AND** 引用方的 `sectionId` 不被置空，除非管理员确认级联解绑

### Requirement: 章节轴为唯一组织骨架

系统 SHALL 以 Section 作为资源组织的最小粒度，试卷、视频资源、错题只能挂在 Section 上，不得直接挂在 Chapter 或 Textbook 上。

#### Scenario: 资源挂载校验
- **WHEN** 客户端尝试把资源挂到章或册的 id 上
- **THEN** 系统返回 400「只能挂载到节」
- **AND** 资源保持未挂载状态

#### Scenario: 未挂载资源可查询
- **WHEN** 管理员筛选未挂载的资源
- **THEN** 系统返回所有 `sectionId` 为空的资源
- **AND** 结果按资源类型分组
