## MODIFIED Requirements

### Requirement: 多渠道知识点导入

系统 SHALL 提供基于 Excel 模板的知识点导入功能，支持教师下载标准模板、离线填写后上传导入。导入流程不依赖大模型，通过 Excel 宽表格式（层级1-5列）描述知识树结构。

#### Scenario: 下载知识点导入模板

- **WHEN** 用户在知识点导入页面点击"下载模板"按钮
- **THEN** 系统返回 `.xlsx` 文件下载，包含3个Sheet：Sheet1"知识点导入"（含表头和2行示例）、Sheet2"填写说明"（含7条填写规则）、Sheet3"完整示例"（含20+行完整知识点示例）

#### Scenario: 模板表头结构

- **WHEN** 用户打开下载的 Excel 模板 Sheet1
- **THEN** 表头包含8列：层级1、层级2、层级3、层级4、层级5、描述、要点解读、建议学时

#### Scenario: 上传 Excel 文件并解析

- **WHEN** 用户选择 `.xlsx` 文件并点击"上传预览"
- **THEN** 系统解析 Excel 文件，按层级1-5列宽表格式构建知识树结构，返回解析后的知识点列表（含 code、name、level、parentCode、description、keyPoints、suggestedHours）

#### Scenario: 留空规则处理

- **WHEN** Excel 某行层级4和层级5为空（知识点只到第3层）
- **THEN** 系统创建 level=3 的知识点节点，不创建 level 4-5 的子节点

#### Scenario: 同父节点层级一致性校验

- **WHEN** Excel 中同一父节点下的子节点使用了不同的层级列（如一个子节点在层级3列、另一个在层级4列）
- **THEN** 系统在预览时标记为"层级不一致"警告，允许用户在编辑校准中修正

#### Scenario: 非Excel文件上传

- **WHEN** 用户上传非 `.xlsx` 格式文件（如 PDF、TXT、DOCX）
- **THEN** 系统返回 400 错误，提示"仅支持 .xlsx 格式的 Excel 文件"

#### Scenario: 空文件或无有效数据行

- **WHEN** 上传的 Excel 文件没有数据行（只有表头）或文件为空
- **THEN** 系统返回错误提示"未检测到有效知识点数据，请填写模板后重新上传"

#### Scenario: 从教材PDF导入知识点

- **WHEN** 管理员上传教材PDF文件
- **THEN** 系统提示"已切换为 Excel 模板导入方式，PDF 文件不支持直接导入，请使用模板整理知识点后上传"

#### Scenario: 从教学大纲导入知识点

- **WHEN** 管理员上传教学大纲文档
- **THEN** 系统提示"已切换为 Excel 模板导入方式，请将大纲内容填入模板后上传"

#### Scenario: 从图片导入知识点

- **WHEN** 管理员上传知识点图片（如思维导图、知识图谱）
- **THEN** 系统提示"已切换为 Excel 模板导入方式，图片不支持直接导入，请将内容填入模板后上传"

#### Scenario: 手动输入知识点

- **WHEN** 管理员需要手动添加知识点
- **THEN** 系统引导用户下载 Excel 模板，在模板中填写后上传，或在知识点管理页面直接添加子节点

### Requirement: 知识点自动分类与映射

系统 SHALL 将 Excel 宽表格式解析为树形层级结构，自动生成知识点编码（code），并建立父子关系。解析过程不使用大模型，完全基于 Excel 列位置规则。

#### Scenario: 树形结构构建

- **WHEN** 系统解析 Excel 数据行
- **THEN** 按层级1→层级2→...→层级5从左到右构建树形结构，每层节点 name 取自对应列值，parentCode 取自上一层节点的 code

#### Scenario: 知识点编码自动生成

- **WHEN** 系统创建知识点节点
- **THEN** 自动生成唯一 code，格式为 `KP{parentId}.{序号}`（如根节点 KP01、子节点 KP01.01、孙节点 KP01.01.01），确保编码唯一性和层级可读性

#### Scenario: 描述和要点解读字段提取

- **WHEN** Excel 行的描述列和要点解读列有值
- **THEN** 系统将描述列值存入 KnowledgePoint.description，将要点解读列值追加到 description 末尾以 `【要点解读】` 分隔符标记

#### Scenario: 建议学时字段提取

