# Proposal: video-library-netdisk

## Why

系统需要新增「学习资源」板块，收录两类教学内容：

1. **视频教学**：知名学科教学视频，学生/老师在线学习课程章节
2. **教辅材料**：习题库文档（PDF/Word 为主，其他格式为辅），提供路径访问 + 在线查看 + 下载

### 为什么必须走百度网盘开放平台 API（而不是爬分享链接）

前期验证（webfetch + Node 实测）确认直接解析分享页有 3 个不可逾越的障碍：
- iframe 嵌入被 `X-Frame-Options: SAMEORIGIN` 阻止
- 提取码提交需图形验证码（程序无法自动识别，实测 `POST /share/verify` 返回 `errno:2`）
- 密享链接限访问人数，超额无感知失效

**百度网盘开放平台（pan.baidu.com/union）提供了官方出路**：
- 个人开发者实名认证**即时审核完成**，应用选「个人使用」免审核直接上线（限 10 个授权用户，本系统仅管理员 1 人授权，足够）
- OAuth2.0 授权码模式：管理员一次性授权 → access_token（30 天）+ refresh_token（10 年，链式续期）
- xpan API 提供：列目录 / 文件元数据 / **分享链接生成（share API）** / 下载（download API）

管理员已创建应用并备好凭证（AppId 124624558，AppKey/SecretKey/SignKey 已提供）。

### 关键约束（来自官方文档，实测前已确认）

- **目录隔离**：2026-06-03 后创建的应用，download/listall/filemanager/meta/move 等接口**仅能访问 `/apps/{appname}` 目录** → 资源需放入 `/apps/高中学习系统/`
- **dlink 直链播放不可行**：dlink 需特定 UA 头，浏览器 `<video>` 无法自定义 → 视频走「API 生成官方分享链接 → 学生跳转网盘页播放」（合规 + 网盘自带播放器/倍速/字幕）
- **合规边界**：平台协议禁止多人共享个人网盘账号权益 → 视频用分享链接（学生各自浏览器打开，合规）；教辅 PDF/Word 体积小，经 download API 一次性下载到本地存储，系统直接在线查看/下载（完全不依赖学生访问网盘）

## What Changes

### 1. NEW capability: `netdisk-integration`（百度网盘集成）

- 应用凭证配置（管理员在系统设置录入 AppKey/SecretKey/SignKey，存 DB 不硬编码）
- 网盘账号绑定：OAuth 授权跳转 → 回调换 token → 存 access_token/refresh_token/过期时间
- Token 链式自动续期（refresh_token 单次有效，每次刷新存新值）
- 网盘目录浏览（list API 遍历 `/apps/{appname}`，返回目录树）
- 分享链接生成（share API 为视频创建官方分享链接，系统托管自动续建）
- 文件下载（download API 下载教辅文件到本地 `uploads/teaching-materials/`）

### 2. NEW capability: `video-library`（学习资源库）

- 统一资源目录 `VideoResource`：title / subjectId / grade / chapter / resourceType(video|document) / netdiskPath / shareUrl / fileUrl(本地) / fileSize / duration / sort / isActive
- **批量导入**：浏览网盘目录 → 勾选文件/文件夹 → 一键生成资源清单（自动按扩展名识别 video|document），管理员补充分类（学科/年级/章节）
- **视频**：学生点「播放」→ 新窗口打开官方分享链接（系统自动生成/刷新，无密享人数限制问题——失效后一键重生成）
- **教辅**：PDF → 系统内 iframe 在线查看（复用 PaperViewer 思路）+ 下载；Word/其他 → 下载按钮
- 学生端卡片式目录，学科切换器过滤，**全科可见**（用户拍板不设访问权限）

### 3. MODIFIED capability: `admin-dashboard`（系统设置）

- 系统设置分组新增「网盘绑定」入口：绑定状态展示 / 凭证配置表单 / 绑定/解绑按钮 / token 过期提醒

### 4. MODIFIED capability: `subject-management`（学科维度）

- 学习资源支持 subjectId 关联，随学科切换器过滤

## Impact

- **Affected code**: backend（新建 netdisk-service + video-library 路由 + VideoResource/NetdiskConfig 模型 + index.ts 注册）、frontend（新建 NetdiskBinding 设置页 + VideoLibrary 学生页 + VideoManagement 管理页 + 路由 + Sidebar 入口）
- **DB**: 新增 2 表（VideoResource、NetdiskConfig），既有表不动
- **外部依赖**: 百度网盘开放平台 API（需管理员先完成资源文件夹迁移到 `/apps/高中学习系统/`）
- **Breaking**: 无（纯新增能力）
