#!/bin/bash
# Install Python dependencies for mcq-extractor microservice
# Usage: bash scripts/install-python-deps.sh

set -e

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MCQ_DIR="$PROJECT_ROOT/mcq-extractor"

echo "=== MCQ Extractor Python Dependencies Installer ==="

# 1. Check Python
echo ""
echo "[1/4] Checking Python..."
if command -v python3 &> /dev/null; then
    python3 --version
    PYTHON=python3
elif command -v python &> /dev/null; then
    python --version
    PYTHON=python
else
    echo "  ERROR: Python is not installed or not in PATH."
    echo "  Please install Python 3.8+ from https://python.org"
    exit 1
fi

# 2. Check pip
echo ""
echo "[2/4] Checking pip..."
if $PYTHON -m pip --version &> /dev/null; then
    $PYTHON -m pip --version
else
    echo "  ERROR: pip is not available. Run: $PYTHON -m ensurepip --upgrade"
    exit 1
fi

# 3. Install Python dependencies
echo ""
echo "[3/4] Installing Python dependencies..."
REQUIREMENTS_FILE="$MCQ_DIR/requirements.txt"
if [ -f "$REQUIREMENTS_FILE" ]; then
    echo "  Installing from: $REQUIREMENTS_FILE"
    $PYTHON -m pip install -r "$REQUIREMENTS_FILE"
    echo "  Dependencies installed."
else
    echo "  WARNING: requirements.txt not found at $REQUIREMENTS_FILE"
fi

# 4. Check Tesseract OCR (optional)
echo ""
echo "[4/4] Checking Tesseract OCR (optional, for image extraction)..."
if command -v tesseract &> /dev/null; then
    echo "  Tesseract found: $(which tesseract)"
else
    echo "  Tesseract NOT found. Image OCR will not work."
    echo "  Install from: https://github.com/tesseract-ocr/tesseract"
    echo "  PDF and Word extraction will still work without Tesseract."
fi

echo ""
echo "=== Installation Complete ==="
echo "Start the microservice with: cd mcq-extractor && $PYTHON -m uvicorn main:app --port 8000"