- **WHEN** Excel 行的建议学时列有数值
- **THEN** 系统将值存入 KnowledgePoint.suggestedHours 字段；若为空则 suggestedHours 为 null

#### Scenario: 知识点自动分类

- **WHEN** 系统解析 Excel 导入的知识点
- **THEN** 系统按层级1列值自动归类知识点的所属模块（如层级1="代数"则归类为代数模块），无需 AI 判断

#### Scenario: 知识点层级识别

- **WHEN** 系统解析 Excel 导入的知识点
- **THEN** 系统按 Excel 列位置（层级1-5列）确定层级关系，层级1=level 1、层级2=level 2，依此类推

#### Scenario: 知识点前置依赖识别

- **WHEN** 系统解析 Excel 导入的知识点
- **THEN** 系统不自动识别前置依赖关系（Excel 模板不包含依赖信息字段），用户可在知识点管理页面手动配置前置依赖

### Requirement: 增量导入与冲突检测

系统 SHALL 支持增量导入，通过知识点 code 匹配已有数据：code 已存在则更新字段，code 不存在则创建新节点。确认导入前用户可预览将要创建和更新的知识点列表。

#### Scenario: 新知识点创建

- **WHEN** 用户确认导入，且某知识点的 code 在数据库中不存在
- **THEN** 系统创建新的 KnowledgePoint 记录，status 标记为新建

#### Scenario: 已有知识点更新

- **WHEN** 用户确认导入，且某知识点的 code 已存在于数据库
- **THEN** 系统更新该 KnowledgePoint 的 name、description、suggestedHours 字段（保留 id、masteryLevel 不变），status 标记为更新

#### Scenario: 预览创建和更新统计

- **WHEN** 用户点击"上传预览"后系统返回解析结果
- **THEN** 返回数据包含统计信息：将创建数量（newCount）、将更新数量（updateCount）、总数量（totalCount）

#### Scenario: 检测重复知识点

- **WHEN** 导入的知识点 code 与已有知识点 code 相同
- **THEN** 系统标记为"更新"状态（非重复），在预览中显示黄色徽章，确认后更新该知识点字段

#### Scenario: 检测冲突知识点

- **WHEN** 导入的知识点 code 不存在于数据库
- **THEN** 系统标记为"新建"状态（非冲突），在预览中显示绿色徽章，确认后创建新记录

#### Scenario: 提示管理员决策

- **WHEN** 预览显示新建和更新统计
- **THEN** 用户可选择"确认导入"执行全部创建和更新，或在编辑校准中修改后再确认

## ADDED Requirements

### Requirement: 人工编辑校准

系统 SHALL 在 Excel 解析后提供人工编辑校准界面，允许用户在确认导入前修改知识点的字段值、层级关系和父子结构。编辑校准为可选步骤，用户也可直接确认导入。

#### Scenario: 树形预览展示

- **WHEN** 用户上传 Excel 文件成功后
- **THEN** 系统展示树形可视化预览（可展开/折叠的树形列表），每个节点显示 code、name、level、描述摘要，并标记新建（绿色）或更新（黄色）状态

#### Scenario: 表格编辑器

- **WHEN** 用户点击某个知识点节点进入编辑
- **THEN** 系统展示该知识点的完整字段编辑表单（name、description、keyPoints、suggestedHours），用户修改后点击保存更新到本地预览数据（不写入数据库）

#### Scenario: 编辑后确认导入

- **WHEN** 用户在编辑校准后点击"确认导入"
- **THEN** 系统将校准后的知识点列表提交到确认导入端点，系统按 code 匹配创建或更新数据库记录

#### Scenario: 跳过编辑直接导入

- **WHEN** 用户上传 Excel 后不编辑直接点击"确认导入"
- **THEN** 系统使用 Excel 原始解析结果直接执行导入，无需强制编辑

## REMOVED Requirements

### Requirement: 知识点融合

**Reason**: 该需求依赖大模型进行知识点冲突检测和自动合并，与本变更"移除 LLM 依赖"的设计目标冲突。增量导入通过 code 匹配处理重复，无需自动融合。

**Migration**: 用户通过人工编辑校准处理知识点重复和冲突。增量导入时 code 匹配则更新，不匹配则创建，不会产生重复数据。
