## 1. M0 冻结与分支

- [x] 1.1 在 `main` 上打 tag `v1-final` 并推送，验证 `git tag -l` 与 `git ls-remote --tags` 均能看到该 tag
- [x] 1.2 从 `v1-final` 创建 `v2` 分支并推送，验证 `git branch -r` 显示 `origin/v2`
- [x] 1.3 在 `v2` 上跑一遍基线验证（后备 `npm run build`、前端 `npm run build`、`npx jest`），把通过结果记入变更说明，确认迁移前基线可复现

## 2. M1 原地裁剪（保留模块一行不改，禁止顺手重构）

- [x] 2.1 摘除后端 v2 不需要的路由注册（difficulty / exams 自动出卷 / knowledge-points / online 模式入口），保留 service 与数据表，验证 `/health` 返回 200 且被摘除路径返回 404
- [x] 2.2 校验网盘模块零改动：`git diff v1-final -- backend/src/services/netdisk-service.ts backend/src/routes/netdisk.ts` 输出为空，且 `GET /api/netdisk/status` 返回 `bound`
- [x] 2.3 校验 MinerU 模块零改动：diff 为空，且 `checkMinerUAvailable()` 返回 true、56090 端口 healthy
- [x] 2.4 校验试卷模块可用且零改动：`GET /api/paper-library` 返回与 v1-final 基线一致的整卷数（当前 285 条），papers / paper-library / paper-images-service / paper-metadata-service 无 diff
- [x] 2.5 校验答题纸模块可用且零改动：上传一张图片答题纸 → 保存批注 → 回读一致，answer-sheets 相关文件无 diff
- [x] 2.6 校验错题 / 激励 / 视频三个模块列表接口返回 200 且相关文件无 diff
- [x] 2.7 前端摘除 v2 不需要的页面与路由（难度管理 / 自动出卷 / 知识点文档 / AI 分析等），验证 10 个保留页面可导航、0 死链、0 ErrorBoundary
- [x] 2.8 核验数据表行数未变（Question / ExamPaper / VideoResource / StudentWrongQuestion），确认只摘代码路径不删数据
- [x] 2.9 审计裁剪 diff：`git diff v1-final --stat` 中 backend/src 与 frontend/src 只出现"删除"或索引/路由注册行改动，核心资产文件（netdisk / mineru / answer-sheets）不得出现在改动列表中

## 3. M2 章节轴

- [x] 3.1 新增 `Textbook` / `Chapter` / `Section` 三张表（含 `edition`、`grade`、`order`、唯一约束与外键），验证 `prisma db push` 成功且 `prisma validate` 通过
- [x] 3.2 编写人教 A 数学章节种子脚本（5 册 / 19 章 / 约 90 节），验证执行后 `Section` 计数约 90 且册章数量为 5/19
  - 注：人教A版（2019）实际为 5 册 / 18 章 / 73 节（原方案写 19 章 / 约 90 节为估值）。种子 `backend/seed-taxonomy.cjs` 幂等，二次执行 created=0/0/0。
- [x] 3.3 验证种子幂等性：重复执行脚本两次，`Section` 计数不变、无重复 `(parentId, order)` 记录
- [x] 3.4 实现章节树查询接口（按学科返回三级嵌套），验证返回 5 个册节点、每册 children 为其章、每章 children 为其节
- [x] 3.5 实现章节管理写接口（新增 / 重命名 / 排序 / 删除含引用校验），验证删除含子节点的章返回 400、删除被引用节返回 409
- [x] 3.6 前端实现章节管理页（册章树 + 增删改排序），验证可在 UI 中新增一节并在章节树接口回读成功

## 4. M3 网盘索引

