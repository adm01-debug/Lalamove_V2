#!/bin/bash
# backup.sh - Lalamove Guardian
set -e

BACKUP_DIR="./backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/backup_$TIMESTAMP.sql"

mkdir -p $BACKUP_DIR

echo "🔄 Iniciando backup..."
echo "📁 Destino: $BACKUP_FILE"

supabase db dump -f $BACKUP_FILE

echo "✅ Backup completo: $BACKUP_FILE"
echo "📊 Tamanho: $(du -h $BACKUP_FILE | cut -f1)"

find $BACKUP_DIR -name "backup_*.sql" -mtime +7 -delete
echo "🧹 Backups antigos removidos"
echo "✅ Processo concluído!"
