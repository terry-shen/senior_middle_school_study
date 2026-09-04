#!/usr/bin/env bash
# MinerU Installation Script for Linux/macOS
# Installs MinerU Python package and downloads model files

set -e

echo "=== MinerU Installation Script (Linux/macOS) ==="

# Check Python version (requires 3.10-3.13)
echo -e "\n[1/4] Checking Python version..."
if ! command -v python3 &> /dev/null; then
    echo "ERROR: Python3 is not installed. Please install Python 3.10-3.13."
    exit 1
fi
PY_VERSION=$(python3 --version 2>&1)
echo "Found: $PY_VERSION"

# Check if Python version is in range 3.10-3.13
PY_MAJOR=$(python3 -c 'import sys; print(sys.version_info[0])')
PY_MINOR=$(python3 -c 'import sys; print(sys.version_info[1])')
if [ "$PY_MAJOR" -eq 3 ] && [ "$PY_MINOR" -ge 10 ] && [ "$PY_MINOR" -le 13 ]; then
    echo "Python version OK (3.$PY_MINOR)"
else
    echo "WARNING: Python 3.$PY_MINOR may not be compatible with MinerU (requires 3.10-3.13)"
    echo "If installation fails, install Python 3.11 or 3.12"
fi

# Install MinerU
echo -e "\n[2/4] Installing MinerU package..."
pip3 install "mineru[pipeline]" || pip install "mineru[pipeline]"
echo "MinerU installed successfully"

# Verify installation
echo -e "\n[3/4] Verifying MinerU installation..."
if command -v mineru &> /dev/null; then
    echo "MinerU version: $(mineru --version 2>&1)"
else
    echo "WARNING: 'mineru' command not found in PATH"
    echo "Try: python3 -m mineru --version"
fi

# Download models
echo -e "\n[4/4] Downloading model files (2-4GB, may take 10-30 minutes)..."
echo "You can also run this manually: mineru-models-download"
echo "auto" | mineru-models-download || echo "WARNING: Model download failed. Run 'mineru-models-download' manually."

echo -e "\n=== Installation Complete ==="
echo "To start MinerU API service:"
echo "  mineru-api --host 127.0.0.1 --port 8080"
echo ""
echo "Or use PM2:"
echo "  pm2 start mineru-api --name mineru-api -- --host 127.0.0.1 --port 8080"
