## Why

v2 目前仍带着 v1 遗留的「试卷 → 出卷 → 考试 → 批改 → 错题 → 激励」整条链路，但它与 v2 真正的核心（以视频课程为主线的章节学习）没有数据或体验上的耦合：章节页只是额外挂了「本节试卷 / 本节错题」两个入口，工作台只是多两块卡片。维护这条链路需要 16 张表、9 个路由模块、18 个服务文件和 10 个前端页面（约 9,000 行），却只服务极少数操作，反而让导航拥挤、学生入口分散、部署体积变大。

同时「学科切换器」把学科选择压成一个全局下拉，导致：

- 学生进入 `/learning` 只能看到一个学科的课程，看不到「我还能学哪些学科」；
- 语文/英语等未建设学科在切换器里是空选项，没有「待建设」的表达；
- 学科管理页（CRUD）只用于维护颜色与排序，实际从不使用。

因此本次变更把系统收敛为单一主线：**章节学习**。

## What Changes

**删除（代码 + 数据表 + 前端页面）**

- 试卷库、题库管理、题目列表、试卷查看器、试卷编辑/拆分工作流
- 模拟考试（整卷考试会话）、在线测验残留路由、答题纸提交与批改
- 错题本（含拍照/手动录入、重练、打印、管理员只读视图）
- 学习激励（打卡、徽章、排行榜、挑战）
- 学科管理页与学科 CRUD（保留只读学科列表）
- LLM 模型管理、Prompt 模板管理、旧视频资源库（`VideoResource`）
- 相应后端路由、服务、Prisma 模型（先整库备份，再 drop 表）

**改造**

- `GET /api/learning/subjects`：返回全部启用学科及其 `sectionCount`（有教材小节数）
- `/learning` 页面顶部改为**学科 Tab 条**：
  - `sectionCount > 0` 的学科可点击，用学科自身颜色着色（数学/物理/化学/生物）
  - `sectionCount = 0` 的学科灰显并标注「待建设」，不可进入
  - 记住上次选择（localStorage），首次默认数学
- 章节学习保持现有结构：视频主线课程（系列 → 课程章节 → 视频 + 关联教材小节）→ 小节详情（精选 / 更多资源）
- 小节详情移除「本节试卷」「本节错题」两块
- 学生工作台改为：继续学习（上次小节）+ 我的学科（4 张学科卡片，显示节数/已浏览）+ 最近打开（5 条）
- 管理端导航精简为：章节管理 / 资源映射 / 学习资源 / 学生列表 / 网盘绑定
- 百度网盘 OAuth 回调改为 `${PUBLIC_BASE_URL}/api/netdisk/callback`，云端通过环境变量注入公网地址

**保留**

- 账号体系（登录/注册/会话）、学生与班级管理
- 教材章节树与章节管理（`chapters`、`chapter-taxonomy-service`）
- 章节学习（`learning`）、网盘浏览与索引/映射（`netdisk`、`netdisk-index`）
- 学科只读列表（`subjects` GET）
- AI 助理外链导航（`ai-assistants`）

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `chapter-learning`：新增学科 Tab 与「待建设」表达；小节详情移除试卷/错题；工作台改为学习导向
- `admin-dashboard`：导航精简（删除试卷/题目/考试/激励/学科管理/模型管理入口），工作台按角色重做
- `subject-management`：由「学科 CRUD 管理」改为「只读学科目录 + sectionCount 驱动可用性」

### Retired Capabilities

`paper-library`、`whole-paper-publish`、`exam-paper-import`、`paper-edit-workflow`、`tag-based-splitting`、`paper-question-enrichment`、`question-bank-management`、`mock-exam`、`exam-taking`、`answer-grading`、`wrong-question-collection`、`learning-incentive`、`llm-integration`、`mineru-parser-service`、`mcq-extractor-service`、`video-library`

## Impact

- **数据库**：删 17 张表（ExamPaper、Question、ExamSession、ExamSubmission、ExamSessionAssignment、AnswerSheet、ExamTemplate、EnrichmentProposal、StudentWrongQuestion、Badge、UserBadge、CheckIn、Challenge、ChallengeParticipant、ChallengeBadge、IncentiveNotification、VideoResource）。保留 Subject / Textbook / Chapter / Section / Student / Class / Session / NetdiskConfig / NetdiskAsset / NetdiskScanState / StudentLearningProgress / AiAssistant / LLMConfig（LLMConfig 保留表但不再有管理界面）。
- **后端**：删 9 个路由（papers、paper-library、exam-sessions、exams、grading、answer-sheets、wrong-questions、incentive、difficulty）与 3 个可选路由（llm、prompt-template、video-library），删 20 个服务；`learning-service` 瘦身；`netdisk-service` 回调地址环境变量化。
- **前端**：删 10 个页面与其 CSS、删 12 个 API 客户端；重写 `ChapterMap`（学科 Tab）、`ChapterDetail`（去试卷/错题）、`Workbench`（学习导向）、`Sidebar`、`App.tsx` 路由。
- **部署**：`docker-compose.yml` 增加 `PUBLIC_BASE_URL`；云端需用新镜像重建 api/web；`data/uploads` 中试卷/答题纸目录可回收（约 250MB）。
- **风险**：数据不可逆删除（先备份 `dev.db` 与 `uploads`）；百度回调需在开放平台登记新地址（旧 token 仍有效）。
