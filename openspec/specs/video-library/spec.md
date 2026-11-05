# video-library

## Purpose

学习资源库统一收录视频教学与教辅文档两类内容：视频经网盘分享链接跳转播放，教辅下载到本地后系统内在线查看/下载，支持从网盘目录批量导入清单并按学科/年级/章节分类，学生端全科可见。

## Requirements
### Requirement: 资源目录管理

系统 SHALL 提供教学资源目录（VideoResource 表），字段含 title/subjectId/grade/chapter/resourceType(video|document)/netdiskPath/fsId/shareUrl/fileUrl/fileSize/duration/sort/isActive，管理端支持增删改查、上架/下架、排序调整。

#### Scenario: 新建资源

- GIVEN 管理员已登录
- WHEN 在资源管理页填写标题/类型/学科/年级/章节并保存
- THEN 资源入库 status 上架，学生端立即可见

#### Scenario: 下架资源

- GIVEN 资源已上架
- WHEN 管理员点「下架」
- THEN isActive=false，学生端不再展示，管理端仍可见

### Requirement: 网盘批量导入

系统 SHALL 支持从网盘 `/apps/{appname}` 目录批量导入：浏览目录树 → 勾选文件/文件夹 → 一键生成资源记录（自动按扩展名识别 resourceType：mp4/mkv/mov→video，pdf/doc/docx/xlsx/ppt→document，其余归为 document 仅下载），管理员可在导入后批量补充分类字段。

#### Scenario: 导入文件夹生成清单

- GIVEN 网盘已绑定且 /apps/{appname} 下有「高三数学」文件夹含 5 个 mp4 + 3 个 pdf
- WHEN 管理员勾选该文件夹点「导入」
- THEN 生成 8 条资源记录（5 video + 3 document），netdiskPath/fsId/fileSize 自动填充，默认 isActive=true，subjectId 取当前学科切换器值

#### Scenario: 重复导入去重

- GIVEN 某网盘路径已存在资源记录
- WHEN 再次导入同一文件
- THEN 跳过已存在记录，返回导入统计（新增 N 条 / 跳过 M 条）

### Requirement: 视频播放

视频类资源 SHALL 提供「播放」入口：优先使用系统托管的分享链接新窗口打开网盘播放页；无分享链接时 SHALL 提示管理员先生成。

#### Scenario: 正常播放

- GIVEN 视频资源已有 shareUrl
- WHEN 学生点「播放」
- THEN 新窗口打开网盘分享页（自带播放器/倍速/字幕），系统内记录本次播放次数

#### Scenario: 缺失分享链接

- GIVEN 视频资源无 shareUrl
- WHEN 学生点「播放」
- THEN 提示「资源链接未配置，请联系管理员」；管理端该资源显示「生成链接」按钮

### Requirement: 教辅在线查看与下载

document 类资源 SHALL 支持：PDF 在系统内 iframe 在线查看；所有 document 提供下载按钮（本地下载优先，未下载到本地时回退网盘分享链接）。

#### Scenario: PDF 在线查看

- GIVEN PDF 资源已下载到本地（fileUrl 指向 /uploads/teaching-materials/）
- WHEN 学生点「查看」
- THEN 系统内打开查看器（iframe 加载 PDF），头部展示标题与元数据，可切下载

#### Scenario: Word 文档下载

- GIVEN Word 类资源（无在线预览能力）
- WHEN 学生点「下载」
- THEN 浏览器下载本地文件；本地不存在时跳转网盘分享页

### Requirement: 学生端资源浏览

学生端 SHALL 提供学习资源页：卡片式目录展示（封面/标题/类型角标/时长/大小），按学科切换器过滤（带 subjectId 的资源仅对应学科可见，无 subjectId 的全科可见），支持按类型（视频/文档）与关键字筛选，点击卡片进入详情。

#### Scenario: 按学科浏览

- GIVEN 学生当前学科为数学
- WHEN 打开学习资源页
- THEN 展示数学学科 + 未指定学科的资源卡片

#### Scenario: 类型筛选

- GIVEN 资源列表含视频与文档
- WHEN 学生筛选「视频」
- THEN 仅展示 resourceType=video 的资源

### Requirement: 资源播放/查看统计

系统 SHALL 记录每条资源的播放次数（视频）与查看/下载次数（文档），管理端列表展示，用于发现热门资源。

#### Scenario: 播放计数

- GIVEN 学生点击视频播放
- THEN 该资源 playCount +1（同一学生 5 分钟内重复点击只计 1 次）
