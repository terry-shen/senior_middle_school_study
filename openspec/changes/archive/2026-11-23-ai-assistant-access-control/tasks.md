## 1. 数据与安全基线

- [x] 1.1 `schema.prisma` 的 `Student` 增加 `aiAssistantEnabled Boolean @default(false) @map("ai_assistant_enabled")`，执行 `npx prisma db push` 与 `npx prisma generate` — 验证：SQLite `students` 表存在该列且存量行值为 0
- [x] 1.2 `routes/auth.ts` 与 `services/auth-service.ts` 固定注册角色为 `student`，忽略请求体 `role` — 验证：携带 `role: "admin"` 注册后返回的账号角色仍为 `student`
- [x] 1.3 注册、登录、`GET /api/auth/me` 的返回体增加 `aiAssistantEnabled`，前端 `User` 类型同步 — 验证：三个接口响应字段齐全，前端 `tsc` 通过

## 2. 后端权限

- [x] 2.1 `permission.ts` 的 `requireAuth` 把 `aiAssistantEnabled` 映射进 `req.user` — 验证：受保护接口内可读到最新值（切换后下一次请求即变化）
- [x] 2.2 `routes/students.ts` 的 `sanitize` 返回该字段，并新增管理员专用 `PATCH /api/students/:id/ai-access` — 验证：管理员调用 200 且值持久化；学生调用 403；学生不能通过 `PUT /api/students/:id` 修改该字段
- [x] 2.3 `routes/ai-assistants.ts` 的 `GET /` 对未授权学生返回 403，管理员始终放行 — 验证：未授权学生的令牌请求返回 403；管理员令牌返回列表

## 3. 前端

- [x] 3.1 `Sidebar.tsx` 仅在 `user.role === 'admin' || user.aiAssistantEnabled` 时渲染学生「AI 助理」入口 — 验证：开关前后导航项出现/消失
- [x] 3.2 `AiAssistants.tsx` 对未授权学生展示“该功能未开放”提示和返回工作台链接，不渲染目录 — 验证：未授权学生直接访问 `/ai-assistants` 看不到卡片
- [x] 3.3 `StudentManagement.tsx` 学生表格增加「AI 助理」开关并调用新接口 — 验证：切换后刷新列表状态保持，只影响当前学生

## 4. 验证

- [ ] 4.1 后端 `npm --prefix backend run build` 与现有测试通过 — 验证：命令退出码 0
- [x] 4.2 前端 `npm --prefix frontend run build` 与 `npm --prefix frontend run lint` 通过 — 验证：命令退出码 0
- [x] 4.3 API 回归：注册提权被拒、未授权 403、授权后 200、关闭后下一次 403、管理员不受影响 — 验证：逐条请求结果符合预期
- [x] 4.4 浏览器回归：管理员学生列表可切换；已授权学生登录可见入口；未授权学生登录无入口且直接访问被拦截 — 验证：两种账号实测

## 5. 管理员入口与行级约束

- [x] 5.1 管理员侧边栏「系统设置」组增加「AI 助理」入口 — 验证：管理员登录可见并进入 `/ai-assistants`
- [x] 5.2 学生列表中管理员行的开关替换为「管理员默认可用」 — 验证：管理员行不可点击，学生行仍可切换

## 实施记录

- 1.1：`students` 表新增 `ai_assistant_enabled`，`db push` 成功；存量 `admin1` 与 `2026001` 均为 `false`。
- 1.2-1.3：注册路由不再传递 `role`，服务层固定 `student`；注册/登录/`me` 返回 `aiAssistantEnabled`。
- 2.1-2.3：`req.user` 全链路补齐字段；`PATCH /api/students/:id/ai-access` 仅管理员；未授权学生请求列表返回 403。
- 3.1-3.3：侧边栏按授权显示；未授权页面显示提示；学生列表新增开关。
- 4.1：`npm run build` 退出码 0。`npm test` 有 8 个套件、83 项通过；6 个旧套件因引用已删除的 `llm-service` / `paper-metadata-service` 无法加载（TS2307），与本次变更无关，保留未勾选。
- 5.1-5.2：管理员侧边栏新增「AI 助理」入口；管理员行显示「管理员默认可用」且无开关；Playwright 验证管理员可进入 `/ai-assistants`，学生行开关保留。

