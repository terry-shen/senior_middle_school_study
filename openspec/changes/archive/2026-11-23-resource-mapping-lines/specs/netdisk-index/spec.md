## ADDED Requirements

### Requirement: 教辅资源分类映射

系统 SHALL 允许管理员在资源映射工作台把资源手动归入教辅资源分类，作为与「教材小节」并列的映射目标。

#### Scenario: 单条归入教辅分类

- **WHEN** 管理员为某条资源填写教辅系列与书目并保存
- **THEN** 系统写入 `librarySeries`、`libraryBook`
- **AND** 清空 `sectionId`、`isPinned`，并恢复 `status=active`
- **AND** 该资源不再出现在教材小节资源中

#### Scenario: 批量归入教辅分类

- **WHEN** 管理员勾选多条资源并设置同一个教辅系列与书目
- **THEN** 系统批量写入这两项并清空小节归属
- **AND** 返回实际影响的资源条数

#### Scenario: 改回教材小节

- **WHEN** 管理员把已归教辅分类的资源重新挂到某个教材小节
- **THEN** 系统写入 `sectionId`
- **AND** 清空 `librarySeries`、`libraryBook`
- **AND** `mapSource` 变为 `manual`

#### Scenario: 自动扫描不覆盖手动分类

- **WHEN** 资源已有手动设置的 `librarySeries` 或 `libraryBook`
- **THEN** 后续重新扫描不得覆盖这两个字段
- **AND** 教辅资源查询优先使用手动值

#### Scenario: 左右分栏调整教辅分类

- **WHEN** 管理员打开「教辅资源映射」
- **THEN** 左侧展示学科 → 系列 → 书目的分类树及数量
- **AND** 右侧展示所选分类下的资源列表
- **AND** 勾选资源并填写目标系列/书目后可直接移动到该分类

#### Scenario: 整体移动书目并覆盖学科

- **WHEN** 管理员在左侧选中某学科/系列/书目，并选择目标学科与目标系列/书目
- **THEN** 系统把该分类下全部资源移动到目标分类
- **AND** 写入 `librarySubject`、`librarySeries`、`libraryBook`
- **AND** 后续查询按手动学科与分类展示


