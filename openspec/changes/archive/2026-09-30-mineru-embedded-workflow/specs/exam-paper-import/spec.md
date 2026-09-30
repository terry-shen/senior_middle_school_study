## MODIFIED Requirements

### Requirement: 试卷逐题解析拆分
系统 SHALL 自动识别试卷中的每道题目，将其拆分为独立的试题实体。拆分操作在用户确认后才执行入库，支持基于校准后Markdown的预览拆分。

#### Scenario: 自动识别题目边界
- **WHEN** 系统解析导入的试卷（parsedMarkdown或editedMarkdown）
- **THEN** 系统识别题号（如1.、2.、一、二）并定位每道题的边界

#### Scenario: 题目内容提取
- **WHEN** 系统识别到题目边界
- **THEN** 系统提取完整的题目内容（包括题干、选项、图片等）

#### Scenario: 拆分为独立试题
- **WHEN** 用户在拆分预览页面点击"确认导入"
- **THEN** 系统将每道题目创建为独立的试题记录，关联到原试卷

#### Scenario: 预览拆分（不入库）
- **WHEN** 用户点击"预览拆分结果"
- **THEN** 系统执行拆分并显示结果列表，但不创建Question记录，直到用户确认导入

#### Scenario: 基于校准Markdown拆分
- **WHEN** 试卷存在 `editedMarkdown` 字段
- **THEN** 系统 SHALL 使用 `editedMarkdown` 作为拆分输入，而非 `parsedMarkdown`

#### Scenario: 回退到原始Markdown
- **WHEN** 试卷不存在 `editedMarkdown` 字段或字段为空
- **THEN** 系统 SHALL 使用 `parsedMarkdown` 作为拆分输入

### Requirement: 导入结果预览与确认
系统 SHALL 提供导入结果的预览界面，允许用户确认或修正拆分结果。导入后不再自动拆分入库，而是进入待确认状态。

#### Scenario: 导入后进入待确认状态
- **WHEN** 系统完成MinerU转换并创建试卷记录
- **THEN** 试卷状态为 `uploaded`，系统不自动拆分入库，而是提示用户预览或编辑

#### Scenario: 预览拆分结果
- **WHEN** 系统完成试卷解析
- **THEN** 系统显示拆分出的每道题目预览（含自动生成的答案、解析、知识点），用户可检查

#### Scenario: 手动调整拆分
- **WHEN** 用户发现某道题拆分不正确
- **THEN** 用户可进入结构化编辑器修改Markdown全文，重新预览拆分结果

#### Scenario: 直接确认导入
- **WHEN** 用户对自动预拆分结果满意
- **THEN** 用户可直接点击"确认导入"，系统创建Question记录入库
