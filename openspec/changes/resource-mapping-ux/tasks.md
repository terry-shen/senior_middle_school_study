## 1. 后端：目录级能力

- [x] 1.1 `netdisk-index-service.ts` 新增 `getDirectoryStats()`：按路径第 4/5 段聚合 active 资源，返回 `{dir,total,teacher,studentOrBoth,kinds}` 降序，60 秒缓存 — 验证：调用后 `教辅资料合集` 计数约 28,927
- [x] 1.2 `netdisk-index-service.ts` 新增 `batchDirectoryAction(dir, action)`：`path startsWith dir + '/'` 批量 archive/ignore/restore，返回 `affected` — 验证：对测试子目录执行后再查 `status` 全变
- [x] 1.3 目录参数校验：必须以 `/apps/高中学习系统` 开头、trim 末尾斜杠，非法返回 400 — 验证：传 `/etc` 得到 400
- [x] 1.4 `routes/netdisk-index.ts` 新增 `GET /directories`、`POST /directories/action`（requireAuth+requireAdmin）— 验证：`curl` 返回 200 且结构含 `dir/total/teacher/studentOrBoth`

## 2. 后端：单节收敛与可见性

- [x] 2.1 新增 `getSectionConvergenceDetail(sectionId)`：返回 `mapped`（已挂，含 isPinned/status）、`candidates`（未挂载 active 资源按节标题打分 ≥3 的前 20 条，附命中关键词）、`metrics`（pinned/visible/more/ok）— 验证：对 `1.1 集合的概念` 调用，candidates 非空且带 reason
- [x] 2.2 候选打分复用现有 `computeVideoCandidates` / `computeCandidates`，不在前端重算 — 验证：候选 reason 与映射日志口径一致
- [x] 2.3 学生端预览数据复用 `learning-service.getSectionResources` 的 featured 与 more 计数 — 验证：预览数量与学生页面实际渲染数量一致
- [x] 2.4 `listAssets` 返回每条资源新增 `visibility` 字段（visible/unmapped/unconfirmed/teacher/archived/ignored）— 验证：抽样 5 条与前端旧状态列推导结果一致
- [x] 2.5 新增 `GET /sections/:id/convergence` 路由（requireAuth+requireAdmin）— 验证：200 且含 mapped/candidates/metrics

## 3. 后端：撤销

- [x] 3.1 批量 ignore / unmap / 目录 ignore 前记录旧值快照，生成 `undoToken`（单次 ≤5,000 条，最多保留 10 个，60 秒过期）— 验证：执行后响应含 `undoToken`
- [x] 3.2 新增 `POST /undo/:token` 恢复快照 — 验证：执行 ignore 后撤销，资源回到原 `status/sectionId/isPinned`
- [x] 3.3 过期或未知 token 返回 410 并提示已失效 — 验证：等待 TTL 后调用得到 410

## 4. 前端：API 与页面骨架

- [x] 4.1 `netdisk-index-api.ts` 新增 `getDirectoryStats` / `directoryAction` / `getSectionConvergence` / `undoBatch` 及类型 — 验证：`tsc` 无错
- [x] 4.2 `NetdiskMapping.tsx` 顶部新增四个 Tab（单节收敛 / 未映射收件箱 / 目录清理 / 高级表格），默认单节收敛 — 验证：切换 Tab 时 URL 保持不变且内容切换
- [x] 4.3 高级表格 Tab 保留现有三栏实现，新增「学生可见」列渲染 `visibility` 徽章 — 验证：表格可见 6 种徽章文案

## 5. 前端：三个新视图

- [x] 5.1 单节收敛视图：左侧章节树（保留学科分组），中间候选/已挂列表，右侧学生端预览 — 验证：选 `1.1 集合的概念` 后三栏均有数据
- [x] 5.2 单节收敛操作：勾选候选 →「加入本节」；已挂项可「设为精选 / 取消精选 / 归档 / 解除映射」，每次操作后刷新 metrics 与预览 — 验证：设为精选后预览精选数 +1
- [x] 5.3 每节状态灯：pinned 3–5 显示达标（绿），否则未达标（橙），并在章节树节点显示计数 — 验证：故意取消精选后状态变橙
- [x] 5.4 未映射收件箱：默认过滤 `audience in (student,both)` + active，提供「含教师资源」开关；每行显示锁定状态与预计可见性 — 验证：开关前后行数明显变化（约 25,777 vs 38,843）
- [x] 5.5 目录清理视图：目录卡片显示总数/教师数/学生数/类型分布，操作「归档 / 屏蔽 / 恢复」，执行前确认弹窗显示受影响条数 — 验证：对测试子目录归档，数字随之下降
- [x] 5.6 目录清理按数量降序，`教辅资料合集` 排首位 — 验证：首行目录名与计数正确

