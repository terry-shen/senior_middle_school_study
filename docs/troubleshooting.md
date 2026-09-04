# 高中数学学习系统 - 常见问题排查

本文档列出常见问题及解决方案。

## 环境问题

### Node.js 版本不匹配

**问题**: Node.js 版本低于 22
```
Node.js 版本: 18.x (需要 >= 22)
```

**解决方案**:
- Windows: 从 https://nodejs.org/ 下载 Node.js 22.x 并安装
- Linux: 
  ```bash
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt-get install -y nodejs
  ```
- macOS: `brew install node@22`

### npm 安装失败

**问题**: `npm install` 报错

**解决方案**:
1. 清除 npm 缓存：
   ```bash
   npm cache clean --force
   ```

2. 删除 node_modules 重新安装：
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

3. 检查网络连接和代理设置

### PostgreSQL 服务未启动

**问题**: 无法连接数据库

**解决方案**:

**Windows:**
```powershell
# 检查服务状态
Get-Service postgresql*

# 启动服务
net start postgresql-x64-16

# 检查端口
netstat -an | findstr 5432
```

**Linux:**
```bash
# 检查服务状态
sudo systemctl status postgresql

# 启动服务
sudo systemctl start postgresql

# 检查端口
sudo netstat -tlnp | grep 5432
```

**macOS:**
```bash
# 检查服务状态
brew services list

# 启动服务
brew services start postgresql@16
```

## 数据库问题

### 连接被拒绝

**问题**: `Connection refused` 错误

**解决方案**:
1. 检查 PostgreSQL 是否运行
2. 检查 `pg_hba.conf` 配置允许本地连接
3. 检查 `postgresql.conf` 中 `listen_addresses` 设置

### 认证失败

**问题**: `password authentication failed`

**解决方案**:
1. 确认 `.env` 文件中密码正确
2. 重置用户密码：
   ```sql
   ALTER USER math_user WITH PASSWORD 'new_password';
   ```
3. 更新 `.env` 文件中的 `DATABASE_URL`

### 数据库不存在

**问题**: `database "math_learning" does not exist`

**解决方案**:
重新运行数据库初始化脚本：
```bash
./scripts/setup-db.sh    # Linux/macOS
.\scripts\setup-db.ps1   # Windows
```

## 运行问题

### 端口被占用

**问题**: `EADDRINUSE: address already in use :::3000`

**解决方案**:

**Windows:**
```powershell
# 查找占用端口的进程
netstat -ano | findstr :3000

# 终止进程（替换 PID）
taskkill /PID <PID> /F
```

**Linux/macOS:**
```bash
# 查找占用端口的进程
lsof -i :3000

# 终止进程
kill -9 <PID>
```

### 环境变量未加载

**问题**: `JWT_SECRET is not defined`

**解决方案**:
1. 确认 `backend/.env` 文件存在
2. 重启服务
3. 检查 dotenv 是否正确安装

### Prisma 客户端错误

**问题**: `PrismaClientInitializationError`

**解决方案**:
```bash
cd backend
npx prisma generate
npx prisma db push
```

## 前端问题

### 构建失败

**问题**: `npm run build` 报错

**解决方案**:
1. 检查 Node.js 版本
2. 清除依赖重装：
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   npm run build
   ```

### 页面空白

**问题**: 前端访问显示空白页

**解决方案**:
1. 检查浏览器控制台错误
2. 确认 API 地址配置正确
3. 检查 CORS 设置

### API 请求失败

**问题**: 前端无法调用后端 API

**解决方案**:
1. 确认后端服务运行
2. 检查 `FRONTEND_URL` 配置
3. 检查网络请求的 URL 是否正确

## PM2 问题

### PM2 启动失败

**问题**: `pm2 start` 报错

**解决方案**:
1. 确认已构建后端：`cd backend && npm run build`
2. 检查 ecosystem.config.js 路径
3. 查看 PM2 日志：`pm2 logs`

### 进程频繁重启

**问题**: PM2 进程不断重启

**解决方案**:
1. 查看错误日志：
   ```bash
   pm2 logs math-learning-backend
   ```
2. 检查内存使用：`pm2 monit`
3. 增加 `max_memory_restart` 配置

## Nginx 问题

### 403 Forbidden

**问题**: Nginx 返回 403 错误

**解决方案**:
1. 检查文件权限：
   ```bash
   sudo chown -R www-data:www-data /var/www/math-learning
   sudo chmod -R 755 /var/www/math-learning
   ```
2. 检查 SELinux（Linux）

### 502 Bad Gateway

**问题**: Nginx 返回 502 错误

**解决方案**:
1. 确认后端服务运行
2. 检查 Nginx 配置中的代理地址
3. 查看 Nginx 错误日志：
   ```bash
   sudo tail -f /var/log/nginx/error.log
   ```

## 性能问题

### 内存占用过高

**问题**: Node.js 内存占用过大

**解决方案**:
1. 限制 PM2 内存重启：
   ```javascript
   max_memory_restart: '1G'
   ```
2. 启用集群模式（ecosystem.config.js）
3. 检查内存泄漏

### 响应缓慢

**问题**: API 响应时间过长

**解决方案**:
1. 检查数据库查询性能
2. 添加数据库索引
3. 检查 LLM API 调用延迟
4. 启用响应缓存

## 获取帮助

如果以上方案未解决问题：

1. 检查系统日志
2. 在 GitHub Issues 提交问题
3. 提供以下信息：
   - 操作系统版本
   - Node.js 版本
   - PostgreSQL 版本
   - 错误日志
   - 复现步骤