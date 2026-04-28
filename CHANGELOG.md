# Changelog

All notable changes to this project will be documented in this file.

## [1.5.0] - 2026-04-28

### Added
- **NVIDIA GPU Acceleration:**
  - Integrated NVIDIA NVENC (`h264_nvenc`) for hardware-accelerated video transcoding.
  - Added `-hwaccel auto` and `-hwaccel_output_format cuda` for high-speed input decoding.
  - Optimized for high-end GPUs (RTX 5090) using `p7` high-quality presets and `hq` tuning.
- **High-Bitrate Support:**
  - Increased file upload limit to 5GB (backend and frontend).
  - Added frontend file size validation and error reporting in Admin Console.
  - Implemented manual Quality Selector (1080p, 720p, Auto) in the Video Player.
- **Storage Optimization:**
  - Automatic cleanup of original high-bitrate source files after transcoding completion.

### Fixed
- **Upload Reliability:**
  - Increased server timeouts (1 hour) to prevent cancellation of large file transfers over LAN.

## [1.4.0] - 2026-04-22

### Fixed
- **Startup Script:**
  - Fixed `sudo` PATH inheritance issue for NVM-installed Node.js tools (npm/npx).
  - Added automatic detection of user's home directory when running with root privileges.
  - Improved Redis/Valkey fallback startup logic.
- **Prisma Compatibility:**
  - Downgraded from Prisma 7 to 6.2.1 to maintain compatibility with existing schema.
  - Restored `DATABASE_URL` in datasource configuration for proper migration support.
- **Frontend Build:**
  - Fixed missing state variables (`editingVideo`, `editData`) in Admin.tsx causing TypeScript compilation errors.

## [1.3.0] - 2026-04-22

### Added
- **Categorization & Engagement System:**
  - Added video tagging system for categorized homepage sections.
  - Implemented Admin Console category management.
  - Added video engagement features: Like/Dislike thumbs and view counting.
  - Implemented automatic sorting by upload date, name, length, likes, and views.
  - Added automatic duration extraction for all videos.
- **Maintenance:**
  - Updated `start.sh` to automatically clean up lingering processes on startup.

## [1.1.0] - 2026-04-22

### Added
- **Orchestration:**
  - Created `start.sh` for one-command startup of Backend, Worker, and Frontend.
  - Automated `.env` generation and Redis health checks in the start script.
  - Automated SQLite database initialization and directory setup.
- **Networking:**
  - Enabled LAN-wide access for the Vite frontend.
  - Added automatic LAN IP detection to the startup output for easier remote access.

## [1.0.0] - 2026-04-14

### Added
- **Core API & Infrastructure:**
  - Initialized Node.js/Express backend with Prisma/SQLite.
  - Implemented JWT authentication and automated admin promotion for the first registered user.
  - Set up Redis and BullMQ for asynchronous background video transcoding.
- **Video Processing Pipeline:**
  - FFmpeg integration for HLS adaptive bitrate streaming (1080p and 720p).
  - Automated metadata extraction and thumbnail generation (2%).
  - Dynamic storage configuration for video assets.
- **Frontend ("Studio Console"):**
  - Vite + React + TypeScript + Tailwind CSS (v4) build.
  - "Deep Onyx" theme with "Record Red" accents.
  - Theater mode for high-quality HLS playback using `hls.js`.
  - Google Chat-style emoji reaction system with grouping and persistent user states.
  - Responsive Video Grid with dynamic asset URL handling for cross-network access.
- **Admin/Moderation Controls:**
  - Sponsor Console for video ingestion, status management (Kill-Switch), and pinning.
  - Comment moderation (Delete/Pin) and User Management (Rename/Password Reset/Toggle Admin).
  - Inline metadata editing for video assets.
- **Maintenance & Deployment:**
  - Comprehensive `vault-admin.sh` utility script.
  - Systemd service files for automated startup on Linux/Fedora.
  - Automated testing suite (11/11 tests passed for Auth, Admin, and Engagement).

### Fixed
- Resolved frontend build errors (Tailwind v4 configuration and missing React imports).
- Fixed MIME-type restrictions preventing `.mov` uploads.
- Resolved static file serving issues for dynamic upload directories.
- Addressed session persistence and Admin navigation visibility using LocalStorage.
- Corrected cross-network connectivity for API and media assets.
- Improved registration feedback for password length requirements.
- Fixed reaction system UI positioning and state persistence.
- Added emergency admin promotion tool for user recovery.
