#!/bin/bash

# Configuration
API_DIR="."
FRONTEND_DIR="./frontend"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo "🚀 Starting The Vault Services..."

# 1. Check for .env file
if [ ! -f "$API_DIR/.env" ]; then
    echo -e "${RED}⚠️  Warning: .env file not found!${NC}"
    echo "Creating a default .env file..."
    cat > "$API_DIR/.env" <<EOF
DATABASE_URL="file:./dev.db"
JWT_SECRET="vault-development-secret-key-2026"
PORT=80
REDIS_HOST="127.0.0.1"
EOF
    echo -e "${GREEN}✅ Created .env with default values (Port 80).${NC}"
else
    # If .env exists, check if port is 3000 and offer to update to 80
    CURRENT_PORT=$(grep PORT "$API_DIR/.env" | cut -d '=' -f2 | tr -d '"' | tr -d '\r')
    if [ "$CURRENT_PORT" == "3000" ]; then
        echo -e "${GREEN}Found port 3000 in .env. Updating to port 80 for /vault hosting...${NC}"
        sed -i 's/PORT=3000/PORT=80/' "$API_DIR/.env"
    fi
fi

# Load PORT from .env
PORT=$(grep PORT "$API_DIR/.env" | cut -d '=' -f2 | tr -d '"' | tr -d '\r')
PORT=${PORT:-80}

if [ "$PORT" -eq 80 ] && [ "$EUID" -ne 0 ]; then
    echo -e "${RED}⚠️  Note: Hosting on port 80 usually requires root privileges.${NC}"
    echo "If the server fails to start, try: sudo ./start.sh"
fi

# 2. Check for Redis (required for BullMQ)
if ! pgrep -x "redis-server" > /dev/null; then
    echo -e "${RED}⚠️  Redis is not running!${NC}"
    echo "Attempting to start redis-server..."
    if command -v systemctl > /dev/null; then
        sudo systemctl start redis
    else
        redis-server --daemonize yes
    fi
    
    # Wait a moment for Redis to start
    sleep 2
    
    if ! pgrep -x "redis-server" > /dev/null; then
        echo -e "${RED}❌ Failed to start Redis. Worker will not function correctly.${NC}"
    else
        echo -e "${GREEN}✅ Redis started.${NC}"
    fi
fi

# 3. Ensure database and folders are initialized
echo "Checking system status..."
mkdir -p "$API_DIR/uploads"
if [ ! -f "$API_DIR/prisma/dev.db" ] && [ ! -f "$API_DIR/dev.db" ]; then
    echo "Initializing SQLite database..."
    npx prisma db push
fi

# Function to kill all background processes on exit
cleanup() {
    echo -e "\n${RED}🛑 Stopping all services...${NC}"
    # Kill the process group to ensure all children are stopped
    kill $(jobs -p) 2>/dev/null
    exit
}

# Trap Ctrl+C and other termination signals
trap cleanup SIGINT SIGTERM

# 4. Start services
echo -e "${GREEN}📦 Building Frontend for production...${NC}"
(cd "$FRONTEND_DIR" && npm install --silent && npm run build)

echo -e "${GREEN}📡 Starting Backend (API & Frontend Host)...${NC}"
npm run dev &

echo -e "${GREEN}⚙️  Starting Worker (Transcoding)...${NC}"
npm run worker &

# 5. Detect LAN IP
LAN_IP=$(hostname -I | awk '{print $1}')

echo -e "${GREEN}✨ All services are starting!${NC}"
echo "--------------------------------------------------"
echo -e "Local:    http://localhost:$PORT/vault"
if [ ! -z "$LAN_IP" ]; then
    echo -e "Network:  http://$LAN_IP:$PORT/vault"
fi
echo "--------------------------------------------------"
echo "Press Ctrl+C to stop all services."

# Wait for all background processes
wait
