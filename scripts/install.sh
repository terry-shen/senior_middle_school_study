#!/bin/bash

# 高中数学学习系统 - Linux/macOS 安装脚本
# 用于检测和安装必要的环境依赖

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 打印函数
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

# 检测操作系统
detect_os() {
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        OS="linux"
        if [ -f /etc/os-release ]; then
            . /etc/os-release
            DISTRO=$ID
        else
            DISTRO="unknown"
        fi
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        OS="macos"
        DISTRO="macos"
    else
        print_error "不支持的操作系统: $OSTYPE"
        exit 1
    fi
    print_info "检测到操作系统: $OS ($DISTRO)"
}

# 检查 Node.js
check_nodejs() {
    print_info "检查 Node.js..."
    
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node -v | sed 's/v//')
        NODE_MAJOR=$(echo $NODE_VERSION | cut -d. -f1)
        
        if [ "$NODE_MAJOR" -ge 22 ]; then
            print_success "Node.js 版本: $NODE_VERSION (符合要求 >= 22)"
            return 0
        else
            print_warning "Node.js 版本: $NODE_VERSION (需要 >= 22)"
            print_info "请升级 Node.js: https://nodejs.org/"
            return 1
        fi
    else
        print_error "Node.js 未安装"
        print_info "安装方法:"
        if [ "$OS" == "macos" ]; then
            print_info "  brew install node@22"
        else
            print_info "  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -"
            print_info "  sudo apt-get install -y nodejs"
        fi
        return 1
    fi
}

# 检查 PostgreSQL
check_postgresql() {
    print_info "检查 PostgreSQL..."
    
    if command -v psql &> /dev/null; then
        PG_VERSION=$(psql --version | grep -oE '[0-9]+\.[0-9]+' | head -1)
        print_success "PostgreSQL 版本: $PG_VERSION"
        
        # 检查服务是否运行
        if [ "$OS" == "macos" ]; then
            if brew services list | grep postgresql | grep started &> /dev/null; then
                print_success "PostgreSQL 服务运行中"
            else
                print_warning "PostgreSQL 服务未运行"
                print_info "启动命令: brew services start postgresql"
            fi
        else
            if systemctl is-active --quiet postgresql 2>/dev/null || service postgresql status &> /dev/null; then
                print_success "PostgreSQL 服务运行中"
            else
                print_warning "PostgreSQL 服务未运行"
                print_info "启动命令: sudo systemctl start postgresql 或 sudo service postgresql start"
            fi
        fi
        return 0
    else
        print_error "PostgreSQL 未安装"
        print_info "安装方法:"
        if [ "$OS" == "macos" ]; then
            print_info "  brew install postgresql@16"
            print_info "  brew services start postgresql@16"
        else
            print_info "  sudo apt-get install -y postgresql postgresql-contrib"
            print_info "  sudo systemctl start postgresql"
        fi
        return 1
    fi
}

# 检查 npm
check_npm() {
    print_info "检查 npm..."
    
    if command -v npm &> /dev/null; then
        NPM_VERSION=$(npm -v)
        print_success "npm 版本: $NPM_VERSION"
        return 0
    else
        print_error "npm 未安装"
        return 1
    fi
}

# 安装项目依赖
install_dependencies() {
    print_info "安装项目依赖..."
    
    if [ -f "backend/package.json" ]; then
        print_info "安装后端依赖..."
        cd backend
        npm install
        cd ..
        print_success "后端依赖安装完成"
    fi
    
    if [ -f "frontend/package.json" ]; then
        print_info "安装前端依赖..."
        cd frontend
        npm install
        cd ..
        print_success "前端依赖安装完成"
    fi
}

# 主函数
main() {
    echo ""
    echo "=========================================="
    echo "  高中数学学习系统 - 环境检测"
    echo "=========================================="
    echo ""
    
    detect_os
    echo ""
    
    # 检查环境
    NODE_OK=true
    PG_OK=true
    NPM_OK=true
    
    check_nodejs || NODE_OK=false
    check_postgresql || PG_OK=false
    check_npm || NPM_OK=false
    
    echo ""
    echo "=========================================="
    echo "  环境检测结果"
    echo "=========================================="
    
    if [ "$NODE_OK" = true ] && [ "$PG_OK" = true ] && [ "$NPM_OK" = true ]; then
        print_success "所有依赖已就绪！"
        echo ""
        read -p "是否安装项目依赖？(y/n) " -n 1 -r
        echo ""
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            install_dependencies
        fi
        echo ""
        print_info "下一步: 运行 ./scripts/setup-db.sh 初始化数据库"
    else
        print_warning "请先安装缺失的依赖"
        echo ""
        print_info "详细安装文档: docs/deployment-native.md"
    fi
}

main "$@"