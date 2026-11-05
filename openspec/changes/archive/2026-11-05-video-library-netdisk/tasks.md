# Tasks: video-library-netdisk

## G1: DB schema

- [x] 1.1 schema.prisma 新增 NetdiskConfig 模型（单行凭证+token+status，status 枚举字符串）
- [x] 1.2 schema.prisma 新增 VideoResource 模型（D2 全字段 + netdiskPath @@unique + 索引）
- [x] 1.3 npx prisma db push + generate（杀 node 解 DLL 锁）
- [x] 1.4 写入 NetdiskConfig 初始行（用户提供的 AppId 124624558/AppKey/SecretKey/SignKey，status=unbound；凭证值仅入 DB，禁止写入代码/文档）

## G2: 后端网盘服务与路由

- [x] 2.1 netdisk-service.ts：saveConfig / getConfig / buildAuthorizeUrl（OAuth URL 生成）
- [x] 2.2 netdisk-service.ts：handleCallback(code) → token 接口换 access_token+refresh_token 入库（uk/user_name 获取）
- [x] 2.3 netdisk-service.ts：ensureToken() 链式刷新 + 模块级刷新锁 + 「先存新 refresh_token」顺序
- [x] 2.4 netdisk-service.ts：listFiles(dir) 目录浏览（/apps/{appname} 前缀强制 + 401 自动刷新重试）
- [x] 2.5 netdisk-service.ts：createShare(fsIdList) 分享生成 + saveLocalFile(fsId, filename) 流式下载（UA 头）
- [x] 2.6 routes/netdisk.ts：PUT /api/netdisk/config（admin 凭证保存）/ GET /api/netdisk/status / GET /api/netdisk/authorize-url / GET /api/netdisk/callback / POST /api/netdisk/unbind / GET /api/netdisk/files?dir=
- [x] 2.7 routes/netdisk.ts：POST /api/netdisk/share（body: resourceIds）批量生成分享 + POST /api/netdisk/download（body: resourceIds）批量下载到本地
- [x] 2.8 index.ts 注册 netdisk 路由 + 每日定时刷新检查（node-cron 或启动时 setInterval，轻量）

## G3: 后端资源库服务与路由

- [x] 3.1 video-library-service.ts：CRUD + 分页列表（withSubjectParam 复用 + subjectId null 全科可见过滤规则）
- [x] 3.2 importFromNetdisk(dir/fsIds, 默认分类) 批量导入：去重（netdiskPath unique）→ 类型识别 → create → video 自动 share → document 按勾选下载
- [x] 3.3 routes/video-library.ts：GET /api/video-resources（学生/管理共用，subjectId/type/keyword 筛选 + 分页）/ GET /:id / POST（admin）/ PUT /:id（admin）/ DELETE /:id（admin 软下架/硬删）
- [x] 3.4 routes/video-library.ts：POST /api/video-resources/import（admin，body: dir 或 fsIds + subjectId/grade/chapter 默认值 + downloadDocuments 开关）
- [x] 3.5 播放/查看计数：POST /api/video-resources/:id/play（防抖 5 分钟/学生/资源）
- [x] 3.6 index.ts 注册 video-library 路由

## G4: 前端 API 与页面

- [x] 4.1 services/netdisk-api.ts：配置保存/状态/授权跳转/解绑/目录浏览/批量分享/批量下载 函数与类型
- [x] 4.2 services/video-library-api.ts：资源 CRUD/导入/列表/详情/计数 函数与类型
- [x] 4.3 pages/NetdiskBinding.tsx+.css：凭证表单 + 绑定状态卡片 + 授权跳转按钮 + 解绑 + 目录浏览弹窗（树形懒加载）
- [x] 4.4 pages/VideoLibrary.tsx+.css：学生端卡片目录（封面占位/类型角标/时长/大小/播放查看计数）+ 筛选（学科切换器 + 类型 + 关键字）+ 详情区（视频→播放按钮；PDF→iframe；文档→下载）
- [x] 4.5 pages/VideoManagement.tsx+.css：管理端表格（标题/类型/学科/年级/章节/链接状态/本地状态/计数/操作）+ 编辑表单 + 「从网盘导入」弹窗（目录树勾选 + 默认分类 + 导入选项）+ 生成分享/下载到本地/下架
- [x] 4.6 App.tsx 路由（/resources /resources/manage /settings/netdisk）+ Sidebar 入口（学生加「📺 学习资源」、系统设置加「☁️ 网盘绑定」）

## G5: 验证

- [x] 5.1 后端 npm run build 编译通过 + 前端构建通过
- [x] 5.2 重启后端 health 200
- [x] 5.3 API E2E：保存凭证 → authorize-url 生成 → （回调因需真实百度授权，测试到换 token 函数 mock code 路径）→ listFiles mock → 导入去重 → 分享生成 mock → document 下载 mock
- [x] 5.4 浏览器：管理端绑定页渲染 + 资源管理导入弹窗 + 学生端资源列表渲染（0 console errors）
- [x] 5.5 回归：既有 19 页抽样（/ /mock-exams /paper-library /online-exams /students）无 ErrorBoundary