- [x] 4.1 新增 `NetdiskAsset` 表（fsId / path 唯一 / name / ext / size / mtime / assetKind / audience / year / region / series / sectionId / mapSource / mapConfirmed / isPinned / status / candidateSections）与索引，验证 `prisma db push` 成功
- [x] 4.2 实现递归扫描服务（后台任务 + 目录游标 + 断点续扫），验证对 `/apps/高中学习系统` 扫描后索引行数接近 13,254 + 611
- [x] 4.3 实现扫描中断恢复验证：主动中断一次扫描后重新触发，验证不会从根目录重扫且总行数继续累加
- [x] 4.4 实现 `assetKind` / `audience` 自动分类（扩展名 + 关键词 + 广告/垃圾规则），验证抽样 50 条的分类结果与人工判断一致率 ≥ 90%
- [x] 4.5 实现 `year` / `region` / `series` 自动提取，验证含 2026 与省份名的样本均被正确标注、识别不到的字段为空而非默认值
- [x] 4.6 实现自动章节映射（关键词匹配 + 候选列表），验证对「集合的概念」相关样本能写入 `sectionId` 且 `mapSource='auto'`、`mapConfirmed=false`
- [x] 4.7 实现映射工作台接口（按章节/按未映射查询、批量确认、批量改挂、精选、归档、屏蔽），验证批量确认后这些资源出现在章节学生视图中
- [x] 4.8 实现精选上限校验（每节最多 5 条），验证第 6 条返回 400
- [x] 4.9 前端实现资源映射工作台页面（左章节树 / 中资源列表 / 右分类与映射操作），验证可完成"筛未映射 → 批量挂到某节 → 确认"全流程
- [x] 4.10 验证三层收敛效果：抽查 3 个已整理完成的节，确认每节学生视图精选数在 3-5 条且展开更多资源后可分页浏览


### 第 4 组实施记录（M3 网盘索引）

- 数据规模偏差：方案估算「13,254 + 611」来自 v1 时期未完成的扫描（文档分支未扫完）。本次全量扫描实测 **11,178 个目录 / 54,677 个文件**（netdisk_assets 行数，path 唯一无重复计数；含 770 视频、395 音频、602→250 图片、10,366 课件等）。
- 4.1 schema：新增 NetdiskAsset（fsId/path 唯一/name/ext/size/mtime/assetKind/audience/year/region/series/sectionId/mapSource/mapConfirmed/isPinned/status/candidateSections + 5 索引）与 NetdiskScanState（单行断点状态），`prisma validate` 通过、`db push` + generate 成功。
- 4.2 扫描：netdisk-service 新增 `listFilesAll()`（limit=200 + start 翻页）；netdisk-index-service 采用队列式遍历 + 每目录 180ms 限流 + 每目录落库状态（queue/scannedDirs/totalFiles/currentDir），单文件错误跳过不中断。
- 4.3 断点续扫实测：把状态置 paused 且 queue=`["/apps/高中学习系统/视频教学"]` 后触发非 restart 扫描 → 仅从保存队列继续（scannedDirs 11,149→11,178、totalFiles 54,677→55,288，+611 即视频分支），未从根目录重扫。
- 4.4 分类：扩展名优先（video/audio/image/junk）+ 关键词（answer/ppt/practice/exam/plan）+ 垃圾正则（广告/扫码/在线打印/课件说明/版权声明/MathType 等）。跨分页抽样 50 条人工判定 **48/50 = 96%**（≥90%）。
- 4.5 年/地区/系列：`20\\d{2}` 取 2000-2035；地区 34 个关键词；系列 20+ 教辅品牌长词优先。实测「全国/北京/浙江」样本 year+region 正确（2020-2026），series 识别 步步高/必刷题；识别不到写 null（不再填 Unknown）。
- 4.6 自动映射：扫描时按节标题生成 core+tokens，`computeCandidates` 打分（core 命中 4 分、≥3 字 token 2 分、其余 1 分），best≥3 写入 sectionId + mapSource=auto + mapConfirmed=false，并保存 top3 candidateSections。实测 auto 映射 3,873 条。已知局限：视频自带编号（如「2.1 基本不等式」）可能与教材节号不一致，需人工在工作台确认/改挂。
- 4.7 工作台接口：GET /assets（sectionId/unmapped/assetKind/audience/status/q/mapConfirmed/isPinned/分页）、PATCH /assets/:id、POST /assets/batch（confirm/move/pin/unpin/archive/restore/ignore/unmap）、GET /stats、GET /convergence、POST /scan + /scan/pause + GET /scan/status。move 会置 mapSource=manual + mapConfirmed=true。
- 4.8 精选上限：第 6 条返回 400「每节最多精选 5 条资源（本次 N 条，该节已有 M 条）」，第 5 条 200。
- 4.9 前端 /netdisk-index（管理端，侧边栏「学习内容 → 资源映射」）：左章节树（含未映射计数）/ 中资源表（类型、对象、年份、地区、系列、章节、状态、勾选）/ 右批量操作；浏览器实测标题、统计 54,677/3,873/50,804/14、书 5 册、点书→章→节后「目标小节 1」、列表 29 行、勾选后「挂到选中节」成功提示，当前导航 0 console error。
- 4.10 收敛抽检：sections 1（1.1 集合的概念）/19（5.2 三角函数的概念）/9（3.1 函数的概念及其表示）→ 学生可见精选 4/4/4 条（3-5 区间），更多资源 7/2/3 条且分页可用，`/convergence` 三节 ok=true。

