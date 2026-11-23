# netdisk-index Specification

## Purpose
为网盘里的教辅与视频建立可检索、可分类、可映射到教材章节的本地索引层，让系统能把「出版社目录」投影成「学习路径」，全程不下载、不复制源文件。

## Requirements

### Requirement: 网盘资源索引记录

系统 SHALL 为网盘 `/apps/高中学习系统` 目录下的每个文件建立一条索引记录（NetdiskAsset），记录文件身份、路径、名称与大小，但 SHALL NOT 下载或复制文件内容到本地。

#### Scenario: 扫描建立索引
- **WHEN** 管理员对某目录触发索引扫描
- **THEN** 系统递归遍历该目录，为每个文件创建或更新一条 NetdiskAsset
- **AND** 记录 `fsId`、`path`、`name`、`ext`、`size`、`mtime`
- **AND** 不向本地磁盘写入任何文件内容

#### Scenario: 索引以路径去重
- **WHEN** 同名文件出现在不同目录
- **THEN** 系统按完整 `path` 分别建立索引记录
- **AND** 同一 `path` 重复扫描只更新 `size` 与 `mtime`，不新增记录

#### Scenario: 文件在网盘侧被删除或移动
- **WHEN** 重新扫描时某条索引记录的 `path` 已不存在
- **THEN** 该记录状态标记为 `missing`
- **AND** 默认不出现在学生端资源列表中

#### Scenario: 索引扫描断点续扫
- **WHEN** 扫描过程因网络限流或进程中断
- **THEN** 系统保留已完成部分的索引记录
- **AND** 再次触发扫描时从上次未完成的目录继续，不重复全量遍历

### Requirement: 资源自动分类标注

系统 SHALL 在建立索引时根据扩展名与路径/文件名关键词自动标注 `assetKind`、`audience`、`year`、`region`、`series`，并允许管理员人工修正。

#### Scenario: 按扩展名判定资源类型
- **WHEN** 文件扩展名为 mp4/mkv/mov/avi/flv/ts/mp3
- **THEN** `assetKind` 标注为 `video` 或 `audio`
- **AND** docx/pdf/pptx 分别结合文件名关键词判定为 `lecture`、`ppt`、`answer`、`practice`、`exam` 或 `plan`

#### Scenario: 教师侧与学生侧区分
- **WHEN** 路径或文件名包含「教师用书」「教师配套」「答案解析」「课件」等关键词
- **THEN** `audience` 标注为 `teacher`
- **AND** 学生会用资料标注为 `student`，两者兼有的标注为 `both`

#### Scenario: 年份、地区、系列提取
- **WHEN** 路径或文件名中含 4 位年份、省份名或出版社系列名（步步高 / 高中必刷题 / 一数 / 全品 / 赢在微点 / 实验班 / 金考卷 / MST / 五三 等）
- **THEN** 对应写入 `year`、`region`、`series`
- **AND** 未识别出的字段留空，不写入默认值

#### Scenario: 广告与垃圾文件标记
- **WHEN** 文件名命中广告关键词（如「微信扫码」「免费领取」「在线打印店」）或扩展名为 exe/ttf/ini
- **THEN** `assetKind` 标注为 `junk`
- **AND** 该记录默认不进入任何学生视图

#### Scenario: 人工修正分类
- **WHEN** 管理员修改某条记录的 `assetKind` 或 `audience`
- **THEN** 记录 `mapSource` 变为 `manual`
- **AND** 后续自动扫描不再覆盖该字段

### Requirement: 自动章节映射与人工确认

系统 SHALL 根据文件名与路径中的章节、知识点关键词自动推断资源所属 Section，自动结果必须经人工确认后才对学生的默认视图生效。

#### Scenario: 自动映射
- **WHEN** 资源名称或路径中出现与某节标题匹配的关键词（如「集合的概念」「函数的单调性」）
- **THEN** 系统写入该资源的 `sectionId`
- **AND** 标记 `mapSource='auto'`、`mapConfirmed=false`

#### Scenario: 自动结果需人工确认
- **WHEN** 学生浏览某章节的默认资源列表
- **THEN** 只包含 `mapConfirmed=true` 的资源
- **AND** 未确认的自动映射资源仅出现在管理端映射工作台的待确认列表

#### Scenario: 批量确认映射
- **WHEN** 管理员在映射工作台勾选多条资源并点击确认
- **THEN** 这些记录的 `mapConfirmed` 置为 true
- **AND** 立即出现在对应章节的学生视图中

#### Scenario: 关键字歧义
- **WHEN** 同一资源可匹配多个章节关键词
- **THEN** 系统只写入匹配度最高的一个 `sectionId`
- **AND** 保留候选章节列表供管理员切换

#### Scenario: 无法映射
- **WHEN** 资源未匹配到任何章节关键词
- **THEN** `sectionId` 保持为空
- **AND** 进入「未映射」清单，按 `series` 与 `assetKind` 分组展示

### Requirement: 资源精选、归档与屏蔽

系统 SHALL 支持对资源设置 `isPinned`（精选）、`status=archive`（归档旧版）与 `status=ignored`（屏蔽），以收敛每节平均 46 个资源带来的噪音；批量操作 SHALL 支持按勾选条目或按目录两种范围生效。

#### Scenario: 每节精选上限
- **WHEN** 管理员在某节设置精选资源
- **THEN** 允许设置 3-5 条为 `isPinned=true`
- **AND** 超过 5 条时返回 400 提示先取消其他精选

