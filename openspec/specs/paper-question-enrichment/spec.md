# paper-question-enrichment Specification

## Purpose

提供试卷导入后的题目 AI 忠实还原清洗能力：在人工确认入库之前，由大模型将 MinerU 解析产生的 OCR 噪声（错字、LaTeX 残缺、选项错位、编号错乱）清理掉，并以 diff 形式交由人工逐题审核，确保题库质量的同时把人工校对成本降到最低。

## Requirements

### Requirement: 忠实还原清洗约束
系统 SHALL 在调用大模型清洗题目时，以 `parsedMarkdown`（或人工编辑后的 `editedMarkdown`）拆出的题目文本为唯一基准，仅修复机械性解析噪声，明确禁止改写、推断或补全原题内容。

#### Scenario: 仅修复 OCR 噪声
- **WHEN** 题目文本包含明显 OCR 错字（如"倒1"应为"第一"）、LaTeX 格式残缺、选项顺序错位或题号标点错乱
- **THEN** 系统 SHALL 修复这些机械性噪声并逐条记录修改理由

#### Scenario: 禁止改写原题内容
- **WHEN** 题目文本中的数字、公式、符号或表述本身清晰无误
- **THEN** 系统 SHALL 保持原样输出，不得改写、重排或润色

#### Scenario: 禁止推断补全
- **WHEN** 题干缺失、答案缺失或解析缺失
- **THEN** 系统 SHALL 不生成、不补算、不推断缺失内容，仅原样保留缺失状态

### Requirement: 清洗结果结构化输出
系统 SHALL 将每道题的清洗结果以结构化 JSON 输出，包含原文、清洗后文本、是否变更、变更理由列表和置信度。

#### Scenario: 输出变更明细
- **WHEN** 大模型完成某道题的清洗
- **THEN** 系统 SHALL 记录该题的清洗后全文（`cleanedText`）、与原文的变更状态（`changed`）、逐条修改理由（`changes[]`）和置信度（`confidence`）

#### Scenario: 未变更题目标记
- **WHEN** 大模型判定某道题无需任何修改
- **THEN** 系统 SHALL 将该题标记为 `changed: false`，前端对该题不展示 diff，人工可直接跳过

#### Scenario: 低置信度提示
- **WHEN** 大模型对某道题的清洗结果置信度低于系统阈值
- **THEN** 系统 SHALL 将该题标记为需人工重点复核

### Requirement: 分批异步执行
系统 SHALL 支持对一份试卷的题目进行分批清洗，每批多道题一次调用大模型，并支持异步执行与进度查询。

#### Scenario: 批量调用
- **WHEN** 管理员对某份试卷触发清洗
- **THEN** 系统 SHALL 将题目按批分组（每批 15-20 题）逐批调用大模型，避免逐题调用的性能与成本开销

#### Scenario: 异步进度可见
- **WHEN** 清洗任务在后台执行
- **THEN** 系统 SHALL 提供任务状态查询接口，返回已完成/总题数与当前批次信息

#### Scenario: 单批失败不中断
- **WHEN** 某一批清洗调用失败（超时或模型错误）
- **THEN** 系统 SHALL 记录失败原因，继续处理其余批次，并在最终结果中标记失败的题目

### Requirement: 人工审核与确认入库
系统 SHALL 将清洗结果作为"提议"呈现给人工逐题审核，仅在人工接受后才允许写入正式题库。

#### Scenario: diff 形式呈现
- **WHEN** 人工查看某道已变更的清洗结果
- **THEN** 系统 SHALL 并排展示原文与清洗后文本，并列出各条修改理由

#### Scenario: 逐题接受或驳回
- **WHEN** 人工审核某道题的清洗结果
- **THEN** 系统 SHALL 允许对该题单独标记"接受"或"驳回"，驳回时保留原文

#### Scenario: 仅接受项入库
- **WHEN** 人工确认导入该试卷的题目
- **THEN** 系统 SHALL 仅将状态为"接受"的清洗结果写入对应 `Question` 记录，驳回或未处理的题目保持原文

#### Scenario: 清洗结果不自动入库
- **WHEN** 清洗任务完成
- **THEN** 系统 SHALL 不自动修改任何 `Question` 记录，所有变更必须经过人工确认

### Requirement: 清洗以人工编辑为基准
系统 SHALL 优先以人工编辑后的 `editedMarkdown` 作为清洗基准。

#### Scenario: 已有人工编辑版本
- **WHEN** 试卷存在 `editedMarkdown`（用户已手动校准过）
- **THEN** 系统 SHALL 基于人工编辑后的版本拆题并清洗，尊重人工修改内容

#### Scenario: 无人工编辑版本
- **WHEN** 试卷不存在 `editedMarkdown`
- **THEN** 系统 SHALL 基于 `parsedMarkdown` 拆题并清洗