## 5. M4 学生端章节化学习

- [x] 5.1 实现学习进度表与记录接口（记录最近学习的节与资源），验证同一学生连续打开两节后「继续学习」指向后一节
- [x] 5.2 实现学生端章节资源查询接口（精选视图 / 更多资源 / 管理视图三档），验证学生视图不返回 `audience=teacher`、`status!=active`、`mapConfirmed=false` 的资源
- [x] 5.3 实现「我的学习」工作台（继续学习 + 待做试卷 + 错题提醒），验证三个区块在有/无数据两种状态下都不报错
- [x] 5.4 实现章节地图页（册 ▸ 章 ▸ 节 + 薄弱标记 + 资源数），验证可展开到节并显示未掌握错题数
- [x] 5.5 实现章节详情页（视频/讲义/练习/试卷四组 + 更多资源 + 本节错题），验证每节都能打开且空节显示占位文案
- [x] 5.6 实现统一资源阅读器：PDF 分支（流代理 iframe，支持 Range），验证打开 PDF 可翻页且 Network 中出现 206 响应
- [x] 5.7 实现阅读器图片分支与视频分支，验证图片可上一张/下一张、视频可播放且拖动进度触发 Range 请求
- [x] 5.8 实现阅读器的 `doc/docx/ppt/pptx` 分支（仅下载 + 提示），验证点击后不会出现 `about:blank` 或整页崩溃
- [x] 5.9 实现学生端导航与路由守卫（6 个入口，管理路径拒绝访问），验证学生直接访问 `/question-bank`、`/difficulty`、`/knowledge-points` 均被跳回「我的学习」
- [x] 5.10 端到端验证：从「我的学习」三步内到达某节并成功打开一份 PDF、一张图片、一个视频，全程 0 console error

### 第 5 组实施记录（M4 学生端章节化学习）

- 5.1 `StudentLearningProgress`（studentId 唯一）+ `POST/GET /api/learning/progress`；实测连续打开 1.1 → 1.3 后 `progress.sectionTitle` 变为「1.3 集合的基本运算」
- 5.2 `learning-service.getSectionResources(sectionId, featured|more|manage)`：featured 每组精选前 5；学生可见条件 `status=active & audience in (student,both) & mapConfirmed=true`；manage 仅 admin（学生 403 已实测）
- 5.3 `Workbench.tsx` 学生分支重写为三区块（继续学习 / 待做试卷 / 错题提醒），数据来自 `/api/learning/workbench`；实测显示继续学习路径、2 条待做试卷，空数据显示占位文案
- 5.4 `ChapterMap.tsx`（`/learning`）：5 册 → 18 章 → 73 节折叠树，节显示资源/试卷/薄弱徽章与「当前」标记；默认展开当前节所在册章
- 5.5 `ChapterDetail.tsx`（`/learning/section/:id`）：四组精选 + 更多资源分页 + 本节试卷 + 本节错题；空节显示占位文案
- 5.6-5.8 `ResourceViewer` 统一阅读器：PDF iframe（`/api/netdisk/file?mode=inline`）、图片 img、视频 `<video>`（`/api/netdisk/stream`）、doc/docx/ppt 仅下载；实测视频 readyState=4、时长 1964s、Network 多次 206 Partial Content；docx 显示下载面板；PDF 渲染 iframe
- 5.9 侧边栏学生项新增「📖 章节学习」；学生访问 `/question-bank` 显示「权限不足」（与既有管理页守卫一致）；`/difficulty`、`/knowledge-points` 路由已在 M1 移除
- 5.10 三步闭环实测：工作台「继续学习」→ 章节详情 → 点击视频卡片打开播放器，全程 0 console error
- 修复项：`ResourceViewer` 的 modal class 原为 `rv-video/rv-pdf` 与内部元素同名导致 `querySelector` 误取；已改为 `rv-kind-<kind>` 前缀 + `rv-video-el`

