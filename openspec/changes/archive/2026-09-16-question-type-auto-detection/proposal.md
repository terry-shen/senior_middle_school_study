# Proposal: question-type-auto-detection

## Why

当前试卷导入拆分后，所有题目的 `questionType` 几乎全部标注为 `essay` 或 `unknown`，无法区分选择题（单选/多选）、填空题、解答题。数据库验证：19 道题中 16 道 essay、3 道 unknown，0 道选择题——实际 Q1 `$(1-3i)^2=$ A. $-8+6i$ B. ...` 明显是选择题但被误判。

根因有三：
1. `detectQuestionType` 正则太窄，只认全角括号 `（A）`，不认最常见的 `A.` 选项格式
2. MinerU 输出的 LaTeX 公式让 `content.length` 普遍 >100，触发"长度>100→essay"兜底规则，把选择题都吞了
3. 试卷 Markdown 有结构化章节标题（`一、单项选择题`、`二、多项选择题`、`三、填空题`、`四、解答题`）但拆分时未利用，每道题丢失了上下文

这导致自动出卷的题型分布参数（choice/fill/essay 数量）无法匹配到正确题目，学生在线测验的选项渲染也无法正确展示。

## What Changes

1. **题型枚举扩展**：从 4 种（`choice`/`fill`/`essay`/`unknown`）扩展为 5 种（`single_choice`/`multiple_choice`/`fill`/`essay`/`unknown`），区分单选题和多选题
2. **章节标题识别**：在拆分 Markdown 时识别 `一、单项选择题`、`二、多项选择题`、`三、填空题`、`四、解答题` 等章节标题（兼容中文数字/阿拉伯数字/I. 等多种格式），将章节题型传递给该章节下的每一道题
3. **规则增强兜底**：当无章节标题时，用增强正则识别题型——`A.`/`B.`/`C.`/`D.` 选项模式 → `single_choice`；多个正确答案标记 → `multiple_choice`；下划线 `____` 或括号空 `（  ）` → `fill`；其余长文本 → `essay`
4. **编辑校准页面加题型修正**：PaperEdit 编辑器和 SplitPreview 拆分预览页面，每道题显示当前题型标签 + 题型下拉框，教师可手动修正后保存
5. **只对新导入题目生效**：不回溯修改已入库题目的题型，仅影响新导入并拆分的题目

## Capabilities

- **MODIFIED `exam-paper-import`**: 试卷逐题解析拆分——新增章节标题识别 + 题型自动识别 + 题型枚举扩展

## Out of Scope

- 已入库题目的题型回溯更新（用户明确"只需要对新导入的题目生效即可"）
- LLM 辅助题型识别（本地 Ollama 太慢，AI 分析模块已移除）
- 题型识别准确率统计与报表