## 6. 前端：操作语义与反馈

- [x] 6.1 批量按钮按「归属 / 可见性 / 展示 / 隐藏」分组，每个按钮下显示一行效果说明（含"是否影响学生端"）— 验证：教师资源选中时显示"不影响学生端"
- [x] 6.2 危险操作（屏蔽 / 解除映射）移入行内「⋯」次级菜单并二次确认 — 验证：主按钮区不再出现这两个动作
- [x] 6.3 操作成功显示带条数的提示，并在 5 秒内提供「撤销」— 验证：点击撤销后列表恢复
- [x] 6.4 空态与错误态明确文案（无候选、目录已清空、网盘不可达）— 验证：三个视图的空态均不显示裸 0

## 7. 验证

- [x] 7.1 `npm --prefix backend run build` 与 `npm --prefix frontend run build` 均通过，后端重启后 `/health` 200
- [x] 7.2 API 回归：`/directories`、`/directories/action`、`/sections/:id/convergence`、`/undo/:token` 全部 200/预期错误码
- [x] 7.3 浏览器验证（admin1）：四个 Tab 均可切换；单节收敛完成"加入本节 → 设为精选 → 预览更新"闭环；目录清理完成一次归档+恢复
- [x] 7.4 学生端不受影响：`/learning/math` 与 `/learning/section/1` 精选/更多数量与操作前一致（仅当管理员主动改动时才变化）
- [x] 7.5 控制台 0 error / 0 warning，页面无 ErrorBoundary

## 实施记录

- 后端新增：`getDirectoryStats`（60 秒缓存、根下两级聚合）、`batchDirectoryAction`（路径前缀 archive/ignore/restore）、`getSectionConvergenceDetail`（已挂资源 + 候选打分 + 指标）、`computeVisibility`、`undoBatch`（内存快照 60 秒 / 单次 ≤5000 / 最多 10 个 token）
- 后端路由：`GET /directories`、`POST /directories/action`、`GET /sections/:id/convergence`（含 `preview`，复用 `learning.getSectionResources`）、`POST /undo/:token`；`listAssets` 支持 `audienceGroup=student` 并返回 `visibility`
- 前端：`NetdiskMapping.tsx` 重写为四 Tab（单节收敛 / 未映射收件箱 / 目录清理 / 高级表格）+ 撤销条；`netdisk-index-api.ts` 新增目录、收敛、撤销与新类型；CSS 追加三视图样式
- 实测：目录首位 `教辅资料合集 33,225 条（教师 11,048 / 学生通用 22,177）`；收件箱默认 25,777（student+both、active）→ 勾选含教师后 38,843；单节收敛 `1.1 集合的概念` 达标（精选 4 / 可用 44 / 更多 40），预览主线视频 3 + 练习 1，与学生端一致；撤销 200、过期 token 410；`/learning/section/1` 仍为「精选 4 · 更多 40」未受影响
- 构建：backend tsc 通过、frontend vite 181ms 通过；控制台仅登录前 `/auth/me` 401（预期）

## 8. 用户反馈增强（实施后追加）

- [x] 8.1 未映射收件箱新增「学科」自动识别列与学科筛选下拉（/assets 支持 subjectCode，内存分页）— 验证：全部 25,777 条；地理 1,762 条、数学 5,019 条，学科列显示正确
- [x] 8.2 目标小节下拉按学科分组（optgroup），label 为「学科 → 教材 / 章 / 节」— 验证：5 个学科分组、408 个小节选项
- [x] 8.3 支持手工新建教材小节（学科 → 教材 → 章 → 名称），创建后自动选中为目标小节 — 验证：新建测试小节提示成功、下拉自动选中 id=410，删除后 200
- [x] 8.4 表格与列表全部左对齐，并补充新建小节弹窗样式 — 验证：表头与单元格 computed text-align 均为 left
- [x] 8.5 双端构建通过、后端重启 /health 200、控制台 0 error

### 增强记录

- 后端：AssetFilters 增加 subjectCode；listAssets 指定学科时按 detectSubjectFromText(path) 或 name 过滤后内存分页，并在每行返回 subjectCode
- 前端：netdisk-index-api.ts 增加 subjectCode 筛选参数与行字段；NetdiskMapping.tsx 收件箱改为「学科筛选 + 学科列」，目标小节下拉按学科 optgroup 分组，新增 CreateSectionModal（复用 chapters-api.createSection），创建成功后 reloadTaxonomy 并自动选中所建小节
- 样式：NetdiskMapping.css 追加表头单元格左对齐、nm-check、nm-modal、nm-form-row 等
- 修复：NetdiskMapping.tsx 缺失的 CSS 导入（此前样式未加载导致居中）
