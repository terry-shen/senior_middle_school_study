## Why

当前系统使用Docker容器化部署方式，虽然提供了环境一致性，但增加了部署复杂性和资源消耗。用户希望简化部署流程，直接在操作系统上安装运行软件组件，降低运维门槛和系统开销。

## What Changes

- **BREAKING**: 移除Docker容器化部署配置
  - 删除 `docker-compose.yml`
  - 删除 `frontend/Dockerfile.dev`
  - 删除 `backend/Dockerfile.dev`
- 新增直接部署脚本和文档
  - 添加 `scripts/install.sh` Linux/macOS安装脚本
  - 添加 `scripts/install.ps1` Windows安装脚本
  - 更新 `README.md` 添加原生部署说明
- 保留PostgreSQL数据库支持，改为系统级安装配置

## Capabilities

### New Capabilities

*无新增能力 - 此变更仅涉及部署方式，不引入新功能*

### Modified Capabilities

*无修改能力 - 此变更不涉及功能需求的改变*

> 注：此变更设置了 `skip_specs: true`，因为部署方式是实现细节，不改变系统行为需求。

## Impact

**删除文件**:
- `docker-compose.yml`
- `frontend/Dockerfile.dev`
- `backend/Dockerfile.dev`

**新增文件**:
- `scripts/install.sh`
- `scripts/install.ps1`
- `docs/deployment-native.md`

**修改文件**:
- `README.md` - 更新部署说明

**依赖变更**:
- PostgreSQL: 从Docker容器改为系统级安装
- Node.js: 从Docker容器改为系统级安装
- 前端/后端: 直接在系统上运行

**目标环境**:
- Windows 10/11
- Linux (Ubuntu 20.04+, CentOS 8+)
- macOS 11+