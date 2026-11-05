# Design: video-library-netdisk

## Decision 1: 凭证与绑定存 NetdiskConfig 单行表

```
NetdiskConfig (id=1 单行)
  appKey / appSecret / signKey        -- 管理员录入，仅存 DB
  accessToken / refreshToken          -- OAuth 换取
  tokenExpireAt DateTime?             -- access_token 过期时间
  netdiskUk? / netdiskName?           -- 授权账号标识（uk/user_name，展示用）
  boundAt / boundBy                   -- 绑定时间与操作人
  status: unconfigured | unbound | bound | expired
```

- 否决硬编码：凭证进 git 历史是安全事故，且换应用要改代码重部署
- 用户已在本对话提供 4 个凭证 → 实施时由实施者写入 DB（不入库到代码/文档）

## Decision 2: VideoResource 统一双类型目录

```
VideoResource
  id / title / description?
  subjectId Int?      → Subject（可空=全科可见；复用学科切换器过滤）
  grade String?       -- 高一/高二/高三
  chapter String?     -- 第3章 函数（自由文本）
  resourceType        -- video | document
  netdiskPath String? -- 网盘路径（/apps/.../xxx.mp4）
  fsId Int?           -- 网盘文件 fs_id（分享/下载 API 用）
  shareUrl String?    -- 视频播放用
  fileUrl String?     -- 本地下载路径（/uploads/teaching-materials/...）
  fileSize Int? / duration Int? / coverUrl?
  playCount Int @default(0) / viewCount Int @default(0)
  sort Int @default(0) / isActive Boolean @default(true)
  createdById / createdAt / updatedAt
  @@index([subjectId, resourceType, isActive])
```

- 单表双类型（而非 VideoResource + DocumentResource 两表）：分类维度/导入/列表逻辑 90% 重叠，单表 + resourceType 枚举足够，避免双份 CRUD
- 文件类型识别：mp4/mkv/mov/avi/flv/ts → video；pdf/doc/docx/xls/xlsx/ppt/pptx/txt/zip → document

## Decision 3: 视频=分享链接托管，教辅=下载本地

| 类型 | 来源 | 学生访问方式 | 理由 |
|------|------|-------------|------|
| video | 留网盘 | share API 生成官方分享链接 → 新窗口打开 | 体积大不下本地；合规（学生各自打开）；网盘播放器体验完整 |
| document | 下载到本地 | 复用查看器：PDF iframe；其他下载 | 体积小；在线查看体验优于跳转；脱离网盘可用 |

- dlink 直播方案明确否决（UA 头 + 8h 时效 + 代理带宽 + 共享账号合规风险）
- document 下载时机：导入时管理员勾选「同步下载到本地」自动下；或详情页手动点「下载到本地」

## Decision 4: 批量导入流程

```
管理端「从网盘导入」
  → 浏览目录树（xpan list 逐级加载 /apps/{appname}）
  → 勾选文件或文件夹（文件夹递归展开）
  → 点导入
  → 后端遍历所选：去重（netdiskPath 唯一）→ 识别类型 → 批量 create
  → video 自动调 share API 生成分享链接（失败记录原因不阻塞）
  → document 按勾选自动触发本地下载（后台逐一下，失败可重试）
  → 返回统计：新增/跳过/分享失败/下载失败
```

- 导入前管理员可在弹窗统一指定 subjectId/grade（批量赋值，导入后再逐条微调）
- netdiskPath 加 `@@unique` 天然幂等，重复导入自动跳过

## Decision 5: Token 链式刷新

- 每次刷新响应返回新 refresh_token（旧的一次性作废）→ 必须「先存新值再丢弃旧值」
- 触发时机：任一 API 调用遇 401 → 刷新 → 重试一次；另加每日定时检查（过期 <24h 主动刷）
- 刷新接口并发锁（模块级 Promise，防多请求同时刷新互相覆盖）

## Decision 6: 前端路由与入口

| 路由 | 页面 | 权限 |
|------|------|------|
| `/resources` | 学习资源库（学生/老师共用，卡片+详情） | 登录即可 |
| `/resources/manage` | 资源管理（列表+导入+编辑+统计） | requireAdmin |
| `/settings/netdisk` | 网盘绑定（凭证表单+绑定状态+目录浏览入口） | requireAdmin |

- Sidebar：学生分组加「📺 学习资源」；系统设置分组加「☁️ 网盘绑定」；考试管理不加
- 详情页内嵌在 `/resources/:id`（视频→打开分享链接按钮+元数据；文档→iframe/下载）

## Decision 7: 播放/查看统计

- 计数字段直接放资源行（playCount/viewCount），不建独立事件表（MVP 够用，避免又造死表）
- 防抖：资源维度+学生维度 5 分钟窗口（内存 Map 即可，重启清零可接受）

## Risks

| 风险 | 缓解 |
|------|------|
| 网盘 API 限流/封禁 | 个人使用额度对校内场景足够；导入/分享操作频率低；失败有明确报错 |
| 资源文件夹未移入 /apps/{appname} | 绑定后加「目录检查」：list 返回空或非 /apps 前缀时给出醒目指引 |
| share API 生成的分享被网盘侧风控 | 链接失效可一键重建；播放页有「链接失效」反馈入口 |
| access_token 并发刷新冲突 | 模块级刷新锁 + 「先存新 refresh_token」顺序保证 |
| 老应用无 /apps 限制但用户应用是新建 → 严格受限 | design 已按受限设计（所有文件操作限定 /apps/{appname}） |

## Migration

- 纯新增 2 表 + 前端 3 页 + 后端 2 路由模块，无存量数据迁移
- 实施后管理员需自行完成：网盘网页端把资源文件夹移入 `/apps/高中学习系统/`
