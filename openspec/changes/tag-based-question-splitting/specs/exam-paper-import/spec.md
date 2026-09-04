## MODIFIED Requirements

### Requirement: 试卷逐题解析拆分
系统 SHALL 自动识别试卷中的每道题目，将其拆分为独立的试题实体。拆分 SHALL 基于标签配对方式（`<!--QN_START-->` / `<!--QN_END-->`），替代正则表达式边界猜测。拆分前用户 SHALL 必须通过编辑器校准标签位置。重新拆分时系统 SHALL 按来源索引（sourcePaperId + sourceQuestionNumber）匹配已有题目并更新内容，而非删除重建。

#### Scenario: 自动识别题目边界
- **WHEN** 系统解析导入的试卷
- **THEN** 系统识别题号（如1.、2.、一、二）并定位每道题的边界
- **AND** 系统在Markdown中自动插入 `<!--QN_START-->` 和 `<!--QN_END-->` 标签标记边界
- **AND** 打标签基于启发式规则，结果存储到 editedMarkdown 字段

#### Scenario: 多文件批量导入
- **WHEN** 用户在导入界面选择多个文件（PDF/DOCX/TXT）
- **THEN** 系统逐个文件调用MinerU解析并存储，每个文件生成一张ExamPaper记录
- **AND** 导入界面显示每个文件的处理状态（等待中/处理中/已完成/失败）
- **AND** 全部文件处理完成后不自动跳转到编辑器，用户留在导入页面

#### Scenario: 导入与校准分离
- **WHEN** 文件导入完成（MinerU解析存储完毕）
- **THEN** 系统不自动跳转到编辑器页面
- **AND** 用户可继续导入更多文件或离开导入页面
- **AND** 用户可随时从试卷列表点击进入编辑器进行校准

#### Scenario: 强制编辑校准（拆分前必选）
- **WHEN** 用户从试卷列表进入编辑器页面
- **THEN** 用户必须校准标签位置后才能进行拆分
- **AND** 试卷状态为 uploaded 或 editing 时不允许直接跳到拆分预览

#### Scenario: 题目内容提取
- **WHEN** 用户在编辑器中确认标签位置后点击"预览拆分"
- **THEN** 系统基于标签配对提取每道题的内容（包括题干、选项、图片等）
- **AND** 不再使用正则表达式猜测题号位置

#### Scenario: 拆分为独立试题
- **WHEN** 用户首次点击"确认导入"且该试卷尚无关联题目
- **THEN** 系统将每道题目创建为独立的试题记录，关联到原试卷
- **AND** 每道题的 sourcePaperId 和 sourceQuestionNumber 字段 SHALL 填入来源索引

#### Scenario: 重新拆分更新已有题目
- **WHEN** 用户修改Markdown后再次点击"确认导入"且该试卷已有关联题目
- **THEN** 系统按 sourcePaperId + sourceQuestionNumber 匹配已有题目
- **AND** 匹配到的题目更新内容（content/answer/analysis），保留题目ID和所有关联关系
- **AND** 新增的题目（标签中新出现的题号）创建为新记录
- **AND** 已有但标签中不再存在的题目标记为"已删除"或保留不删除

#### Scenario: 无标签回退兼容
- **WHEN** Markdown中未找到任何标签（如旧试卷数据）
- **THEN** 系统回退到旧版正则拆分逻辑，保证向后兼容

### Requirement: 导入结果预览与确认
系统 SHALL 提供导入结果的预览界面，允许用户确认或修正拆分结果。拆分结果基于用户校准的标签位置生成。

#### Scenario: 预览拆分结果
- **WHEN** 用户在编辑器中点击"预览拆分结果"
- **THEN** 系统基于标签配对执行拆分，显示拆分出的每道题目预览
- **AND** 拆分结果不创建Question记录，仅显示预览

#### Scenario: 手动调整拆分
- **WHEN** 用户发现某道题拆分不正确
- **THEN** 用户可返回编辑器修改标签位置，重新预览拆分

#### Scenario: 确认导入
- **WHEN** 用户在拆分预览页面点击"确认导入"
- **THEN** 系统基于标签拆分结果创建或更新Question记录，试卷状态变为 `completed`

### Requirement: 源文件保留与下载
系统 SHALL 永久保留导入的原始文件（PDF/DOCX/TXT等），并提供下载入口供用户对比富文本内容与源文档是否一致。

#### Scenario: 源文件保留
- **WHEN** 用户通过前端上传文件导入试卷
- **THEN** 系统将原始文件永久保留在 uploads/papers/ 目录，不因重新拆分或编辑而删除
- **AND** 试卷记录的 pdfUrl 字段存储源文件访问路径

#### Scenario: 编辑器中下载源文件
- **WHEN** 用户在编辑器页面查看Markdown内容时需要对比源文档
- **THEN** 编辑器顶部 SHALL 提供"下载源文件"按钮，点击后下载或在新窗口打开原始文件

#### Scenario: 试卷列表中下载源文件
- **WHEN** 管理员在试卷列表页面查看试卷
- **THEN** 每份试卷的操作列 SHALL 提供"下载源文件"按钮（仅当源文件存在时显示）
