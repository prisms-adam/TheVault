# 📽️ The Vault: High School A/V Studio Console

**The Vault** is a high-performance, LAN-exclusive video repository designed to look and feel like a **Professional Studio Console**. It prioritizes technical metadata, high-bitrate playback, and granular administrative control for educational A/V environments.

---

## 🚀 Core Features

### 📺 Studio Console Frontend
- **Deep Onyx Theme:** A modern, distraction-free aesthetic with Record Red (#BE123C) accents.
- **Theater Mode:** High-quality HLS playback with technical badges (e.g., `1080p`, `HLS`).
- **Adaptive Bitrate:** Automatic fallback from 1080p to 720p to ensure smooth streaming.
- **Engagement Console:** Emoji-only reactions (👏, 🔥, 🎥, 💯) and a feedback feed.

### ⚙️ The "Engine" (Backend)
- **HLS Pipeline:** Background video transcoding using FFmpeg and BullMQ.
- **Metadata Extraction:** Automatically captures bitrate, codecs, and resolution.
- **Dynamic Storage:** Admin-configurable upload and storage directories.
- **First-User Admin:** The first person to register automatically gains "Sponsor" privileges.

### 🛠️ Sponsor Control (Admin)
- **Global Kill-Switch:** Instantly hide any video from the archive.
- **Queue Monitor:** Real-time progress bars for active transcoding jobs.
- **Comment Scrubbing:** Full moderation list with "Delete" and "Pin" capabilities.
- **User Management:** Toggle administrative permissions for other students.

---

## 🛠️ Technical Stack

- **OS:** Fedora 43+ (Linux) / macOS (Development)
- **Backend:** Node.js (Express) + Prisma ORM
- **Frontend:** Vite + React + Tailwind CSS
- **Database:** SQLite (local file-based)
- **Processing:** FFmpeg (HLS) + Redis/BullMQ (Job Queue)
- **Streaming:** HLS (Adaptive Bitrate)

---

## 📦 Installation & Setup

### 1. Prerequisites
- **Node.js** (v18+)
- **FFmpeg** (v5.0+)
- **Redis** (Local instance)

### 2. Backend Setup
```bash
# Install dependencies
npm install

# Initialize Database
npx prisma db push
npx prisma generate

# Set Environment Variables
# Create a .env file based on the template:
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

## 🚦 How to Run

### **A. Development Mode**
Start the API and the Transcoding Worker in separate terminals:
```bash
# Terminal 1: API
npm run dev

# Terminal 2: Worker
npm run worker

# Terminal 3: Frontend
cd frontend && npm run dev
```

### **B. Production Mode (Systemd)**
For deployment on Fedora, copy the provided `.service` files to `/etc/systemd/system/`:
```bash
sudo cp vault.service /etc/systemd/system/
sudo cp vault-worker.service /etc/systemd/system/
sudo systemctl enable --now vault vault-worker
```

---

## 🛡️ Sponsor Maintenance Tool
Use the included bash script for common maintenance tasks:
```bash
./scripts/vault-admin.sh {backup|clean|restart|ip}
```
- **backup:** Zip the database and uploads folder.
- **clean:** Purge the temporary upload buffer.
- **restart:** Cycle the systemd services.
- **ip:** Scan the LAN for the current server address.

---

## 🧪 Automated Testing
Verify the integrity of the system using the built-in TDD suite:
```bash
npm test
```

---
**The Vault** – *Preserving the next generation of visual storytellers.*
