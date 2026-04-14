# PLAN.md: "The Vault" – High School A/V Studio Console

## 1. Project Vision
A high-performance, LAN-exclusive video repository. Unlike a public social media site, this is designed to look and feel like a **Professional Studio Console**. It prioritizes technical metadata, high-bitrate playback, and granular administrative control.

## 2. Technical Stack
* **OS:** Fedora 43+ (Linux).
* **Backend:** Node.js (Express) + Prisma ORM.
* **Frontend:** Vite + React + Tailwind CSS.
* **Database:** SQLite (local file-based, easy to backup).
* **Processing:** FFmpeg (HLS transcoding) + Redis/BullMQ (Job Queue).
* **Streaming:** HLS (Adaptive bitrate).

---

## 3. Visual Identity: "The Studio Console"
Avoid the "YouTube White" aesthetic. The AI Coder should follow these UI guidelines:
* **Base Theme:** Deep Onyx (#0A0A0A) background with Slate (#1E293B) cards.
* **Accent Color:** "Record Red" (#BE123C) for active buttons and live indicators.
* **Components:** * Use **glassmorphism** for overlays.
    * Videos should display technical badges (e.g., `1080p`, `HLS`, `CC`) on the thumbnail.
    * The "Theater View" should be distraction-free: the video takes up 80% of the screen, with comments in a toggleable side drawer.

---

## 4. The "Sponsor Control" (Moderation & Admin)
The `/admin` dashboard is the most critical part of the build. It must include:

| Feature | Functionality |
| :--- | :--- |
| **Global Kill-Switch** | One-click to set any video to "Private" or "Hidden." |
| **Comment Scrubbing** | A list view of all comments with a "Delete" button next to each. |
| **Video Pinning** | A "Featured" toggle that moves a video to the top of the LAN landing page. |
| **Queue Monitor** | A progress bar showing how much of the transcoding queue is finished. |
| **User Management** | Reset student passwords and toggle "Admin" permissions. |

---

## 5. Engineering Requirements

### **A. Video Processing Pipeline**
1.  **Upload:** Accept `.mp4`, `.mov`, and `.mkv`.
2.  **Transcode:** Use FFmpeg to generate an HLS playlist (`.m3u8`).
    * *Constraint:* Ensure the server does not hang during transcoding; use a background worker.
3.  **Captions:** Look for an associated `.vtt` or `.srt` file. Convert to `.vtt` for web compatibility.

### **B. Engagement Logic**
* **Reactions:** Use an "Emoji-only" like system (👏, 🔥, 🎥, 💯).
* **Comments:** Support basic text. Admins can "Pin" a comment to the top (e.g., for teacher feedback).

---

## 6. Linux System & Maintenance Tools
The AI Coder should generate a `scripts/` directory containing the following:

### **The "Sponsor Tool" (`vault-admin.sh`)**
A bash script for the sponsor to run via terminal for quick maintenance:
1.  **Backup:** Zip the SQLite database and `/uploads` folder to a designated external path.
2.  **Clean Cache:** Delete any "orphaned" temporary files from failed uploads.
3.  **Restart:** A one-liner to restart the `systemd` services for the site.
4.  **IP Update:** A command to quickly re-bind the server if the LAN assigns a new IP.

### **Systemd Integration**
The plan includes creating a `vault.service` file to ensure the site launches automatically on Fedora boot without a user needing to log in.

---

## 7. Development Phases
1.  **Phase 1:** Core API and SQLite schema setup.
2.  **Phase 2:** FFmpeg worker implementation (The "Engine").
3.  **Phase 3:** "Studio Console" Frontend (The "Look").
4.  **Phase 4:** Admin/Moderation tools and Engagement features.
5.  **Phase 5:** Deployment scripts and Bash utility tool.

---