#### Scenario: 旧版归档
- **WHEN** 管理员把路径含 2024/2025 版本的资源批量标记为归档
- **THEN** 这些资源不在学生端默认列表中出现
- **AND** 仍可通过管理端筛选 `status=archive` 查看

#### Scenario: 屏蔽后不可见
- **WHEN** 资源 `status=ignored`
- **THEN** 任何学生端接口都不返回该资源
- **AND** 教师端需显式筛选才能看到

#### Scenario: 按目录批量归档
- **WHEN** 管理员对一个目录执行归档
- **THEN** 该目录及其子目录下的全部 active 资源状态变为 `archive`
- **AND** 返回受影响条数，且不存在的路径返回 400

#### Scenario: 按目录批量屏蔽
- **WHEN** 管理员对一个目录执行屏蔽
- **THEN** 该目录及其子目录下的全部资源状态变为 `ignored`
- **AND** 后续自动映射不再处理这些资源

### Requirement: 按章节查询章节资源

系统 SHALL 提供按 Section 查询资源的接口，区分学生视图与管理视图。

#### Scenario: 学生查看章节精选资源
- **WHEN** 学生请求某节的资源
- **THEN** 返回 `isPinned=true` 且 `status=active` 且 `audience in (student, both)` 且 `mapConfirmed=true` 的资源
- **AND** 按 `assetKind` 分组（视频 / 讲义 / 练习 / 试卷）

#### Scenario: 学生展开更多资源
- **WHEN** 学生在章节详情页点击「更多资源」
- **THEN** 返回同节全部学生侧可见资源（不限于精选）
- **AND** 结果分页，默认每页 20 条

#### Scenario: 管理视图返回全量
- **WHEN** 管理员请求某节资源
- **THEN** 返回该节全部资源，含教师侧、归档与未确认映射
- **AND** 每条记录附带分类与映射状态字段

### Requirement: 资源索引与网盘访问解耦

索引记录 SHALL NOT 成为网盘文件的可访问性前置条件；学生打开资源时仍通过网盘实时访问，索引仅提供检索与组织能力。

#### Scenario: 索引存在但网盘不可达
- **WHEN** 学生点击某视频资源而网盘接口暂时不可用
- **THEN** 系统返回明确的网盘访问错误提示
- **AND** 不因索引存在而返回伪造的成功响应

#### Scenario: 索引缺失但文件存在
- **WHEN** 网盘目录中新增文件尚未被索引
- **THEN** 学生端不会显示该文件
- **AND** 管理员可随时触发增量扫描补齐

### Requirement: 资源映射收敛工作台

系统 SHALL 以任务导向的方式组织资源映射，提供「目录清理」「未映射收件箱」「单节收敛」三种视图，并在每个操作处显示其对学生端可见性的实际影响。

#### Scenario: 目录清理按目录批量生效
- **WHEN** 管理员在目录清理视图选择一个目录并执行归档或屏蔽
- **THEN** 系统对该目录下所有索引记录（含子目录）批量应用同一状态
- **AND** 返回受影响条数
- **AND** 学生端不再返回这些资源

#### Scenario: 目录清理展示噪音分布
- **WHEN** 管理员打开目录清理视图
- **THEN** 系统按目录汇总未映射资源数量，并区分教师侧与通用/学生侧
- **AND** 默认按数量降序排列，便于优先处理体量最大的旧版教辅目录

#### Scenario: 未映射收件箱默认隐藏教师侧
- **WHEN** 管理员打开未映射收件箱
- **THEN** 默认只列出 `audience in (student, both)` 且状态为 active 的资源
- **AND** 提供显式筛选以查看教师侧资源
- **AND** 每条资源明示"确认后学生是否可见"

#### Scenario: 单节收敛工作台
- **WHEN** 管理员在章节树中选中某一小节
- **THEN** 系统展示该节已挂资源与推荐候选资源
- **AND** 候选资源由该节标题关键词计算得出，并标注推荐理由
- **AND** 管理员可在该视图内完成挂载、精选、归档与解除映射

#### Scenario: 学生端效果预览
- **WHEN** 管理员在单节收敛视图中调整该节资源
- **THEN** 右侧预览面板实时展示学生端将看到的精选分组与更多资源数量
- **AND** 预览结果与学生端接口的可见性规则保持一致

#### Scenario: 每节收敛状态提示
- **WHEN** 某节的精选数少于 3 或多于 5
- **THEN** 该节在章节树与状态栏显示"未达标"
- **AND** 精选数在 3 到 5 之间时显示"达标"

#### Scenario: 操作影响提示
- **WHEN** 管理员勾选资源并准备执行批量操作
- **THEN** 每个操作按钮旁显示该操作的效果说明与预计影响的可见资源数
- **AND** 对教师侧资源提示"该操作不影响学生端可见内容"

#### Scenario: 危险操作可撤销
- **WHEN** 管理员执行屏蔽或解除映射
- **THEN** 系统在 5 秒内提供撤销入口
- **AND** 撤销后资源恢复到操作前的归属、状态与精选标记

#### Scenario: 保留高级表格视图
- **WHEN** 管理员切换到高级视图
- **THEN** 系统展示现有全字段表格与筛选能力
- **AND** 表格包含「学生可见」列，取值为可见、未挂载、未确认、教师资源或已归档之一

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
