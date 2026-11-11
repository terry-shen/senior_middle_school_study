# 高中学习系统 · 容器化部署运维（阿里云 ECS）

## 1. 访问地址

- 应用：`http://106.15.136.254:5173/`（宿主机 5173 端口，需安全组放行）
- 健康检查：`http://106.15.136.254:5173/api`（返回接口清单）、容器内 `/health`
- 账号：`admin1 / admin123`（管理员）、`2026001 / student123`（学生）

> 宿主机 3000/4000/8083 已被既有 Grafana、TeslaMate、Calibre-Web 占用，本站使用 5173 端口，不冲突。

## 2. 目录结构

```
/www/highschool-system
├── docker-compose.yml        # api + web 两个服务
├── Dockerfile.api            # 多阶段：npm ci → prisma generate → tsc → 运行层
├── Dockerfile.web            # nginx + 前端 dist
├── .env                      # JWT_SECRET（勿提交仓库）
├── deploy/nginx.conf         # SPA + /api + /uploads 反代（关闭缓冲，支持视频 Range）
├── deploy/backup.sh          # 备份脚本
├── backend/{src,prisma,...}  # 构建 api 镜像用
├── frontend/dist             # 前端构建产物（本地构建后上传）
└── data/
    ├── db/dev.db             # SQLite（卷挂载到 /app/data）
    ├── uploads/              # 试卷/答题纸/知识点文档（挂载到 /app/uploads）
    └── logs/
```

## 3. 常用命令

```bash
cd /www/highschool-system
docker compose ps                 # 状态（api 应为 healthy）
docker compose logs -f api        # 后端日志
docker compose logs -f web        # nginx 日志
docker compose restart api        # 重启后端
docker compose up -d              # 应用配置变更
docker stats --no-stream          # 资源占用（api 限额 700M）
```

## 4. 备份与恢复

```bash
# 手动备份（会短暂停止 api 约 3-5 秒，保证 SQLite 一致）
/www/highschool-system/deploy/backup.sh

# 每天 03:00 自动备份
echo '0 3 * * * /www/highschool-system/deploy/backup.sh >> /www/highschool-system/backups/cron.log 2>&1' | crontab -

# 恢复
cd /www/highschool-system
docker compose stop api
tar -xzf backups/data-YYYYmmdd-HHMMSS.tar.gz -C /tmp/restore
cp /tmp/restore/db/dev-*.db data/db/dev.db
docker compose start api
```

## 5. 升级（本地构建 → 上传 → 重建）

```powershell
# 本地：构建前端 + 打包代码与数据
npm run build --prefix frontend
# 上传 code.tar.gz 后在服务器执行
```
```bash
cd /www/highschool-system
tar -xzf code.tar.gz && rm code.tar.gz
docker compose build && docker compose up -d
docker image prune -f                 # 清理旧层，磁盘只有 19G 余量
```

## 6. 关键环境变量（.env）

| 变量 | 说明 |
|---|---|
| `JWT_SECRET` | 必填，登录令牌签名密钥（已随机生成） |
| `DATABASE_URL` | compose 内固定 `file:/app/data/dev.db` |
| `MINERU_DISABLED` | 云端固定 `1`：不探测 MinerU CLI、不自启本地解析服务 |
| `CORS_ORIGIN` | 同源访问留空即可；如需跨域填源地址，逗号分隔 |

## 7. 与本地环境的已知差异

1. **云端无 MinerU**：试卷导入不再做公式 OCR，PDF/Word 退回纯文本抽取（选择题题干仍可用，复杂公式会丢失）。既有试卷、章节、资源数据不受影响。
2. **百度网盘**：access_token 已随数据库迁移，仍可刷新；但 OAuth 回调地址记录的是 `localhost:3000`，将来需要重新授权时，要把开放平台回调改成公网地址并更新「系统设置 → 网盘绑定」中的回调字段。
3. **无域名/HTTPS**：直接 IP + HTTP；小红书/网盘等外链功能不受影响，但浏览器会提示非安全连接。
4. **外链 AI 助理**（豆包/DeepSeek/WorkBuddy）在新标签打开官网，登录态由各站点自己保存，与本站无关。

## 8. 故障排查

