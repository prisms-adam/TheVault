#!/bin/bash

# The Vault - Sponsor Maintenance Tool
# For Fedora 43+

PROJECT_DIR="/home/$(whoami)/TheVault" # Update this to your actual path
BACKUP_DIR="/mnt/backups/thevault" # Update this to your external drive path

RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

echo -e "${RED}--- THE VAULT SPONSOR TOOL ---${NC}"

case "$1" in
  backup)
    echo "Initializing Backup..."
    mkdir -p "$BACKUP_DIR"
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    zip -r "$BACKUP_DIR/vault_backup_$TIMESTAMP.zip" "$PROJECT_DIR/dev.db" "$PROJECT_DIR/uploads"
    echo -e "${GREEN}Backup compressed to $BACKUP_DIR${NC}"
    ;;
  clean)
    echo "Purging temporary buffers..."
    rm -rf "$PROJECT_DIR/temp/*"
    echo -e "${GREEN}Cache purged.${NC}"
    ;;
  restart)
    echo "Restarting Studio Services..."
    sudo systemctl restart vault.service
    sudo systemctl restart vault-worker.service
    echo -e "${GREEN}Services cycling.${NC}"
    ;;
  ip)
    echo "Scanning LAN for new IP..."
    if [[ "$OSTYPE" == "darwin"* ]]; then
      IP_ADDR=$(ipconfig getifaddr en0 || ipconfig getifaddr en1)
    else
      IP_ADDR=$(hostname -I | awk '{print $1}')
    fi
    echo -e "Current Local Entry Point: ${GREEN}http://$IP_ADDR:3000${NC}"
    ;;
  *)
    echo "Usage: $0 {backup|clean|restart|ip}"
    exit 1
esac

exit 0
