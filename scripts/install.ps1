# 高中数学学习系统 - Windows 安装脚本
# 用于检测和安装必要的环境依赖

param(
    [switch]$InstallDeps
)

# 颜色函数
function Write-ColorOutput {
    param(
        [string]$Message,
        [string]$Color = "White"
    )
    Write-Host $Message -ForegroundColor $Color
}

function Write-Success {
    param([string]$Message)
    Write-ColorOutput "[SUCCESS] $Message" "Green"
}

function Write-Info {
    param([string]$Message)
    Write-ColorOutput "[INFO] $Message" "Cyan"
}

function Write-Warning {
    param([string]$Message)
    Write-ColorOutput "[WARNING] $Message" "Yellow"
}

function Write-Error {
    param([string]$Message)
    Write-ColorOutput "[ERROR] $Message" "Red"
}

# 检查 Node.js
function Check-NodeJS {
    Write-Info "检查 Node.js..."
    
    $nodePath = Get-Command node -ErrorAction SilentlyContinue
    if ($nodePath) {
        $nodeVersion = (node -v).Substring(1)
        $nodeMajor = [int]($nodeVersion.Split('.')[0])
        
        if ($nodeMajor -ge 22) {
            Write-Success "Node.js 版本: $nodeVersion (符合要求 >= 22)"
            return $true
        } else {
            Write-Warning "Node.js 版本: $nodeVersion (需要 >= 22)"
            Write-Info "请从 https://nodejs.org/ 下载 Node.js 22+"
            return $false
        }
    } else {
        Write-Error "Node.js 未安装"
        Write-Info "请从 https://nodejs.org/ 下载并安装 Node.js 22+"
        return $false
    }
}

# 检查 PostgreSQL
function Check-PostgreSQL {
    Write-Info "检查 PostgreSQL..."
    
    $psqlPath = Get-Command psql -ErrorAction SilentlyContinue
    if ($psqlPath) {
        $pgVersion = (psql --version) -replace '.*(\d+\.\d+).*', '$1'
        Write-Success "PostgreSQL 版本: $pgVersion"
        
        # 检查服务是否运行
        $pgService = Get-Service -Name "postgresql*" -ErrorAction SilentlyContinue
        if ($pgService -and $pgService.Status -eq "Running") {
            Write-Success "PostgreSQL 服务运行中"
        } else {
            Write-Warning "PostgreSQL 服务未运行"
            Write-Info "启动命令: net start postgresql-x64-16"
        }
        return $true
    } else {
        Write-Error "PostgreSQL 未安装"
        Write-Info "请从 https://www.postgresql.org/download/windows/ 下载并安装 PostgreSQL 16"
        return $false
    }
}

# 检查 npm
function Check-NPM {
    Write-Info "检查 npm..."
    
    $npmPath = Get-Command npm -ErrorAction SilentlyContinue
    if ($npmPath) {
        $npmVersion = npm -v
        Write-Success "npm 版本: $npmVersion"
        return $true
    } else {
        Write-Error "npm 未安装"
        return $false
    }
}

# 安装项目依赖
function Install-ProjectDependencies {
    Write-Info "安装项目依赖..."
    
    $backendPath = Join-Path $PSScriptRoot "..\backend\package.json"
    $frontendPath = Join-Path $PSScriptRoot "..\frontend\package.json"
    
    if (Test-Path $backendPath) {
        Write-Info "安装后端依赖..."
        Push-Location (Join-Path $PSScriptRoot "..\backend")
        npm install
        Pop-Location
        Write-Success "后端依赖安装完成"
    }
    
    if (Test-Path $frontendPath) {
        Write-Info "安装前端依赖..."
        Push-Location (Join-Path $PSScriptRoot "..\frontend")
        npm install
        Pop-Location
        Write-Success "前端依赖安装完成"
    }
}

# 主函数
function Main {
    Write-Host ""
    Write-Host "=========================================="
    Write-Host "  高中数学学习系统 - 环境检测"
    Write-Host "=========================================="
    Write-Host ""
    
    # 检查环境
    $nodeOk = Check-NodeJS
    $pgOk = Check-PostgreSQL
    $npmOk = Check-NPM
    
    Write-Host ""
    Write-Host "=========================================="
    Write-Host "  环境检测结果"
    Write-Host "=========================================="
    
    if ($nodeOk -and $pgOk -and $npmOk) {
        Write-Success "所有依赖已就绪！"
        
        if ($InstallDeps -or (Read-Host "是否安装项目依赖？(y/n)") -eq 'y') {
            Install-ProjectDependencies
        }
        
        Write-Host ""
        Write-Info "下一步: 运行 .\scripts\setup-db.ps1 初始化数据库"
    } else {
        Write-Warning "请先安装缺失的依赖"
        Write-Host ""
        Write-Info "详细安装文档: docs\deployment-native.md"
    }
}

Main