| 现象 | 处理 |
|---|---|
| 502 Bad Gateway | `docker compose ps` 看 api 是否 healthy；`docker compose logs api` |
| api 反复重启 | 多为 `JWT_SECRET` 缺失或 `data/db` 权限问题 |
| 页面白屏 | 确认 `frontend/dist` 已上传且 `docker compose build web` 重建过 |
| 上传 413 | 调大 `deploy/nginx.conf` 的 `client_max_body_size` 后重建 web |
| 磁盘不足 | `docker image prune -f && docker builder prune -f` |


## 9. v3 精简版（章节学习）部署要点

### 9.1 版本定位
v3 只保留「章节学习」主线：学科一级导航 → 视频课程主线 → 教材小节资源。
已下线：试卷库 / 题库管理 / 题目列表 / 模拟考试 / 在线测验 / 答题纸阅卷 / 错题本 / 学习激励 / 学科管理 CRUD / LLM 模型管理 / Prompt 模板 / 旧视频库。
数据库仅保留 13 张表（Class/Student/Subject/Session/NetdiskConfig/Textbook/Chapter/Section/NetdiskAsset/NetdiskScanState/StudentLearningProgress/AiAssistant/StudentAssetOpen）。

### 9.2 PUBLIC_BASE_URL
```bash
# /www/highschool-system/.env
PUBLIC_BASE_URL=http://106.15.136.254:5173
```
用于生成百度网盘 OAuth 回调地址（`${PUBLIC_BASE_URL}/api/netdisk/callback`）。
修改后需在百度开放平台「安全设置 → 授权回调页」登记同一地址，然后重启 api。

### 9.3 禁止在服务器上 docker build（重要）
2C / 1.6G 的实例执行 `npm ci + tsc` 会把内存打满、swap 抖动，sshd 连 banner 都发不出来（本机已踩坑，且无法远程恢复，只能控制台重启）。

正确做法：**本地构建镜像 → 导出 → 上传 → load**。

```powershell
# 本地（需 Docker Desktop 运行）
docker build --provenance=false --sbom=false -f Dockerfile.api -t highschool-api:latest .
docker build --provenance=false --sbom=false -f Dockerfile.web -t highschool-web:latest .
docker save highschool-api:latest highschool-web:latest -o $env:TEMPhs-images.tar
# 压缩可选；若压缩，服务器必须解压后再 load（见下）
```

```bash
# 服务器
scp hs-images.tar root@<ip>:/tmp/
cd /tmp && docker load -i hs-images.tar
cd /www/highschool-system && docker compose up -d
docker image prune -f
```

注意：若上传的是 `.tgz`（tar 套 tar），`docker load -i x.tgz` 会报
`invalid archive: does not contain a manifest.json` —— 必须先 `tar -xzf x.tgz` 再 load。

### 9.4 只更新前端
```powershell
npm run build --prefix frontend
docker build --provenance=false --sbom=false -f Dockerfile.web -t highschool-web:latest .
docker save highschool-web:latest -o $env:TEMPhs-web.tar     # 61MB，直接传未压缩 tar
```
```bash
scp hs-web.tar root@<ip>:/tmp/ && ssh root@<ip> "docker load -i /tmp/hs-web.tar && cd /www/highschool-system && docker compose up -d web"
```
浏览器若仍显示旧界面，是前端静态资源缓存：用 `http://<ip>/learning?ts=1` 之类带参数访问一次即可（`index.html` 本身已更新，JS 哈希也已变化）。

### 9.5 升级数据库（本版本删表）
```bash
cd /www/highschool-system
cp data/db/dev.db backups/dev-before-upgrade-$(date +%Y%m%d%H%M).db
docker exec -it highschool-system-api-1 sh -lc "cd /app && npx prisma db push --accept-data-loss"
docker compose restart api
```
`--accept-data-loss` 会按新 schema **删除已下线业务的表**，务必先备份。
也可在本地对 `dev.db` 执行 `db push` 后上传数据库文件替换（更可控）。

### 9.6 学科导航（URL 变化）
- `/learning` 会自动跳转到上次访问学科，首次为 `/learning/math`
- 具体学科：`/learning/math | /learning/physics | /learning/chemistry | /learning/biology`
- 未建设学科（语文/英语/政治/历史/地理/文综/理综）在侧边栏灰显「待建设」，无 `sectionCount` 即自动灰显
- 新增学科只需：录入教材目录（seed 脚本）→ 增量扫描网盘 → 重跑映射，无需改前端
