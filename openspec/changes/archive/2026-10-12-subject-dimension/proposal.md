## Why

当前系统设计仅针对数学单学科（系统名"高中数学学习系统"），但实际高中教学覆盖语文/数学/英语/物理/化学/生物/政治/历史/地理/文综/理综等多学科。题库、试卷、考试、错题、知识点等核心业务数据无学科维度，导致跨学科数据混在一起无法区分，自动出卷可能跨学科混卷，学生无法按学科筛选学习内容。需要引入学科维度，让系统成为真正的"高中学习系统"而非"高中数学学习系统"。

## What Changes

- **新建 Subject 表**：可管理的学科字典表（code/name/icon/color/order/isActive），预置 12 个学科（语文/数学/英语/物理/化学/生物/政治/历史/地理/文综/理综）
- **全局学科切换器**：顶栏学科切换下拉，选择后存 localStorage + React Context，所有前端 API 请求隐式带 subjectId 查询参数，后端按 subjectId 过滤返回数据
- **各业务表加 subjectId**：Question/ExamSession/StudentWrongQuestion/KnowledgePoint 加 `subjectId Int?`（可空，兼容旧数据）；ExamPaper 现有 `subject String?` 改为 `subjectId Int?` 外键化（外键关联 Subject 表）
- **自动出卷强制 subject 过滤**：selectQuestions 必须按 subjectId 过滤，杜绝跨学科混卷
- **旧数据批量归入数学**：迁移脚本将所有现有记录 subjectId 设为数学学科 ID
- **系统名改"高中学习系统"**：前端标题/导航/登录页品牌名更新
- **学科管理界面**：管理员可 CRUD 学科（新增/编辑/排序/启停），位于系统设置分组
- **学生端学科切换器**：学生端顶栏也有学科切换器，按学科筛选考试/错题/知识点

**BREAKING**: ExamPaper.subject String? 字段删除，替换为 subjectId Int? 外键。前端 paper-metadata-service 的 subject 枚举（12 科硬编码）改为从 Subject 表动态读取。

## Capabilities

### New Capabilities

- `subject-management`: 学科字典管理（Subject 表 CRUD + 预置 12 学科 + 启停 + 排序）

### Modified Capabilities

- `admin-dashboard`: ADDED 学科管理界面入口（系统设置分组下）+ ADDED 全局学科切换器（顶栏）
- `exam-paper-import`: MODIFIED 试卷元数据管理（subject String? → subjectId Int? 外键化 + 导入时学科选择）
- `question-bank-management`: MODIFIED 试题独立存储（加 subjectId）+ MODIFIED 试题分类管理（按学科筛选）
- `auto-exam-generation`: MODIFIED 智能选题算法（强制 subjectId 过滤，杜绝跨学科混卷）
- `mock-exam`: MODIFIED 模拟考试统一为 ExamSession（加 subjectId + 按学科筛选）
- `exam-taking`: MODIFIED 在线测验统一为 ExamSession（学生端学科切换器 + 按学科筛选）
- `wrong-question-collection`: MODIFIED 错题自主录入（加 subjectId + 按学科筛选）
- `knowledge-point-management`: MODIFIED 知识点文档管理（加 subjectId + 按学科筛选）
- `knowledge-point-import`: MODIFIED Word文档导入知识点（导入时学科选择）

## Impact

- **DB schema**: 新建 Subject 表；Question/ExamSession/StudentWrongQuestion/KnowledgePoint/ExamPaper 加 subjectId Int? 字段 + 外键 + 索引；删除 ExamPaper.subject String? 字段；迁移脚本（旧数据 subjectId=数学 ID）
- **后端**: 新建 subject-service.ts + routes/subjects.ts；paper-metadata-service 改为从 Subject 表动态读取学科列表（不再硬编码 SUBJECT_KEYWORDS）；exam-generation-service selectQuestions 加 subjectId 过滤（强制）；exam-session-service/wrong-questions-service/knowledge-points.ts 各 list 端点加 subjectId 查询参数过滤
- **前端**: 新建 SubjectContext + 顶栏学科切换器组件；各 API service 函数从 Context 读取 subjectId 隐式传入；SubjectManagement.tsx 学科管理页面（系统设置分组下）；系统名/标题/品牌更新为"高中学习系统"
- **迁移**: ExamPaper.subject String? → subjectId Int? 外键化（paper-library-restructure 加的 subject 字段需迁移：已有的 subject 字符串值如"理综"/"数学"映射到 Subject.code 查 ID）
