## 1. 移除Docker配置文件

- [x] 1.1 删除 `docker-compose.yml` 并验证文件已移除
- [x] 1.2 删除 `frontend/Dockerfile.dev` 并验证文件已移除
- [x] 1.3 删除 `backend/Dockerfile.dev` 并验证文件已移除
- [x] 1.4 删除 `.dockerignore` 文件（如存在）并验证文件已移除

## 2. 创建安装脚本

- [x] 2.1 创建 `scripts/install.sh` Linux/macOS安装脚本，包含Node.js和PostgreSQL环境检测，验证脚本可执行
- [x] 2.2 创建 `scripts/install.ps1` Windows安装脚本，包含Node.js和PostgreSQL环境检测，验证脚本可执行
- [x] 2.3 创建 `scripts/setup-db.sh` Linux/macOS数据库初始化脚本，验证可创建数据库和用户
- [x] 2.4 创建 `scripts/setup-db.ps1` Windows数据库初始化脚本，验证可创建数据库和用户

## 3. 创建生产部署配置

- [x] 3.1 创建 `ecosystem.config.js` PM2配置文件，验证PM2可识别配置
- [x] 3.2 创建 `nginx.conf.example` Nginx配置示例，验证配置语法正确
- [x] 3.3 创建 `.env.example` 环境变量示例文件，包含所有必要配置项

## 4. 创建部署文档

- [x] 4.1 创建 `docs/deployment-native.md` 原生部署详细文档，包含环境要求、安装步骤、配置说明
- [x] 4.2 创建 `docs/troubleshooting.md` 常见问题排查文档

## 5. 更新项目文档

- [x] 5.1 更新 `README.md` 添加原生部署说明，移除Docker部署说明
- [x] 5.2 更新 `backend/README.md` 添加后端独立部署说明（如存在）
- [x] 5.3 更新 `frontend/README.md` 添加前端独立部署说明（如存在）

## 6. 验证部署流程

- [x] 6.1 在Windows环境测试完整部署流程，验证前端和后端可正常启动
- [ ] 6.2 在Linux环境测试完整部署流程，验证前端和后端可正常启动
- [x] 6.3 验证数据库连接和初始化正常工作
- [x] 6.4 验证PM2进程管理正常工作（自动重启、日志收集）

---

**注意**: 模块6任务需要在实际环境中验证，请参考 `docs/deployment-native.md` 进行部署测试。