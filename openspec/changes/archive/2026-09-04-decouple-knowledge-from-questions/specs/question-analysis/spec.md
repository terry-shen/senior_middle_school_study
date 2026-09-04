## REMOVED Requirements

### Requirement: 知识点自动识别

**Reason**: 知识点已降级为独立参考文档，试题不再与知识点关联。AI 自动识别试题涉及知识点的功能失去下游消费者（掌握度、推荐、学习路径均已废弃）。

**Migration**: 教师可在题库管理中通过题型/难度筛选试题，学生可通过知识点文档独立查阅理论内容。如未来需要恢复 KP 关联，可重新引入此 capability。

### Requirement: 试题解析生成

**Reason**: AI 自动生成解析的目的是为学生提供解题思路，但本地 Ollama 模型生成质量不稳定且耗时较长（单题约 30 秒），云端配额已耗尽。试题导入时已通过 MinerU 提取了原文中的【解析】内容，无需 AI 二次生成。

**Migration**: 试题的 analysis 字段由 MinerU 拆分时直接从原文提取（【解析】标记后的内容），不再调用 LLM 生成。如原文无解析则字段为空，教师可在题库管理界面手动编辑补充。

### Requirement: 试题答案生成

**Reason**: 同解析生成——本地 Ollama 慢且不稳定，云端配额耗尽。MinerU 拆分时已从原文【答案】标记提取答案。

**Migration**: 试题的 answer 字段由 MinerU 拆分时直接从原文提取（【答案】标记后的内容），不再调用 LLM 生成。如原文无答案则字段为空，教师可手动编辑。

### Requirement: 试题摘要生成

**Reason**: 摘要功能服务于推荐系统展示（"推荐理由"包含摘要），推荐系统已废弃。摘要本身对学生价值有限（题目内容已直接展示）。

**Migration**: 不再生成摘要字段。题库管理和测验界面直接展示题目原文内容。

### Requirement: 试题元数据提取

**Reason**: 元数据（题型、分值、难度）已由 MinerU 拆分时的 question-splitting-service 自动提取（题型识别、分值正则匹配）。难度评估由独立的 difficulty-classification capability 保留，不依赖 question-analysis。

**Migration**: 题型由 splitQuestionsFromMarkdown 的 detectQuestionType 函数自动识别，分值由正则提取，难度由 difficulty-service 的 AI 评估生成。这些功能不依赖 question-analysis capability。

### Requirement: 自动化分析流程

**Reason**: "导入即分析"的自动化流程依赖 question-analysis 的全部子功能（KP识别、解析、答案、摘要、元数据），其中 KP识别/解析/答案/摘要均已废弃，元数据由拆分服务和难度服务独立完成。整体自动化流程不再需要。

**Migration**: 试卷导入流程变为：MinerU 解析 → 拆分题目（含题型/分值/答案/解析自动提取）→ 直接入库。不再触发 AI 分析。难度评估作为独立可选步骤，由管理员在难度管理界面手动触发。
