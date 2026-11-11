#!/bin/bash
# 备份 SQLite 数据库与上传文件；建议放到 crontab：0 3 * * * /www/highschool-system/deploy/backup.sh
set -euo pipefail
cd "$(dirname "$0")/.."
STAMP=$(date +%Y%m%d-%H%M%S)
mkdir -p backups

echo "[backup] stopping api for consistent sqlite copy..."
docker compose stop api >/dev/null
cp data/db/dev.db "data/db/dev-$STAMP.db"
docker compose start api >/dev/null

tar -czf "backups/data-$STAMP.tar.gz" -C data "db/dev-$STAMP.db" uploads
rm -f "data/db/dev-$STAMP.db"

# 保留最近 14 天
find backups -name 'data-*.tar.gz' -mtime +14 -delete
echo "[backup] done: backups/data-$STAMP.tar.gz ($(du -h "backups/data-$STAMP.tar.gz" | cut -f1))"
