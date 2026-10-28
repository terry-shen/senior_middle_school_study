## Context

当前系统仅针对数学单学科，业务数据无学科维度。本变更引入 Subject 字典表 + 全局学科切换器 + 各业务表加 subjectId，让系统支持全学科。涉及 DB schema / 后端 service+routes / 前端 Context+API+页面，是大变更。

## Decisions

### Decision 1: Subject 表 + subjectId 可空外键

**选择**: 新建 Subject 表（id/code/name/icon/color/order/isActive），各业务表（Question/ExamSession/StudentWrongQuestion/KnowledgePoint/ExamPaper）加 `subjectId Int?` 可空外键。ExamPaper 现有 `subject String?` 删除，替换为 `subjectId Int?`。

**理由**: 可空外键兼容旧数据（null），迁移脚本批量设为数学 ID 后可改为非空。外键关联 Subject 表保证数据完整性。

**替代方案（否决）**: subjectId 非空 + 默认值 — 旧数据无学科信息，强制非空会导致迁移时猜测错误。可空更安全。

### Decision 2: 全局学科切换器 + React Context + localStorage

**选择**: 新建 `SubjectContext`，顶栏学科切换器组件。选择值存 localStorage（`selectedSubjectId`）+ Context 共享。各 API service 函数从 Context 读取 subjectId 隐式传入 query 参数。

**3 个分叉的推荐假设**（可在实施时调整）：
1. **学科切换默认行为**: 记住上次选择（localStorage 持久化），首次登录默认数学
2. **学科是否强制**: 可空+引导（管理员可设置学科，旧数据 null 兜底为数学；学生端默认显示当前学科数据）
3. **学生端学科切换器**: 是（学生可切换学科查看考试/错题，但不显示「全部」选项）

**理由**: Context 是 React 标准的跨组件状态共享方式，localStorage 持久化用户偏好。隐式传参避免每个 API 调用显式传 subjectId（减少样板代码）。

### Decision 3: 后端 subjectId 查询参数过滤

**选择**: 后端各 list 端点（GET /api/papers、GET /api/papers/questions/all、GET /api/exam-sessions、GET /api/wrong-questions、GET /api/knowledge-points 等）加 `subjectId` query 参数。传则过滤，不传则返回全部（管理员视角）。

**理由**: 向后兼容（不传 subjectId 返回全部，不破坏现有行为）。前端切换器选学科时自动传 subjectId，选「全部」时不传。

### Decision 4: 自动出卷强制 subject 过滤

**选择**: exam-generation-service selectQuestions 必须按 subjectId 过滤。前端 buildParams() 从 Context 取 subjectId 传入。后端 normalizeParams 校验：若 subjectId 为空，返回 400「请先选择学科」。

**理由**: 跨学科混卷是严重错误（数学卷出现语文题），必须强制。

### Decision 5: 迁移脚本

**选择**: Node 脚本 `migrate-subject.cjs`：
1. 插入 12 个预置学科（若不存在）
2. ExamPaper.subject String? → 映射到 Subject.code 查 ID → 写入 subjectId Int?（无法映射的兜底数学）
3. Question/ExamSession/StudentWrongQuestion/KnowledgePoint 的 subjectId null → 设为数学 ID
4. 删除 ExamPaper.subject String? 字段（prisma db push --accept-data-loss）

**理由**: 一次性迁移，幂等（可重复运行）。

### Decision 6: paper-metadata-service 动态读取学科

**选择**: paper-metadata-service 的 SUBJECT_KEYWORDS 硬编码改为从 Subject 表动态读取（或启动时缓存）。autoExtractMetadata 返回 subjectCode（如"science"），路由层查 Subject 表转换为 subjectId。

**理由**: 硬编码 12 科无法适应管理员新增学科。

### Decision 7: 系统名更新

**选择**: 前端标题/登录页/侧边栏品牌名从"高中数学学习系统"改为"高中学习系统"。

**理由**: 系统扩展为全学科，名称应反映。

## Risks

- **API 隐式传参遗漏**: 某些 API 调用可能漏传 subjectId → 后端不传 subjectId 时返回全部（安全降级，管理员可接受；学生端 API 需强制传 subjectId 或默认数学）
- **旧数据 subject=null**: 迁移后部分边界数据可能仍为 null → 迁移脚本兜底数学 ID，残留 null 由后端 list 查询 `where: { OR: [{subjectId}, {subjectId: null}] }` 兼容
- **学科切换器 Context 性能**: 切换学科触发全页面数据重载 → 可接受（用户预期切换后刷新数据）
- **ExamPaper.subject String? 删除的破坏性**: 现有代码可能引用 paper.subject → grep 清理 + 编译检查

## Migration

1. 新建 Subject 表 + 预置 12 学科（种子脚本）
2. 各业务表加 subjectId Int?（db push）
3. 迁移脚本：ExamPaper.subject String? → subjectId Int? 映射
4. 各业务表 null subjectId → 数学 ID
5. 删除 ExamPaper.subject String? 字段（db push --accept-data-loss）
6. 后端各 service/route 加 subjectId 查询参数过滤
7. 前端 SubjectContext + 切换器 + 各 API 隐式传参
8. 系统名更新