## 6. M5 章节闭环

- [x] 6.1 为 `ExamPaper` 增加 `section_id` 并支持按册/章/节筛选，验证试卷库筛某节只返回该节试卷
- [x] 6.2 实现批量挂章节（试卷库勾选多份 → 统一挂载），验证返回成功/失败条数且列表章节列更新
- [x] 6.3 解除 `mode=online` 的考试创建与答题路径，仅保留 `mode=whole_paper`，验证创建在线模式返回 400 且学生端不再出现逐题作答入口
- [x] 6.4 为 `VideoResource` 增加 `section_id` 并支持按章节查询与筛选，验证某节视频分组只返回该节已上架资源
- [x] 6.5 为 `StudentWrongQuestion` 增加 `section_id`（录入/编辑可选章节），验证录入时选节后该错题出现在对应章节聚合中
- [x] 6.6 实现错题按章节聚合视图（册/章/节分组 + 未分类组），验证未选章节的错题归入「未分类」
- [x] 6.7 实现章节详情页的「本节试卷」与「本节错题」区块，验证两者数据分别来自整卷考试与错题表且可跳转
- [x] 6.8 章节薄弱标记接入错题数据，验证某节新增一条未掌握错题后章节地图上的该节出现薄弱标记
- [x] 6.9 端到端闭环验证：某节 → 做卷 → 上传答题纸 → 教师批注打分 → 学生看到成绩 → 录入该节错题 → 章节页显示薄弱，全流程无阻断
- [x] 6.10 回归验证：试卷库、答题纸阅卷、学生与班级、学习激励、学习资源 5 个管理页面在改动后仍正常加载且 0 console error


### 第 6 组实施记录（M5 章节闭环）

- 6.1 试卷库新增册/章/节三级筛选（后端 `sectionId` / `chapterId` / `textbookId`，include section→chapter→textbook）；实测 sectionId=1 仅返回挂在该节的 1 份试卷。
- 6.2 新增 `POST /api/paper-library/batch-section`（批量挂载/解除，≤200；sectionId=null 解除）；试卷库表格新增首列 checkbox + 「章节」列 + 批量操作条（已选中 → 章节下拉 → 挂到章节/解除挂载/清空）；浏览器验证级联筛选（册→5 章、章→24 节）与挂载后章节列回显全路径。
- 6.3 停用 `mode=online`：`createExamSession` 对非 whole_paper 返回 400「v2 仅支持整卷考试…」；`listExamSessionsForStudent` 增加 `mode:'whole_paper'`；删除 OnlineExamManagement/TakeExam 页面，`/online-exams`、`/take-exam/:id` 重定向到 `/mock-exams`；MockExam 重写为纯整卷（发布/取消/删除、下载试卷/上传答题纸/查看批改），移除逐题作答、重做、查看答卷与对标分析。学生端浏览器实测仅「下载试卷/上传答题纸」。
- 6.4 VideoResource 支持 `sectionId` 查询/筛选与写入（GET 过滤 + include section/chapter；POST/PUT 接受 sectionId）。
- 6.5 StudentWrongQuestion 支持 sectionId：service 的 Create/Update/Filters 全部透传；WrongQuestionEdit 增加「章节」下拉（listFlatSections，默认未指定）；录入后可在章节聚合中归位。
- 6.6 新增 `GET /api/wrong-questions/grouped`（按册/章/节分组，未挂载归「未分类」，可选 includeMastered）；错题本新增第三个 tab「按章节」，分组卡片显示路径 + 共 N 题 · 未掌握 M + 题干/我的答案/正确答案。
- 6.7 章节详情页「本节试卷」「本节错题」区块在 M4 已实现，本次通过挂载数据打通验证：`GET /learning/sections/1/papers` 返回该卷，页面可跳转查看。
- 6.8 章节薄弱标记：`GET /learning/map` 的 weakCount 接入未掌握错题，E2E 实测 section 1 → paperCount=1、weakCount=1。
- 6.9 端到端闭环已验证（脚本 `tmp-e2e-m5.cjs`）：挂章节 200 → 建整卷考试 201 → 发布 200 → 学生可见 → 章节页出现该卷 → 下载 382,464B → 上传答题纸 201 → 教师批注 88 分 → 学生看到 graded/88/评语 → 录入该节错题 → 地图 weakCount=1；数据已清理（取消发布是 `DELETE /paper-library/:id/unpublish`）。
- 6.10 回归 5 个管理页（/paper-library、/answer-sheets、/students、/incentive、/resources）：全部 200 渲染、无 ErrorBoundary、无「权限不足」；并顺带修复学生访问试卷库时 `loadPublishedMap/loadRecovery` 仍调用 admin 接口导致 403 的问题（加 isAdmin 守卫）。
- 顺带修复：创建整卷考试时 `POST /exam-sessions` 未透传 subjectId 且 service 未继承试卷学科 → 学生端按学科过滤看不到整卷考试；现 route 透传 + service 以 `data.subjectId ?? paper.subjectId` 兜底。

