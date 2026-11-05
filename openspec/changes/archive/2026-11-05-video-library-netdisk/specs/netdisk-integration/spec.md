# Delta Spec: netdisk-integration (NEW)

## Purpose

系统通过百度网盘开放平台官方 API 集成网盘能力：管理员一次性 OAuth 授权后，系统可浏览网盘目录、为视频生成分享链接、下载教辅文件到本地，全程绕开提取码/验证码/密享人数限制。

## ADDED Requirements

### Requirement: 应用凭证配置

系统 SHALL 提供管理端配置界面，允许管理员录入百度网盘开放平台应用凭证（AppKey / SecretKey / SignKey），凭证 SHALL 仅存于数据库（NetdiskConfig 表），禁止硬编码在源码中。

#### Scenario: 首次配置凭证

- GIVEN 管理员已登录且未配置网盘凭证
- WHEN 进入「系统设置 → 网盘绑定」填写 AppKey/SecretKey/SignKey 并保存
- THEN 凭证加密存入库，页面显示「未绑定账号」状态

#### Scenario: 更新凭证

- GIVEN 已配置凭证
- WHEN 管理员修改并保存
- THEN 新凭证生效，原 access_token/refresh_token 清空，需重新绑定

### Requirement: 网盘账号绑定

系统 SHALL 基于 OAuth2.0 授权码模式实现网盘账号绑定：管理员点「绑定」跳转百度授权页 → 授权后回调系统 → 后端用 code 换取 access_token + refresh_token 入库。

#### Scenario: 发起绑定

- GIVEN 已配置应用凭证且未绑定
- WHEN 管理员点「绑定网盘账号」
- THEN 浏览器跳转 `openapi.baidu.com/oauth/2.0/authorize?response_type=code&client_id={AppKey}&redirect_uri={系统回调}&scope=basic,netdisk`

#### Scenario: 授权回调换 token

- GIVEN 管理员已在百度授权页同意授权
- WHEN 百度重定向回系统回调地址带 code
- THEN 后端调 token 接口换取 access_token（30 天有效）+ refresh_token，连同过期时间入库，页面显示「已绑定 + 网盘用户名」

### Requirement: Token 自动续期

系统 SHALL 在 access_token 过期前自动用 refresh_token 换新（refresh_token 单次有效，链式：每次刷新存新 refresh_token）；刷新失败 SHALL 标记「需重新绑定」。

#### Scenario: 自动刷新成功

- GIVEN access_token 距过期不足 1 天
- WHEN 任一需要网盘 API 的请求触发或服务定时检查
- THEN 调 refresh_token 接口换新 access_token + 新 refresh_token 入库，过期时间更新

#### Scenario: refresh_token 失效

- GIVEN refresh_token 已被使用过或授权被用户撤销
- WHEN 系统发起刷新
- THEN API 返回失败，系统标记绑定状态为「需重新绑定」，管理端显示提示

### Requirement: 网盘目录浏览

系统 SHALL 通过 xpan list API 浏览授权账号 `/apps/{appname}` 目录，返回目录树（文件夹 + 文件，含名称/大小/修改时间）。

#### Scenario: 浏览资源目录

- GIVEN 已绑定且 token 有效
- WHEN 管理端请求目录列表（可带路径参数，默认根目录）
- THEN 返回该目录下文件夹与文件清单（名称/大小/是否为目录/modifiedTime）

#### Scenario: token 过期自动续期后重试

- GIVEN access_token 已过期但 refresh_token 有效
- WHEN 目录浏览请求收到 401
- THEN 系统自动刷新 token 后重试一次原请求

### Requirement: 分享链接生成

系统 SHALL 通过 xpan share API 为指定网盘文件创建官方分享链接，链接与资源记录关联存库；分享失效后 SHALL 支持一键重新生成。

#### Scenario: 为视频生成分享链接

- GIVEN 资源记录已有关联的网盘文件路径（fs_id）
- WHEN 管理端对资源点「生成分享链接」或批量导入时自动触发
- THEN 调 share API 创建分享，存 shareUrl + 存 shareId，资源详情可展示

#### Scenario: 分享链接失效重生成

- GIVEN 既有分享链接被网盘侧取消（分享被取消或过期）
- WHEN 管理端点「重新生成」
- THEN 系统重新调 share API 生成新链接替换旧值

### Requirement: 教辅文件下载到本地

系统 SHALL 通过 download API 将教辅类网盘文件（PDF/Word 等）下载到本地 `uploads/teaching-materials/`，并记录本地路径到资源记录；下载支持大文件流式写入。

#### Scenario: 下载 PDF 教辅

- GIVEN 资源类型为 document 且有关联网盘路径
- WHEN 管理端点「下载到本地」或批量导入 document 类型时自动触发
- THEN 文件经 download API（带正确 UA 头）流式下载保存到本地，fileUrl 记录为 `/uploads/teaching-materials/{文件名}`

#### Scenario: 非 apps 目录文件拒绝下载

- GIVEN 网盘文件路径不在 `/apps/{appname}` 目录（老应用限制场景）
- WHEN 发起下载
- THEN 返回 400 提示「该文件不在应用可访问目录，请先移动到 /apps/{appname}」
