## Context

当前导入流程：PDF → MinerU CLI（异步spawn）→ parsedMarkdown → `splitQuestionsFromMarkdown()` 自动拆分 → 自动入库。问题在于自动拆分基于正则匹配题号，MinerU输出格式不统一导致拆分错误率高。现有代码：`mineru-service.ts`（转换）、`question-splitting-service.ts`（拆分）、`MathText.tsx`（LaTeX渲染）、`QuestionList.tsx`（3-block布局）均可复用。

## Goals / Non-Goals

**Goals:**
- 提供结构化编辑器，用户可修正MinerU输出的Markdown
- 支持拆分预览（不入库），用户确认后才入库
- 渐进式流程：拆分质量好时直接确认，差时进入编辑器
- 复用现有 `splitQuestionsFromMarkdown`、`MathText`、3-block布局

**Non-Goals:**
- 不实现所见即所得（WYSIWYG）富文本编辑器（使用Markdown源码编辑+实时预览）
- 不改变MinerU CLI调用方式（已有异步spawn版本）
- 不修改 `splitQuestionsFromMarkdown` 的拆分算法本身（改为基于校准文本执行）

## Decisions

### Decision 1: 编辑器形态 — Markdown源码编辑 + 实时预览（双栏布局）
**选择**: 左侧textarea + 右侧MathText实时渲染预览
**替代方案**: (a) 所见即所得TipTap编辑器（实现复杂，需处理LaTeX在富文本中的嵌入） (b) Monaco/CodeMirror（有语法高亮但增加依赖）
**理由**: textarea零依赖，用户编辑的是Markdown源码，右侧通过现有的MathText组件实时渲染。实现最快，复用已有组件。用户需要懂基本Markdown语法但题号/答案标记格式简单。

### Decision 2: 拆分时机 — 编辑后拆分 + 自动预拆分
**选择**: 导入时自动执行一次预拆分（显示结果），用户可选择直接确认或进入编辑器编辑后重新拆分
**替代方案**: (a) 仅编辑后拆分（用户必须进编辑器） (b) 仅自动拆分不可编辑（当前方案，已证明脆弱）
**理由**: 渐进式流程——质量好时省时间（直接确认），质量差时可修正（进编辑器）。预拆分使用现有 `splitQuestionsFromMarkdown`，结果存内存不写DB。

### Decision 3: 拆分预览数据流 — 不入库，前端持有
**选择**: 拆分预览结果仅返回给前端显示，不创建Question记录。用户点击"确认导入"时才执行 `createQuestionsInDb`
**替代方案**: 创建临时Question记录标记为draft（增加复杂度，需清理机制）
**理由**: 简单，避免脏数据。拆分预览API返回JSON数组，前端渲染为3-block列表。确认时调用专门的confirm端点入库。

### Decision 4: 数据模型 — ExamPaper新增 editedMarkdown 字段 + 状态扩展
**选择**: 
- 新增 `editedMarkdown String?` 字段存储用户校准后的Markdown
- 状态扩展：`uploaded` → `editing` → `split_preview` → `completed`
**替代方案**: 新建PaperDraft表存储草稿（过度设计）
**理由**: 单字段足够，editedMarkdown为空时回退到parsedMarkdown。状态字段已有（status），只需扩展枚举值。

### Decision 5: 自动保存 — 60秒间隔 + 离开页面时保存
**选择**: 编辑器内每60秒自动保存editedMarkdown，组件卸载时也触发保存
**替代方案**: 仅手动保存（用户可能丢失编辑内容）
**理由**: 防止数据丢失，60秒间隔平衡了性能和安全性。

## Risks / Trade-offs

- **[用户需懂Markdown]** → 风险：教师/管理员不熟悉Markdown语法 → 缓解：编辑区上方显示格式提示（题号N.、答案【答案】、解析【解析】），右侧实时预览让用户看到渲染效果
- **[编辑器功能有限]** → 风险：textarea无语法高亮、无快捷键 → 缓解：先实现基础功能验证流程，后续可升级为CodeMirror
- **[拆分预览不入库]** → 风险：用户预览后离开页面，拆分结果丢失 → 缓解：editedMarkdown已保存，重新进入可重新预览
- **[大文档性能]** → 风险：27813字符Markdown实时渲染可能卡顿 → 缓解：预览渲染加debounce 300ms
