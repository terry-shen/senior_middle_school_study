# 高中数学学习系统 - Windows 数据库初始化脚本
# 用于创建数据库和用户

param(
    [string]$DB_NAME = "math_learning",
    [string]$DB_USER = "math_user",
    [string]$DB_PASSWORD
)

# 颜色函数
function Write-Success {
    param([string]$Message)
    Write-Host "[SUCCESS] $Message" -ForegroundColor Green
}

function Write-Info {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Cyan
}

function Write-Warning {
    param([string]$Message)
    Write-Host "[WARNING] $Message" -ForegroundColor Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

# 检查 PostgreSQL 服务
function Check-PostgreSQL {
    Write-Info "检查 PostgreSQL 服务..."
    
    $pgService = Get-Service -Name "postgresql*" -ErrorAction SilentlyContinue
    if ($pgService -and $pgService.Status -eq "Running") {
        Write-Success "PostgreSQL 服务运行中"
        return $true
    } else {
        Write-Error "PostgreSQL 服务未运行"
        Write-Info "启动命令: net start postgresql-x64-16"
        return $false
    }
}

# 创建数据库和用户
function Create-Database {
    Write-Info "创建数据库: $DB_NAME"
    Write-Info "创建用户: $DB_USER"
    
    # 检查数据库是否已存在
    $dbExists = & psql -lqt 2>$null | Select-String "^ $DB_NAME "
    if ($dbExists) {
        Write-Warning "数据库 '$DB_NAME' 已存在"
        $response = Read-Host "是否删除并重新创建？(y/n)"
        if ($response -eq 'y') {
            Write-Info "删除数据库..."
            & psql -c "DROP DATABASE IF EXISTS $DB_NAME;" postgres 2>$null
        } else {
            Write-Info "跳过数据库创建"
            return
        }
    }
    
    # 检查用户是否已存在
    $userExists = & psql -t -c "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" postgres 2>$null
    if ($userExists -match '1') {
        Write-Warning "用户 '$DB_USER' 已存在"
    } else {
        Write-Info "创建用户..."
        
        if (-not $DB_PASSWORD) {
            $securePassword = Read-Host "请输入数据库密码" -AsSecureString
            $BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
            $DB_PASSWORD = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)
        }
        
        & psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';" postgres 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Success "用户 '$DB_USER' 创建成功"
        } else {
            Write-Error "创建用户失败"
            exit 1
        }
    }
    
    # 创建数据库
    & psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;" postgres 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Success "数据库 '$DB_NAME' 创建成功"
    } else {
        Write-Error "创建数据库失败"
        exit 1
    }
    
    # 授予权限
    & psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;" postgres 2>$null
    Write-Success "权限授予成功"
}

# 初始化 Prisma schema
function Initialize-Prisma {
    Write-Info "初始化数据库 Schema..."
    
    $prismaPath = Join-Path $PSScriptRoot "..\backend\prisma\schema.prisma"
    if (Test-Path $prismaPath) {
        Push-Location (Join-Path $PSScriptRoot "..\backend")
        npx prisma generate
        npx prisma db push
        Pop-Location
        Write-Success "数据库 Schema 初始化成功"
    } else {
        Write-Warning "未找到 Prisma schema 文件"
    }
}

# 生成环境变量文件
function Generate-EnvFile {
    Write-Info "生成 .env 配置..."
    
    $envPath = Join-Path $PSScriptRoot "..\backend\.env"
    
    if (Test-Path $envPath) {
        Write-Warning ".env 文件已存在"
    } else {
        $envContent = @"
# 数据库配置
DATABASE_URL="postgresql://$DB_USER:$DB_PASSWORD@localhost:5432/$DB_NAME"

# JWT 密钥（请修改为随机字符串）
JWT_SECRET="your-secret-key-change-this-in-production"

# 服务端口
PORT=3000

# 前端地址
FRONTEND_URL="http://localhost:5173"
"@
        $envContent | Out-File -FilePath $envPath -Encoding utf8
        Write-Success ".env 文件已创建"
        Write-Warning "请修改 JWT_SECRET 为随机字符串"
    }
}

# 主函数
function Main {
    Write-Host ""
    Write-Host "=========================================="
    Write-Host "  高中数学学习系统 - 数据库初始化"
    Write-Host "=========================================="
    Write-Host ""
    
    if (-not (Check-PostgreSQL)) {
        exit 1
    }
    
    Write-Host ""
    Create-Database
    Write-Host ""
    
    Generate-EnvFile
    Write-Host ""
    
    Initialize-Prisma
    Write-Host ""
    
    Write-Host "=========================================="
    Write-Host "  初始化完成"
    Write-Host "=========================================="
    Write-Success "数据库初始化成功！"
    Write-Host ""
    Write-Info "启动后端服务: cd backend && npm run dev"
    Write-Info "启动前端服务: cd frontend && npm run dev"
}

Main