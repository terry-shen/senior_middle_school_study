# Design: question-type-auto-detection

## Decisions

### Decision 1: 题型枚举从 4 种扩展为 5 种

**选择**: `single_choice`（单选题）、`multiple_choice`（多选题）、`fill`（填空题）、`essay`（解答题）、`unknown`（未识别）

**替代方案**: 保留原有 `choice`（不区分单选多选）+ 新增 `multiple_choice`
**否决理由**: 用户明确要求"要区分单选题和多选题"。保留 `choice` 会导致下游代码（出卷参数、筛选、统计）需要同时处理 `choice` 和 `single_choice` 两种值，增加复杂度。

**兼容性**: 旧数据中的 `choice` 值需要在前端展示时当作 `single_choice` 处理（显示为"选择题"）。后端出卷参数 `typeDistribution` 支持 `single_choice` 和 `multiple_choice`，旧值 `choice` 在 normalizeParams 中映射为 `single_choice`。

### Decision 2: 章节标题识别优先 + 规则增强兜底（方案 B+A 组合）

**选择**: 
1. 先扫描 Markdown 识别章节标题（`一、单项选择题`、`二、多项选择题` 等），建立"行范围→题型"映射
2. 拆分每道题时，根据题目在 Markdown 中的位置查找所属章节，继承章节题型
3. 无章节标题或不在任何章节下的题目，用增强规则正则兜底

**替代方案**: 仅规则增强（方案 A，准确率~70%）；仅 LLM 辅助（方案 C，准确率~98%但本地 Ollama 太慢）
**否决理由**: 章节标题是试卷的显式结构信号，准确率最高（~95%）且零成本。规则增强作为兜底覆盖无章节标题的情况。LLM 方案因 AI 分析模块已移除、本地模型太慢而不采用。

### Decision 3: 增强规则正则的选项检测

**选择**: 检测 `A.`/`B.`/`C.`/`D.`（字母+点，最常见格式）+ `A）`/`B）`（字母+全角右括号）+ `（A）`/`（B）`（全角括号包裹）三种选项格式

**替代方案**: 仅检测 `（A）` 全角括号（当前实现）
**否决理由**: 高考/模拟试卷中最常见的选项格式是 `A.`（如 `A. $-8+6i$`），当前正则完全遗漏。

**关键改动**: 删除"content.length > 100 → essay"兜底规则——MinerU 输出的 LaTeX 公式让几乎所有题目 content.length >100，该规则把选择题都误判为解答题。

### Decision 4: 编辑校准页面加题型下拉框

**选择**: PaperEdit 和 SplitPreview 页面中，每道题卡片显示当前题型标签 + 题型下拉框（single_choice/multiple_choice/fill/essay/unknown），教师可修改后保存

**替代方案**: 仅在拆分预览页面（SplitPreview）加修正，PaperEdit 不加
**否决理由**: PaperEdit 是"编辑校准"的主入口（用户导入后必须先编辑再确认拆分），题型修正应在此阶段完成。SplitPreview 是最终确认前的预览，两个页面都需要修正入口。

**实现**: 
- SplitPreview: 每道题卡片加题型下拉框，修改后存入本地 questions 数组，确认导入时一起保存
- PaperEdit: 不在 Markdown 源码中加题型标记（避免污染源码），题型修正延迟到 SplitPreview 阶段

### Decision 5: 只对新导入题目生效

**选择**: 不回溯修改已入库题目的题型，仅影响新导入并拆分的题目

**替代方案**: 批量回溯重新识别所有已入库题目的题型
**否决理由**: 用户明确"只需要对新导入的题目生效即可"。回溯修改可能影响已有测验/错题的关联数据，风险高且无用户需求。

**注意**: 旧数据中的 `choice` 值保留不动，前端展示层做兼容映射。

## Risks

| 风险 | 影响 | 缓解 |
|---|---|---|
| 章节标题格式不标准（如"一.选择题"无顿号） | 章节识别遗漏 → 回退规则兜底 | 正则兼容多种格式（有/无顿号、全/半角） |
| 题目跨章节（如选择题最后一题的解析延伸到填空题章节） | 题型继承错误 | 以题目起始位置判定所属章节，不以内容结尾 |
| 旧数据 `choice` 值与新 `single_choice` 不兼容 | 出卷参数/筛选异常 | normalizeParams 做别名映射，前端展示做兼容 |
| 无章节标题 + 无选项模式的填空题被误判为 essay | 填空题漏识别 | 下划线 `____` 和空括号 `（  ）` 检测兜底 |

## Migration

- `detectQuestionType` 函数增强：新增选项格式检测 + 删除长度兜底 + 新增 `single_choice`/`multiple_choice` 返回值
- `splitQuestionsFromMarkdown` / `splitQuestionsByTags` 拆分函数：新增章节标题扫描 + 题型继承逻辑
- `SplitQuestion` interface：questionType 类型从 `'choice'|'fill'|'essay'|'unknown'` 扩展为 `'single_choice'|'multiple_choice'|'fill'|'essay'|'unknown'`
- `createQuestionsInDb`：写入新的 questionType 值
- 前端题型筛选下拉框、出卷参数、题型标签显示：适配新枚举值
- 旧数据 `choice` 值：前端展示时映射为 `single_choice`，后端 normalizeParams 做别名
