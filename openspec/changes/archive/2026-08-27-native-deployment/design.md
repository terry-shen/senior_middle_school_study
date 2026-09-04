## Context

当前系统使用Docker容器化部署，包含以下组件：
- PostgreSQL数据库容器
- Node.js后端容器
- React前端容器

用户希望改为直接在操作系统上安装部署。参见 proposal.md 了解变更动机。

**当前系统架构**:
```
Docker Compose
├── postgres (PostgreSQL 16)
├── backend (Node.js 22)
└── frontend (Node.js 22, Vite)
```

**目标架构**:
```
操作系统
├── PostgreSQL (系统安装)
├── Node.js 22+ (系统安装)
├── 后端服务 (npm start / PM2)
└── 前端静态文件 (nginx/直接访问)
```

## Goals / Non-Goals

**Goals:**
- 提供跨平台安装脚本（Windows/Linux/macOS）
- 简化部署流程，降低运维门槛
- 提供清晰的系统依赖清单
- 支持生产环境部署配置

**Non-Goals:**
- 不提供云平台部署方案（AWS/Azure/GCP）
- 不修改应用程序功能代码
- 不提供容器化部署的替代方案保留
- 不处理数据迁移（假设新部署或已有数据备份）

## Decisions

### Decision 1: 安装脚本实现方式

**选择**: Shell脚本(Linux/macOS) + PowerShell脚本(Windows)

**理由**:
- 原生支持，无需额外依赖
- 用户可直接执行，无需安装额外工具
- 可检查系统环境和依赖

**替代方案**:
- Ansible: 需要额外安装，增加复杂度
- Chef/Puppet: 同上
- Makefile: 跨平台支持不佳

### Decision 2: 数据库配置方式

**选择**: 使用环境变量配置数据库连接

**理由**:
- 与现有代码一致（`DATABASE_URL`）
- 安全性：不硬编码密码
- 灵活性：支持不同环境配置

**配置项**:
```
DATABASE_URL=postgresql://user:password@localhost:5432/math_learning
JWT_SECRET=<random-secret>
PORT=3000
```

### Decision 3: 生产环境运行方式

**选择**: PM2进程管理器

**理由**:
- 自动重启、日志管理
- 多进程支持
- 跨平台兼容

**替代方案**:
- systemd: 仅Linux
- Windows服务: 仅Windows
- Docker: 被移除

### Decision 4: 前端部署方式

**选择**: 构建静态文件，由后端或独立Web服务器提供

**理由**:
- 简化部署
- 减少运行时依赖
- 生产环境标准做法

**流程**:
1. `npm run build` 生成 `dist/`
2. 后端提供静态文件服务，或
3. Nginx/Apache等Web服务器托管

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| 系统环境差异导致安装失败 | 脚本包含环境检测和错误提示 |
| 用户不熟悉系统级软件安装 | 提供详细的安装文档 |
| 数据库安全配置 | 脚本引导设置密码，文档强调安全配置 |
| 进程意外退出 | PM2自动重启配置 |
| 日志管理 | PM2日志收集，建议logrotate |

## Migration Plan

**阶段1: 准备工作**
1. 备份现有数据（如使用Docker部署）
2. 在目标系统安装Node.js 22+
3. 在目标系统安装PostgreSQL 16

**阶段2: 部署后端**
1. 复制backend目录
2. 配置环境变量
3. 安装依赖: `npm install`
4. 初始化数据库: `npx prisma db push`
5. 启动服务: `npm run dev` (开发) 或 `pm2 start` (生产)

**阶段3: 部署前端**
1. 复制frontend目录
2. 安装依赖: `npm install`
3. 构建: `npm run build`
4. 部署dist目录到Web服务器

**回滚策略**:
- 保留Docker配置文件备份
- 数据库迁移可回滚
- 使用Git版本控制

## Open Questions

1. **前端生产部署**: 是否需要提供Nginx配置示例？
   - 建议：提供基础配置示例，用户可根据需要调整

2. **HTTPS支持**: 是否需要在部署脚本中配置SSL证书？
   - 建议：不在脚本中处理，文档中说明如何配置

3. **系统服务**: 是否需要提供systemd/Windows服务注册脚本？
   - 建议：PM2已提供足够支持，如需要可后续添加