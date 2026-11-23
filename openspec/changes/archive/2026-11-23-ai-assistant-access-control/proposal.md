## Why

当前所有登录学生都能看到「AI 助理」导航并打开外部 AI 站点，无法按学生关闭入口。部分学生利用该入口作弊或进行与学习无关的交互，管理员需要一个按学生控制的开关。同时注册接口会把请求体中的 `role` 原样传给账号创建逻辑，存在学生自封管理员的提权风险，必须一并修复。

## What Changes

- 学生新增 `aiAssistantEnabled` 访问开关，默认关闭；存量学生和新注册学生均为关闭状态
- 管理员在学生列表中逐个开放/关闭某个学生的 AI 助理权限（不做班级批量）
- 学生登录态返回该开关；未开放的学生侧边栏不显示「AI 助理」，直接访问 `/ai-assistants` 时被拦截
- 后端 `GET /api/ai-assistants` 对未开放的学生返回 403，管理员始终放行
- **BREAKING**：新注册账号固定为 `student` 角色，注册请求中的 `role` 字段不再生效
- 不做使用统计、时长、交互记录、APK 改动或网络层封锁；本次只控制站内入口与接口访问

## Capabilities

### New Capabilities

- `ai-assistant-access`: 按学生控制 AI 助理入口的可见性与后端访问权限，包含默认关闭、管理员逐个授权、导航/路由/接口三层拦截

### Modified Capabilities

- `student-management`: 自助注册固定创建学生角色；学生记录与登录态新增 `aiAssistantEnabled` 字段
- `admin-dashboard`: 学生侧边栏的「AI 助理」入口由授权状态决定，未授权时不显示

## Impact

- 数据库：`students` 表新增 `ai_assistant_enabled`（默认 `false`）
- 后端：`prisma/schema.prisma`、`services/auth-service.ts`、`routes/auth.ts`、`routes/students.ts`、`routes/ai-assistants.ts`、`middleware/permission.ts`
- 前端：`services/auth-api.ts`、`components/Sidebar.tsx`、`App.tsx`、`pages/AiAssistants.tsx`、`pages/StudentManagement.tsx`
- 测试：注册角色固定、未授权 403、管理员放行、开关切换
- 无新增依赖；无 APK 改动
