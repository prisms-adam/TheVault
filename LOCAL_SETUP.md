# The Vault 本地运行说明

本地准备日期：2026-09-12。仓库：<https://github.com/prisms-adam/TheVault>，分支 `main`。2026-09-28 已从原基线 `9d3028f` 快进同步至 `537d6ac`（上游新增 MIT License），并保留本地 Windows 兼容改动。

## 当前入口

- 首页：<http://127.0.0.1:3000/vault/>
- 登录与注册：<http://127.0.0.1:3000/vault/login>
- 管理员后台：<http://127.0.0.1:3000/vault/admin>

下文命令均在本机克隆的 `TheVault` 项目根目录执行。

这是独立的本地实例。Git 仓库不包含学校线上数据库、账号或已上传的视频。2026-09-12 按要求保留了 6 段生成的测试视频及 Action News、Campus Life、Studio Tests 三个分类，便于继续浏览和测试。测试管理员为 `vault_demo`，密码保存在 Git 忽略的 `.local/demo-access.json` 中；目前第一个管理员已创建，之后新注册的账号默认不是管理员。

## 启动、查看状态、停止

在该项目目录打开 PowerShell：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows.ps1 Start
powershell -ExecutionPolicy Bypass -File .\scripts\windows.ps1 Status
powershell -ExecutionPolicy Bypass -File .\scripts\windows.ps1 Stop
```

启动脚本在后台运行三个进程：Redis、Node API、视频 Worker；前端构建文件由 API 一并提供。重复 `Start` 会复用本次实例。`Stop` 通过记录的 PID、程序路径和进程创建时间确认归属，结束对应的 API/Worker 进程树（包括其 FFmpeg 子进程），并等待退出。Redis 使用正常 shutdown 保存队列数据。

无需开启三个终端，也无需启动 Vite 开发服务器。没有安装系统服务或开机自启；电脑重启后重新执行 `Start`。当前只绑定 `127.0.0.1`，其他电脑无法访问此实例。

## 已准备的环境

| 组件 | 本机配置 |
| --- | --- |
| Node.js / npm | 复用已有的 Node.js `24.16.0` / npm `11.13.0` |
| 后端依赖 | 根目录 `npm ci`，使用仓库 lockfile |
| 前端依赖 | `frontend` 目录 `npm ci`，使用仓库 lockfile |
| Prisma | lockfile 实际安装 `6.19.3`，已生成 Client、同步 schema |
| SQLite | `prisma/dev.db`，由 `.env` 的 `DATABASE_URL` 指向 |
| Redis | `.local/redis/`，Windows 社区移植版 `7.2.16`，本地端口 `6389` |
| 队列数据 | `.local/redis-data/`，开启 AOF 持久化 |
| FFmpeg / FFprobe | 使用仓库已有 `ffmpeg-static` / `ffprobe-static` 依赖提供的程序 |
| 视频编码 | FFmpeg `6.1.1`，本机 NVIDIA GeForce RTX 5070 Ti 的 `h264_nvenc` |
| 前端构建 | `frontend/dist/`，React / TypeScript / Vite |

采用 Windows 本地运行方式，无需虚拟机、WSL、Docker 或系统重启。`.env` 已生成随机 JWT 密钥，不要上传到 Git。`.local/`、数据库、依赖、上传文件与构建产物均被 Git 忽略。

Redis 使用适合本地开发的[社区 Windows 发行版](https://github.com/redis-windows/redis-windows/releases/tag/7.2.16)，并非 Redis 官方 Windows 二进制。下载的固定文件为 `Redis-7.2.16-Windows-x64-msys2.zip`，SHA-256 已核验：

```text
BCBFDA1DDA027BEAEA4D616F8992F9B6353613C1B1F4D0E4A6776940BB036347
```

原 ZIP 保留在 `.local/`。若需要重装，将其解压后的目录内容放入 `.local/redis/`，确保 `.local/redis/redis-server.exe` 和 `redis-cli.exe` 存在。

## 必要的本地兼容修改

- `src/worker-process.js`：启动时加载 `.env`；实际转码使用已解析的 FFmpeg 路径，支持 Windows；每个输出都映射音频，避免 1080p 缺音轨；处理子进程启动失败。
- `src/index.js`：新增可选 `HOST` 环境变量，使本地实例绑定回环地址；未配置时仍沿用原本的 LAN 监听默认值。
- `tests/transcoding.test.js`：改为项目 Jest 可执行的测试，验证实际 FFmpeg 路径、双清晰度与音轨映射、启动错误。导入 Worker 模块不再自动连接 Redis。
- `scripts/windows.ps1`、`.env.example`、`.gitignore`：本地后台启动、配置示例和运行产物忽略。

上述 Windows 运行支持与弹幕功能一起维护在 `codex/danmaku` 分支；实际配置、账号、数据库和媒体文件不随代码提交。

## 2026-09-28 弹幕功能

播放器下方新增 **Danmaku / 弹幕**：支持滚动、顶部、底部弹幕，颜色、字号、开关、透明度和带跳转时间的列表。登录后可发送，作者和管理员可删除。弹幕使用视频时间同步，其他观众每十秒获取更新；全屏请使用播放器右上角的按钮。

已在 [Action News - Week 01 (Demo)](http://127.0.0.1:3000/vault/video/dd901954-0adf-4f37-b4aa-d10d3cc91cfa) 保留三条样例弹幕，分别在 1、2.5 和 4 秒出现。原来的 1 个账号、6 段视频和 3 个分类均保留。

数据库升级只新增 `Danmaku` 表和索引，备份为 `.local/pre-danmaku-20260928-201037.db`。增量迁移源文件在 `prisma/migrations/20260928000000_add_danmaku/migration.sql`；本机按现有 `db push` 工作流应用，未重置数据库。

本次 Chromium 验收通过：三种模式、暂停/拖动/重播/2 倍速、开关和透明度的刷新持久化、容器全屏、登录发送及刷新保留、纯文本显示、作者/管理员删除、第二个观众的轮询同步，以及 390px 窄屏控件布局。追加验收了加载失败恢复、80 个 emoji 的计数/限制，以及 720p/1080p/Auto 切换后继续播放，记录为 `.local/danmaku-edge-report.json`。桌面与窄屏截图为 `.local/danmaku-ready.png` 和 `.local/danmaku-mobile.png`；尚未在真实 iPhone 原生全屏播放器上验收。

## 每周 NEWS 使用流程

1. 注册本地管理员并进入 Admin Console。
2. 在 **Categories** 创建分类，例如 Section Name 为 `Action News`，Tag Filter 为 `news`。此分类通常只需创建一次。
3. 在 **Queue Monitor** 页的 **Source Ingestion** 填标题、描述并上传 `.mp4`、`.mov` 或 `.mkv`。代码设定单个文件最大 5 GB。
4. 等待后台完成转码；视频状态从 `PROCESSING` 变为 `PUBLIC`。
5. 在 **Videos** 给视频添加含 `news` 的标签，需要时开启 **New** 标记；首页就会显示在 Action News 分类中。

当前程序完成转码后会自动公开并删除其临时上传原文件，只保留 HLS 成品和缩略图。学校的视频母版应继续保存在你们原有的存档位置。已有节目和分类需要学校原站的数据备份才能迁移，这次克隆没有获取这些内容。

更多页面、数据结构、接口、维护脚本和现有实现差异见 [PROJECT_GUIDE.zh-CN.md](PROJECT_GUIDE.zh-CN.md)。

## 后续编辑与验证

前端改动后运行：

```powershell
Set-Location frontend
npm run build
Set-Location ..
```

后端代码改动后先 `Stop` 再 `Start`。数据模型修改需要单独评估，再执行 Prisma 同步命令；启动脚本不会自动重建或清空数据库。

首次安装全新副本的顺序为：准备 `.env` → 根目录与 `frontend` 分别 `npm ci` → 初始化 SQLite → `npx prisma db push` → `npx prisma generate` → 构建前端 → 放置 Redis → `Start`。本机 Prisma 在数据库文件不存在时出现了空的 schema engine error，先用 `New-Item -ItemType File prisma/dev.db` 创建空文件后初始化成功；只应对不存在的新数据库这样操作。

原仓库的 `npm test` 会清空它连接的数据库。首次部署在独立的 `.local/jest.db` 上运行了 13 项测试；2026-09-28 最终在独立的 `.local/danmaku-concurrency-test.db` 上运行了全部 5 个套件、33 项测试，均通过，包括并发发送只有一条成功的原子冷却验证，日志为 `.local/logs/danmaku-jest-final.log`。不要直接让测试连接已开始使用的 `prisma/dev.db`。首次浏览器与视频链路验证结果为 `.local/verification.json`，弹幕验证结果为 `.local/danmaku-browser-report.json`。

本机首次部署完成的实际验证：后台启动和重复启动、Windows PowerShell 5 停止/重启、浏览器注册首个管理员、通过管理台上传生成的测试视频、Redis/BullMQ 入队并转码、720p/1080p 两路 H.264 视频和 AAC 音轨、HLS/切片范围请求、Chromium 实际播放超过 1 秒、NEWS 标签分类、六个管理页签。另用 60 秒测试片在 FFmpeg 正在运行时停止服务，确认子进程结束；重启后 BullMQ 自动恢复并完成被中断的任务。首次验证数据已清理，随后另行创建并保留了目前使用的演示账号、6 段视频和 3 个分类。上述短片检查没有覆盖学校实际长视频、5 GB 上传、校内跨设备访问或长期稳定运行。

前端 `npm run build` 通过；`npm run lint` 仍报告原仓库的 29 个错误和 1 个警告，主要是 `any`、React Hooks 和未使用变量。它们没有阻止本次构建，但这次没有扩展为全站代码整理。

## 日志与数据位置

- API：`.local/logs/api.out.log`、`api.err.log`
- 转码：`.local/logs/worker.out.log`、`worker.err.log`
- Redis：`.local/logs/redis.out.log`、`redis.err.log`
- 测试：`.local/logs/jest.log`、`.local/verification.json`
- 正式本地数据库：`prisma/dev.db`
- 转码后媒体：`uploads/<video-id>/`
- 临时上传：`temp/`

备份实际使用的数据时，停止本地服务后保存 `prisma/dev.db` 与 `uploads/`；如有未完成的上传任务，一并保存 `temp/` 和 `.local/redis-data/`。源仓库中的 Linux `start.sh` 会按名称结束所有 Node 进程，因此这台电脑使用上述 Windows 启动器。
