# Design: 错题本重构（整卷模式下学生自主录入）

## Decisions

### Decision 1: 数据模型——彻底解耦 Question 表

**Choice**: 删除 `WrongQuestion`、`WrongQuestionPractice`、`VariationQuestion` 三张表，新建 `StudentWrongQuestion` 独立表。

**Alternatives considered**:
- A1 保留 WrongQuestion 表，questionId 改可空 + 加新字段 → 混乱（同一张表两种语义）
- A2 保留旧表 + 新建独立表 → 两套并存，维护负担

**Rationale**: paper-library-restructure 之后整卷测验不再产生逐题 Question 记录，旧 WrongQuestion 表的 `questionId` 外键事实上无数据来源。彻底解耦与 decouple-knowledge-from-questions 的设计思路一致——错题本是学生私域，题面内容冗余存储，不依赖任何外键。

### Decision 2: 知识点标签——自由文本字段

**Choice**: `knowledgePointTags` 为自由文本字段（逗号分隔），不外键引用 KnowledgePoint 表。

**Rationale**: KnowledgePoint 表现在是 Word 文档库（decouple-knowledge 之后），颗粒度太粗（文档级），不适合作为错题的细粒度分类标签。自由文本让学生自己写"导数"/"三角函数"等关键词，复习时按模糊搜索筛选。错题本是学生私域，标签一致性不重要。

### Decision 3: 拍照题补录——渐进式录入

**Choice**: 拍照题上传后支持后续补录题面文本（content 字段），图片不删除。

**Rationale**: 学生拍照时可能没时间录入文本，但后续需要搜索时文本很有用。渐进式录入降低首次录入门槛，同时保证可搜索性。

### Decision 4: 重练模式——学生自评对错

**Choice**: 遮挡答案 → 学生作答 → 揭示对比 → 学生自评"我答对了/我答错了"，不再系统判分。

**Rationale**: 整卷模式下系统无逐题答案数据，无法自动判分。学生自评是最简单直接的方案——学生自己最清楚是否理解了这道题。自评答对 → mastered，自评答错 → wrongCount + 1。

### Decision 5: 掌握度算法——简单比例

**Choice**: `掌握度 = 已掌握数 / 总数 × 100%`，按知识点标签分组。

**Rationale**: 错题本是学生自己看的工具，不是考试评分系统。简单比例学生一眼看懂，加权算法（考虑重练次数/复习时间）解释成本高且学生看不懂"为什么是 65% 不是 70%"。未打标签的错题归入"未分类"行单独统计。

### Decision 6: 视图消减——视图切换，数据不删

**Choice**: 默认视图仅未掌握（reviewStatus != mastered），全量视图包含已掌握，数据不物理删除。

**Rationale**: 用户明确要求"错题数量逐步消减"且"支持看到以前录入的全量错题"——这两者只有视图切换能同时满足。已掌握的错题从默认视图隐藏（视觉消减），全量视图仍可回看。

### Decision 7: 导出——浏览器打印

**Choice**: 选中错题 → 打印预览页面 → `window.print()`，不再生成 PDF/Word 文件。

**Rationale**: 用户明确表示"只要能支持打印即可，不是非得 pdf/word 文件的形式"。浏览器原生打印功能零依赖，拍照题渲染为 `<img>`，手动题通过 MathText 渲染为 LaTeX，都能在打印预览中正确显示。移除 `export-service.ts` 中错题导出相关逻辑。

## Risks

| 风险 | 缓解 |
|------|------|
| 自由文本标签不一致（"导数" vs "导函数"） | 错题本是学生私域，不一致只影响个人检索体验，不影响他人；提供模糊搜索 |
| 学生不录元数据（全 unknown） | 允许 unknown 兜底，但掌握度概览中"未分类"行让学生意识到未归类 |
| 自评不准确（学生误判） | 错题本是辅助学习工具，不作为评分依据；自评偏差影响个人复习效率，可接受 |
| 旧 WrongQuestion 表数据丢失 | paper-library-restructure 后在线测验逐题判分链路已废弃，旧表无新数据写入；DB 中如有旧数据需先查询再决定是否迁移 |

## Migration

1. **DB**: `npx prisma db push --accept-data-loss`（删除 3 张旧表 + 新建 StudentWrongQuestion 表）
2. **Backend**: 重写 `wrong-questions-service.ts`（移除 8 个旧函数，新建 8+ 个函数）；重写 `wrong-questions.ts` 路由；从 `mock-exam-service.ts` 移除 `getWrongQuestionAnalysis` 及调用方
3. **Frontend**: 重写 `WrongQuestionBook.tsx`（拍照/手动录入 + 掌握度概览 + 重练弹窗 + 打印预览）；重写 `wrong-questions-api.ts`
