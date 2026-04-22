# The Vault: High School A/V Studio Console

The Vault is a high-performance, LAN-exclusive video repository designed to look and feel like a Professional Studio Console. It prioritizes technical metadata, high-bitrate playback, and granular administrative control for educational A/V environments.

---

## Core Features

### Studio Console Frontend
- **Deep Onyx Theme:** A modern, distraction-free aesthetic with Record Red (#BE123C) accents.
- **Theater Mode:** High-quality HLS playback with technical badges (e.g., 1080p, HLS).
- **Adaptive Bitrate:** Automatic fallback from 1080p to 720p to ensure smooth streaming.
- **Categorized Archive:** Grouped video sections managed via dynamic tags.
- **Engagement Console:** Emoji reactions, comment feed, and like/dislike system.

### The Engine (Backend)
- **HLS Pipeline:** Background video transcoding using FFmpeg and BullMQ.
- **Metadata Extraction:** Automatically captures duration, bitrate, codecs, and resolution.
- **Dynamic Storage:** Admin-configurable upload and storage directories.
- **First-User Admin:** The first person to register automatically gains Master Admin privileges.

### Admin Console (Moderation)
- **Global Kill-Switch:** Instantly hide any video from the archive.
- **Queue Monitor:** Real-time progress bars for active transcoding jobs.
- **Category Management:** Define homepage sections based on tag queries.
- **Tagging:** Manage video tags for categorization.
- **Comment Scrubbing:** Full moderation list with Delete and Pin capabilities.
- **User Management:** Manage users, rename accounts, reset passwords, and toggle Admin permissions.

---

## Technical Stack

- **OS:** Fedora 43+ (Linux)
- **Backend:** Node.js (Express) + Prisma ORM
- **Frontend:** Vite + React + TypeScript + Tailwind CSS (v4)
- **Database:** SQLite (local file-based)
- **Processing:** FFmpeg (HLS) + Redis/BullMQ (Job Queue)
- **Streaming:** HLS (Adaptive Bitrate)

---

## Installation & Setup (Fedora)

### 1. Prerequisites
Ensure you have the following installed on your Fedora system:
```bash
sudo dnf install nodejs npm ffmpeg redis
sudo systemctl enable --now redis
```

### 2. Backend Setup
```bash
# Clone the repository
git clone https://github.com/prisms-adam/TheVault.git
cd TheVault

# Install dependencies
npm install

# Initialize Database
npx prisma db push
npx prisma generate

# Create .env file
# DATABASE_URL="file:./dev.db"
# JWT_SECRET="your-secret-key"
# PORT=3000
# REDIS_HOST="127.0.0.1"
```

### 3. Frontend Setup
```bash
cd frontend
npm install
npm run build
```

---

## How to Run

### One-Step Startup (Recommended)
The easiest way to start the entire stack (API, Worker, and Frontend) with LAN access enabled:
```bash
./start.sh
```
The script will automatically check for prerequisites, initialize the database if needed, and provide you with the LAN URL for remote access.

### Development Mode (Manual)
If you prefer to start services separately:
```bash
# Terminal 1: API
npm start

# Terminal 2: Worker
npm run worker

# Terminal 3: Frontend
cd frontend && npm run dev
```

### Production Mode (Systemd)
The repository includes systemd service files for automated startup. Update the `User` and `WorkingDirectory` fields in the files before deployment.

```bash
sudo cp vault.service /etc/systemd/system/
sudo cp vault-worker.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now vault vault-worker
```

---

## Sponsor Maintenance Tool
Use the included bash script for maintenance tasks:
```bash
./scripts/vault-admin.sh {backup|clean|restart|ip}
```
- **backup:** Zip the database and uploads folder.
- **clean:** Purge the temporary upload buffer.
- **restart:** Cycle the systemd services.
- **ip:** Scan the LAN for the server address.

---

## Automated Testing
Verify the integrity of the system using the built-in TDD suite:
```bash
npm test
```

---
The Vault – Preserving the next generation of visual storytellers.
