# Paper Edit Workflow Specification

## Purpose
试卷编辑校准工作流：MinerU 解析结果进入结构化编辑器人工校准，经拆分预览确认后入库，支持反复修改与重新拆分（更新而非重建）。

## Requirements

### Requirement: 结构化编辑器
系统 SHALL 提供结构化的Markdown编辑器页面，用户可在导入后编辑试卷全文内容，修正OCR识别错误和题目标签位置。编辑器 SHALL 显示标签、提供标签快捷操作，右侧预览区 SHALL 隐藏标签只显示渲染效果。编辑器 SHALL 永久可访问（任何状态都可进入编辑），并 SHALL 提供源文件下载入口便于人工对比。

#### Scenario: 进入编辑器
- **WHEN** 用户从试卷列表点击"编辑校准"按钮进入编辑器
- **THEN** 系统打开结构化编辑器页面，左侧显示Markdown源码编辑区（含自动打的标签），右侧显示实时渲染预览

#### Scenario: 标签源码可见
- **WHEN** 用户在编辑器左侧源码区查看Markdown
- **THEN** `<!--QN_START-->` 和 `<!--QN_END-->` 标签以特殊颜色高亮显示，与普通文本区分

#### Scenario: 标签预览隐藏
- **WHEN** 用户在编辑器右侧预览区查看渲染效果
- **THEN** 标签自动隐藏，只显示题目内容和数学公式渲染

#### Scenario: 添加标签快捷按钮
- **WHEN** 用户点击"添加题目标签"按钮
- **THEN** 系统在光标位置插入 `<!--QN_START-->` 和 `<!--QN_END-->` 标签对
- **AND** 题号N自动递增为当前最大题号+1

#### Scenario: 实时渲染预览
- **WHEN** 用户在Markdown源码编辑区修改内容
- **THEN** 右侧预览区实时渲染修改后的内容（300ms debounce），包含LaTeX数学公式、图片、表格

#### Scenario: 保存校准草稿
- **WHEN** 用户点击"保存草稿"按钮或每60秒自动保存
- **THEN** 系统将当前Markdown（含标签）保存到试卷的 `editedMarkdown` 字段，试卷状态变为 `editing`

#### Scenario: 标签统计
- **WHEN** 用户查看编辑器状态栏
- **THEN** 系统显示当前Markdown中的标签对数量（即检测到的题目数量）

### Requirement: 拆分预览
系统 SHALL 提供拆分预览功能，基于用户校准的标签执行题目拆分，显示拆分结果列表供用户确认。拆分逻辑为标签配对提取，不再使用正则表达式猜测边界。

#### Scenario: 预览拆分结果
- **WHEN** 用户点击"预览拆分结果"按钮
- **THEN** 系统使用标签配对从 `editedMarkdown` 提取每道题内容，显示拆分出的题目列表

#### Scenario: 拆分结果显示
- **WHEN** 拆分完成
- **THEN** 每道题目以3-block布局显示（题目/答案/解析），LaTeX公式通过MathText渲染，图片直接显示

#### Scenario: 单题微调
- **WHEN** 用户发现某道题内容不正确（但标签位置正确）
- **THEN** 用户可点击题目进入编辑模式，修改题号、内容、答案、解析文本，保存修改

#### Scenario: 拆分结果不入库
- **WHEN** 用户预览拆分结果
- **THEN** 拆分结果仅为预览，不创建Question记录，直到用户点击"确认导入"

### Requirement: 渐进式确认流程
系统 SHALL 强制用户通过编辑器校准题目标签后才能拆分导入。导入操作与校准操作 SHALL 分离——导入完成后不自动跳转到编辑器，用户可继续导入更多文件。用户从试卷列表手动进入编辑器校准。试卷状态 `completed` 后编辑器 SHALL 仍可访问，用户可随时修改Markdown并重新拆分更新题目。

#### Scenario: 导入后不跳转编辑器
- **WHEN** 试卷导入完成（MinerU解析+自动打标签完成）
- **THEN** 系统停留在导入页面，不自动跳转到编辑器
- **AND** 用户可继续导入更多文件或从试卷列表手动进入编辑器
- **AND** 导入页面显示该试卷的导入成功状态

#### Scenario: 手动进入编辑器校准
- **WHEN** 用户从试卷列表点击某试卷的"编辑校准"按钮
- **THEN** 系统打开编辑器页面，显示已自动打好的标签
- **AND** 用户可校准标签后点击"预览拆分"
- **AND** 状态为 uploaded 或 editing 时不允许直接跳到拆分预览页面

#### Scenario: 编辑后确认
- **WHEN** 用户在编辑器中校准标签位置后点击"预览拆分结果"
- **THEN** 系统基于标签配对执行拆分，显示预览结果
- **AND** 用户确认后点击"确认导入"完成入库

#### Scenario: 重新拆分
- **WHEN** 用户在拆分预览页面点击"重新编辑"
- **THEN** 系统返回编辑器页面，用户可继续修改标签位置，再次预览拆分

#### Scenario: 确认导入
- **WHEN** 用户在拆分预览页面点击"确认导入"
- **THEN** 系统基于校准后的标签拆分结果创建或更新Question记录，试卷状态变为 `completed`，跳转到题目列表页面

#### Scenario: 完成后重新编辑
- **WHEN** 试卷状态为 `completed` 且用户从试卷列表点击"编辑校准"
- **THEN** 系统打开编辑器，显示上次保存的 editedMarkdown（含标签）
- **AND** 用户修改Markdown后可重新"预览拆分"→"确认导入"更新已有题目（按来源索引匹配更新，不新增）

### Requirement: 试卷状态流转
系统 SHALL 管理试卷从导入到确认的状态流转，支持草稿保存和中断恢复。

#### Scenario: 导入后状态
- **WHEN** MinerU转换完成并创建试卷记录
- **THEN** 试卷状态为 `uploaded`，parsedMarkdown 存储MinerU原始输出

#### Scenario: 编辑中状态
- **WHEN** 用户进入编辑器并保存草稿
- **THEN** 试卷状态为 `editing`，editedMarkdown 存储用户编辑后的内容

#### Scenario: 拆分预览状态
- **WHEN** 用户点击"预览拆分结果"
- **THEN** 试卷状态为 `split_preview`，系统执行拆分但不入库

#### Scenario: 完成状态
- **WHEN** 用户点击"确认导入"
- **THEN** 试卷状态为 `completed`，Question记录已创建

#### Scenario: 中断恢复
- **WHEN** 用户离开编辑器后重新进入
- **THEN** 系统恢复到上次保存的 `editedMarkdown` 内容，用户可继续编辑

#### Scenario: 状态可视化
- **WHEN** 用户查看试卷列表
- **THEN** 每份试卷显示当前状态徽章（待编辑/编辑中/待确认/已完成）
