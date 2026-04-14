# Changelog

All notable changes to this project will be documented in this file.

## [1.0.0] - 2026-04-14

### Added
- Core API & Infrastructure: Node.js/Express, Prisma/SQLite, JWT auth, Redis/BullMQ.
- Video Processing Pipeline: FFmpeg HLS transcoding, metadata extraction, thumbnails.
- Frontend: Vite/React/TS/Tailwind v4 "Studio Console".
- Admin Console: Video management, User management (password reset, rename, permissions), Comment moderation.
- Deployment: Systemd service files, Maintenance shell script.

### Fixed
- Frontend build errors (Tailwind v4, React imports).
- MIME-type support for .mov uploads.
- Asset loading and connectivity issues for cross-network access.
- User management and password validation feedback.
