#!/bin/bash

# 高中数学学习系统 - Linux/macOS 数据库初始化脚本
# 用于创建数据库和用户

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 默认配置
DB_NAME="${DB_NAME:-math_learning}"
DB_USER="${DB_USER:-math_user}"
DB_PASSWORD="${DB_PASSWORD:-}"

# 检测 PostgreSQL 是否运行
check_postgresql() {
    print_info "检查 PostgreSQL 服务..."
    
    if [[ "$OSTYPE" == "darwin"* ]]; then
        if brew services list | grep postgresql | grep started &> /dev/null; then
            print_success "PostgreSQL 服务运行中"
        else
            print_error "PostgreSQL 服务未运行"
            print_info "启动命令: brew services start postgresql"
            exit 1
        fi
    else
        if systemctl is-active --quiet postgresql 2>/dev/null || service postgresql status &> /dev/null; then
            print_success "PostgreSQL 服务运行中"
        else
            print_error "PostgreSQL 服务未运行"
            print_info "启动命令: sudo systemctl start postgresql"
            exit 1
        fi
    fi
}

# 创建数据库和用户
create_database() {
    print_info "创建数据库: $DB_NAME"
    print_info "创建用户: $DB_USER"
    
    # 检查数据库是否已存在
    if psql -lqt 2>/dev/null | cut -d \| -f 1 | grep -qw $DB_NAME; then
        print_warning "数据库 '$DB_NAME' 已存在"
        read -p "是否删除并重新创建？(y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            print_info "删除数据库..."
            psql -c "DROP DATABASE IF EXISTS $DB_NAME;" postgres 2>/dev/null || {
                print_error "删除数据库失败"
                exit 1
            }
        else
            print_info "跳过数据库创建"
            return 0
        fi
    fi
    
    # 检查用户是否已存在
    if psql -t -c "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" postgres 2>/dev/null | grep -q 1; then
        print_warning "用户 '$DB_USER' 已存在"
    else
        print_info "创建用户..."
        if [ -z "$DB_PASSWORD" ]; then
            read -s -p "请输入数据库密码: " DB_PASSWORD
            echo
        fi
        
        psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';" postgres 2>/dev/null || {
            print_error "创建用户失败"
            exit 1
        }
        print_success "用户 '$DB_USER' 创建成功"
    fi
    
    # 创建数据库
    psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;" postgres 2>/dev/null || {
        print_error "创建数据库失败"
        exit 1
    }
    print_success "数据库 '$DB_NAME' 创建成功"
    
    # 授予权限
    psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;" postgres 2>/dev/null
    print_success "权限授予成功"
}

# 初始化 Prisma schema
init_prisma() {
    print_info "初始化数据库 Schema..."
    
    if [ -f "backend/prisma/schema.prisma" ]; then
        cd backend
        npx prisma generate
        npx prisma db push
        cd ..
        print_success "数据库 Schema 初始化成功"
    else
        print_warning "未找到 Prisma schema 文件"
        print_info "请在项目根目录运行此脚本"
    fi
}

# 生成环境变量示例
generate_env() {
    print_info "生成 .env 配置..."
    
    ENV_FILE="backend/.env"
    
    if [ -f "$ENV_FILE" ]; then
        print_warning ".env 文件已存在"
    else
        cat > "$ENV_FILE" << EOF
# 数据库配置
DATABASE_URL="postgresql://$DB_USER:$DB_PASSWORD@localhost:5432/$DB_NAME"

# JWT 密钥（请修改为随机字符串）
JWT_SECRET="your-secret-key-change-this-in-production"

# 服务端口
PORT=3000

# 前端地址
FRONTEND_URL="http://localhost:5173"
EOF
        print_success ".env 文件已创建"
        print_warning "请修改 JWT_SECRET 为随机字符串"
    fi
}

# 主函数
main() {
    echo ""
    echo "=========================================="
    echo "  高中数学学习系统 - 数据库初始化"
    echo "=========================================="
    echo ""
    
    check_postgresql
    echo ""
    
    create_database
    echo ""
    
    generate_env
    echo ""
    
    init_prisma
    echo ""
    
    echo "=========================================="
    echo "  初始化完成"
    echo "=========================================="
    print_success "数据库初始化成功！"
    echo ""
    print_info "启动后端服务: cd backend && npm run dev"
    print_info "启动前端服务: cd frontend && npm run dev"
}

main "$@"