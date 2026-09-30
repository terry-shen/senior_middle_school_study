## Purpose

提供试卷导入后的结构化编辑工作流，包含Markdown全文编辑+实时预览、自动拆分预览、渐进式确认（直接确认或编辑后确认），将不可控的自动拆分转化为可控的人机协同模式。

## ADDED Requirements

### Requirement: 结构化编辑器
系统 SHALL 提供结构化的Markdown编辑器页面，用户可在导入后编辑试卷全文内容，修正OCR识别错误。

#### Scenario: 进入编辑器
- **WHEN** 用户导入试卷后点击"编辑校准"按钮
- **THEN** 系统打开结构化编辑器页面，左侧显示Markdown源码编辑区，右侧显示实时渲染预览

#### Scenario: 实时渲染预览
- **WHEN** 用户在Markdown源码编辑区修改内容
- **THEN** 右侧预览区实时渲染修改后的内容，包含LaTeX数学公式（通过KaTeX）、图片、表格

#### Scenario: 图片显示与编辑
- **WHEN** Markdown中包含图片引用（`![](url)` 格式）
- **THEN** 预览区显示对应图片，用户可查看图片内容确认OCR结果

#### Scenario: 保存校准草稿
- **WHEN** 用户点击"保存草稿"按钮
- **THEN** 系统将当前编辑的Markdown保存到试卷的 `editedMarkdown` 字段，试卷状态变为 `editing`，显示保存成功提示

#### Scenario: 自动保存草稿
- **WHEN** 用户编辑过程中每60秒未手动保存
- **THEN** 系统自动保存当前Markdown到 `editedMarkdown` 字段，防止编辑内容丢失

### Requirement: 拆分预览
系统 SHALL 提供拆分预览功能，基于校准后的Markdown执行题目拆分，显示拆分结果列表供用户确认。

#### Scenario: 预览拆分结果
- **WHEN** 用户点击"预览拆分结果"按钮
- **THEN** 系统对 `editedMarkdown`（若存在）或 `parsedMarkdown` 执行题目拆分，显示拆分出的题目列表（每题包含题号、内容、答案、解析）

#### Scenario: 拆分结果显示
- **WHEN** 拆分完成
- **THEN** 每道题目以3-block布局显示（题目/答案/解析），LaTeX公式通过MathText渲染，图片直接显示

#### Scenario: 单题微调
- **WHEN** 用户发现某道题拆分不正确
- **THEN** 用户可点击题目进入编辑模式，修改题号、内容、答案、解析文本，保存修改

#### Scenario: 拆分结果不入库
- **WHEN** 用户预览拆分结果
- **THEN** 拆分结果仅为预览，不创建Question记录，直到用户点击"确认导入"

### Requirement: 渐进式确认流程
系统 SHALL 支持渐进式导入流程，用户可根据拆分质量选择直接确认或编辑后确认。

#### Scenario: 直接确认（拆分质量好）
- **WHEN** 试卷导入后自动预拆分结果可接受
- **THEN** 用户可直接点击"确认导入"，系统基于 `parsedMarkdown` 拆分并入库，跳过编辑器

#### Scenario: 编辑后确认（拆分需修正）
- **WHEN** 自动预拆分结果不可接受
- **THEN** 用户进入编辑器修正Markdown，预览拆分结果，确认后入库

#### Scenario: 重新拆分
- **WHEN** 用户在拆分预览页面点击"重新编辑"
- **THEN** 系统返回编辑器页面，用户可继续修改Markdown，再次预览拆分

#### Scenario: 确认导入
- **WHEN** 用户在拆分预览页面点击"确认导入"
- **THEN** 系统基于校准后的Markdown创建Question记录，试卷状态变为 `completed`，跳转到题目列表页面

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
