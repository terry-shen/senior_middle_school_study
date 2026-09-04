#!/usr/bin/env pwsh
# Install Python dependencies for mcq-extractor microservice
# Usage: pwsh scripts/install-python-deps.ps1

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$McqDir = Join-Path $ProjectRoot "mcq-extractor"

Write-Host "=== MCQ Extractor Python Dependencies Installer ===" -ForegroundColor Cyan

# 1. Check Python
Write-Host "`n[1/4] Checking Python..." -ForegroundColor Yellow
try {
    $pythonVersion = python --version 2>&1
    Write-Host "  Python found: $pythonVersion" -ForegroundColor Green
} catch {
    Write-Host "  ERROR: Python is not installed or not in PATH." -ForegroundColor Red
    Write-Host "  Please install Python 3.8+ from https://python.org" -ForegroundColor Yellow
    exit 1
}

# 2. Check pip
Write-Host "`n[2/4] Checking pip..." -ForegroundColor Yellow
try {
    $pipVersion = pip --version 2>&1
    Write-Host "  pip found: $pipVersion" -ForegroundColor Green
} catch {
    Write-Host "  ERROR: pip is not available. Run: python -m ensurepip --upgrade" -ForegroundColor Red
    exit 1
}

# 3. Install Python dependencies
Write-Host "`n[3/4] Installing Python dependencies..." -ForegroundColor Yellow
$requirementsFile = Join-Path $McqDir "requirements.txt"
if (Test-Path $requirementsFile) {
    Write-Host "  Installing from: $requirementsFile" -ForegroundColor Gray
    pip install -r $requirementsFile 2>&1 | ForEach-Object { Write-Host "  $_" -ForegroundColor Gray }
    Write-Host "  Dependencies installed." -ForegroundColor Green
} else {
    Write-Host "  WARNING: requirements.txt not found at $requirementsFile" -ForegroundColor Red
}

# 4. Check Tesseract OCR (optional - only needed for image OCR)
Write-Host "`n[4/4] Checking Tesseract OCR (optional, for image extraction)..." -ForegroundColor Yellow
$tesseractPaths = @(
    "C:\Program Files\Tesseract-OCR\tesseract.exe",
    "C:\Program Files (x86)\Tesseract-OCR\tesseract.exe"
)
$tesseractFound = $false
foreach ($p in $tesseractPaths) {
    if (Test-Path $p) {
        Write-Host "  Tesseract found at: $p" -ForegroundColor Green
        $tesseractFound = $true
        break
    }
}
if (-not $tesseractFound) {
    $tesseractCmd = Get-Command tesseract -ErrorAction SilentlyContinue
    if ($tesseractCmd) {
        Write-Host "  Tesseract found in PATH: $($tesseractCmd.Source)" -ForegroundColor Green
        $tesseractFound = $true
    }
}
if (-not $tesseractFound) {
    Write-Host "  Tesseract NOT found. Image OCR will not work." -ForegroundColor Yellow
    Write-Host "  Install from: https://github.com/UB-Mannheim/tesseract/wiki" -ForegroundColor Yellow
    Write-Host "  PDF and Word extraction will still work without Tesseract." -ForegroundColor Gray
}

Write-Host "`n=== Installation Complete ===" -ForegroundColor Cyan
Write-Host "Start the microservice with: cd mcq-extractor && python -m uvicorn main:app --port 8000" -ForegroundColor Green