## 7. M6 切换与收尾

- [x] 7.1 全量回归：后端构建、前端构建、`npx jest` 全绿，逐页访问管理端与学生的全部页面确认无 ErrorBoundary
- [x] 7.2 验证 v2 只加表加列：对比 `dev.db` schema，确认无既有列被删除或语义修改
- [x] 7.3 归档本变更的 OpenSpec delta（同步 3 个新 capability 与 6 个修改/4 个移除），验证 `openspec validate --all` 全部通过
- [x] 7.4 合并 `v2` → `main` 并打 tag `v2.0`，验证 `main` 上服务可启动、健康检查 200、学生可登录并进入章节地图
- [x] 7.5 更新部署说明（v1 停服、v2 启动方式、章节种子与网盘扫描的初始化步骤），验证新环境按文档可从零跑起来

### 第 7 组实施记录（M6 切换与收尾）

- 7.1 全量回归通过：后端 tsc 构建无错、前端 vite 构建通过（仅 chunk 体积提示）、`npx jest` 14 suites / 123 tests 全绿；浏览器逐页验证管理员 15 页（/、试卷库、题库管理、题目列表、学生、章节管理、资源映射、模拟考试、答题纸阅卷、学习激励、学科管理、模型管理、网盘绑定、学习资源、资源管理）与学生 8 页（/、章节学习、章节详情、模拟考试、错题本、我的答题纸、学习激励、学习资源），全部无 ErrorBoundary、无「权限不足」、无 console error。
- 7.2 仅新增校验：`git diff v1-final -- backend/prisma/schema.prisma` = 132 insertions / 0 deletions，无既有列被删除或改义。
- 7.3 归档完成：`openspec archive math-chapter-learning --yes`（因 4 个 capability 全量退役，在变更 `.openspec.yaml` 中声明 `retire_capabilities: true`）→ 归档为 `2026-11-09-math-chapter-learning`，spec 同步新增 22 / 修改 2 / 移除 20；`openspec validate --all` 23 passed 0 failed；`openspec list` 无活动变更。
- 7.4 合并与打标：v2 上 6 个原子提交 → `main` 以 `--no-ff` 合并（e85db9c）→ tag `v2.0`；main 上 `/health` 200、学生登录成功、`GET /api/learning/map?subjectId=2` 返回 5 册。
- 7.5 部署说明：`docs/deployment-native.md` 追加「v2 章节化学习版本部署（v2.0）」章节（环境变量、依赖与 db push、seed-subjects/seed-taxonomy 初始化、三服务启动命令、网盘索引初始化四步、从 v1 升级步骤）。
- 顺带修复：学生访问试卷库时 `loadPublishedMap/loadRecovery` 仍调用 admin 接口导致 403（加 isAdmin 守卫）；整卷考试创建未透传/继承学科导致学生端按学科过滤看不到（route 透传 + service 以 `data.subjectId ?? paper.subjectId` 兜底）。
