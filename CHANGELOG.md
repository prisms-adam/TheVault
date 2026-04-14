# Changelog

All notable changes to this project will be documented in this file.

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
