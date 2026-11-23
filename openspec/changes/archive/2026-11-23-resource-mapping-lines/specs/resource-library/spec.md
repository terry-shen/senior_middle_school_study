## ADDED Requirements

### Requirement: 手动教辅分类优先

系统 SHALL 在教辅资源分组时优先使用管理员手动设置的 `librarySeries` 与 `libraryBook`，仅在为空时回退到路径推导。

#### Scenario: 使用手动系列与书目

- **WHEN** 某条资源已有 `librarySeries` 或 `libraryBook`
- **THEN** 学生端教辅资源按手动值分组
- **AND** 不再使用路径关键词覆盖该分组

#### Scenario: 手动分类后立即生效

- **WHEN** 管理员在映射工作台修改某条资源的教辅分类
- **THEN** 该资源在下一次教辅资源查询中按新分类展示
- **AND** 不需要重新扫描或重新索引
