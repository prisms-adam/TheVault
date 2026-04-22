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
PORT=3000
REDIS_HOST="127.0.0.1"
EOF
    echo -e "${GREEN}✅ Created .env with default values.${NC}"
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
echo -e "${GREEN}📡 Starting Backend (API)...${NC}"
npm run dev &

echo -e "${GREEN}⚙️  Starting Worker (Transcoding)...${NC}"
npm run worker &

echo -e "${GREEN}💻 Starting Frontend (Vite)...${NC}"
(cd "$FRONTEND_DIR" && npm run dev) &

# 5. Detect LAN IP
LAN_IP=$(hostname -I | awk '{print $1}')

echo -e "${GREEN}✨ All services are starting!${NC}"
echo "--------------------------------------------------"
echo -e "Local:    http://localhost:5173"
if [ ! -z "$LAN_IP" ]; then
    echo -e "Network:  http://$LAN_IP:5173"
fi
echo "API:      http://$LAN_IP:3000 (Backend)"
echo "--------------------------------------------------"
echo "Press Ctrl+C to stop all services."

# Wait for all background processes
wait
