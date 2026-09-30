# wrong-question-collection Specification Delta

## MODIFIED Requirements

### Requirement: 错题自主录入

系统 SHALL 支持学生通过拍照上传或手动编辑两种方式自主录入错题，不再依赖系统批改后自动归集。

#### Scenario: 拍照录入错题

- **WHEN** 学生选择"拍照录入"并上传错题图片
- **THEN** 系统保存图片，创建错题记录（source=photo），并要求填写元数据（题型/难度/知识点标签/我的答案/正确答案/备注）
- **AND** 题型和难度允许选择"unknown"作为兜底值
- **AND** 知识点标签为自由文本（逗号分隔），不强制必填

#### Scenario: 手动录入错题

- **WHEN** 学生选择"手动录入"
- **THEN** 系统展示 MathLive + textarea 双栏编辑器（左栏 Markdown 源码 + MathLive 公式插入，右栏 MathText 实时预览）
- **AND** 学生可录入题面（支持 LaTeX 公式）、选项（选择题）、我的答案、正确答案、解析
- **AND** 录入完成后创建错题记录（source=manual）

#### Scenario: 拍照题补录题面文本

- **WHEN** 学生对已存在的拍照错题选择"补录题面"
- **THEN** 系统展示与手动录入相同的 MathLive + textarea 编辑器
- **AND** 学生录入的题面文本存储到 content 字段，便于后续搜索
- **AND** 图片仍保留，不删除

#### Scenario: 避免重复录入

- **WHEN** 学生尝试录入与已有错题内容高度相似的错题
- **THEN** 系统提示"可能已存在相似错题"，但允许学生确认后继续录入（不强制阻止）

### Requirement: 错题分类筛选与掌握度概览

系统 SHALL 支持按题型、难度、知识点标签、复习状态、时间多维度筛选错题，并展示按知识点标签分组的掌握度概览。

#### Scenario: 按知识点标签掌握度概览

- **WHEN** 学生查看错题本概览
- **THEN** 系统按知识点标签分组展示，每组显示：标签名、总数、已掌握数、掌握度百分比（已掌握/总数×100%）
- **AND** 未打标签的错题归入"未分类"行
- **AND** 掌握度 < 50% 的知识点高亮为"薄弱"

#### Scenario: 按题型筛选

- **WHEN** 学生按题型筛选（single_choice/multiple_choice/fill/essay/unknown）
- **THEN** 系统返回匹配题型的错题列表

#### Scenario: 按难度筛选

- **WHEN** 学生按难度筛选（easy/medium/hard/very_hard/unknown）
- **THEN** 系统返回匹配难度的错题列表

#### Scenario: 按知识点标签筛选

- **WHEN** 学生按知识点标签筛选（自由文本模糊匹配）
- **THEN** 系统返回标签中包含该关键词的错题列表

#### Scenario: 按复习状态筛选

- **WHEN** 学生按复习状态筛选（new/reviewing/mastered）
- **THEN** 系统返回匹配状态的错题列表

#### Scenario: 按时间排序

- **WHEN** 学生切换"最近录入"或"最近复习"排序
- **THEN** 系统按 createdAt 或 lastReviewAt 倒序展示

### Requirement: 错题重练与自评

系统 SHALL 支持学生对错题进行重新作答，通过遮挡答案、自评对错的方式巩固学习，不再依赖系统自动判分。

#### Scenario: 开始重练

- **WHEN** 学生选择某道错题并点击"重练"
- **THEN** 系统展示题面（拍照题显示图片，手动题渲染 LaTeX），遮挡正确答案和解析（显示为占位符）

#### Scenario: 提交重练答案

- **WHEN** 学生输入新的答案并点击"揭示答案"
- **THEN** 系统展示学生的答案与正确答案对比，并展示解析

#### Scenario: 自评答对

- **WHEN** 学生在揭示答案后点击"我答对了"
- **THEN** 系统将错题 reviewStatus 更新为 mastered，记录 lastReviewAt
- **AND** wrongCount 不变

#### Scenario: 自评答错

- **WHEN** 学生在揭示答案后点击"我答错了"
- **THEN** 系统将 wrongCount + 1，reviewStatus 保持或更新为 reviewing，记录 lastReviewAt

### Requirement: 掌握度消减视图

系统 SHALL 通过视图切换让学生聚焦未掌握错题，同时保留全量历史视图。

#### Scenario: 默认视图（未掌握）

- **WHEN** 学生打开错题本
- **THEN** 系统默认展示 reviewStatus != mastered 的错题列表
- **AND** 顶部显示"未掌握 (N) | 全部 (M)"切换标签

#### Scenario: 全量视图

- **WHEN** 学生切换到"全部"视图
- **THEN** 系统展示所有错题（含已掌握），已掌握的错题卡片显示"已掌握"徽章

#### Scenario: 标记已掌握

- **WHEN** 学生在错题卡片上直接点击"标记已掌握"（不经过重练）
- **THEN** 系统将 reviewStatus 更新为 mastered，记录 lastReviewAt
- **AND** 该错题从默认视图中消失，在全量视图中仍可见

#### Scenario: 取消已掌握

- **WHEN** 学生在全量视图中对已掌握错题点击"取消掌握"
- **THEN** 系统将 reviewStatus 恢复为 reviewing，错题重新出现在默认视图

### Requirement: 错题打印导出

系统 SHALL 支持学生选中错题后通过浏览器打印功能导出错题，不再生成 PDF/Word 文件。

#### Scenario: 选中错题打印

- **WHEN** 学生勾选多道错题并点击"打印"
- **THEN** 系统打开打印预览页面，按选中顺序排版（拍照题渲染图片，手动题渲染 LaTeX 文本）
- **AND** 默认不包含答案与解析，提供"包含答案解析"勾选框

#### Scenario: 打印预览排版

- **WHEN** 系统渲染打印预览
- **THEN** 每道错题包含题号、题型标签、题面（图片或 LaTeX）、选项（如有）
- **AND** 若勾选"包含答案解析"，追加我的答案、正确答案、解析
- **AND** 调用 window.print() 触发浏览器打印对话框
