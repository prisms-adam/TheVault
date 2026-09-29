# The Vault 项目导览（源码核对版）

本文说明当前仓库实际包含什么、网站各页面做什么，以及 PRISMS Audio/Video Club 每周发布 Action News 时怎样使用它。内容以当前源码为准；[README](./README.md)、[项目计划](./PLAN.md) 和 [Changelog](./CHANGELOG.md) 中尚未落地或已与实现不一致的部分，会单独标出。

## 1. 项目范围

The Vault 是一个面向校内局域网的视频归档站，界面名称为 **THE AVC VAULT**。它提供视频上传、后台 HLS 转码、分类展示、播放、弹幕、评论/表情/赞踩，以及管理员管理视频、栏目、用户、评论和 bug 的功能。

Git 仓库只跟踪程序源码、数据库结构、部署脚本和测试。它**不包含学校的实际 SQLite 数据库、账号、上传视频、HLS 切片或缩略图**；`*.db`、`uploads/`、`temp/` 和 `.env` 都被 [.gitignore](./.gitignore) 排除。仓库中的 [scripts/check-recovery.js](./scripts/check-recovery.js) 虽然写有示例标题 `Action News - S4E23`，但这只是查找本机数据库记录的恢复脚本，不是节目数据或媒体文件。

## 2. 网站页面与用户看见的内容

前端统一挂载在 `/vault`，路由定义见 [frontend/src/App.tsx](./frontend/src/App.tsx)。顶部导航显示 **THE AVC VAULT**、**Archive**，未登录时显示 **Access**；管理员登录后会多出 **Admin**。页脚显示 `Made with love by the PRISMS Audio/Video Club, 2026`。

| 地址 | 页面 | 可见内容与用途 |
| --- | --- | --- |
| `/vault/` | 归档首页 | 按管理员创建的栏目展示公开视频。视频卡片显示标题、缩略图、HLS/分辨率标记、赞数、观看数、时长和可选的 `New!` 角标。每个栏目可按上传时间、名称、时长、赞数或观看数排序。没有视频时显示 `The Archive is currently empty.`。没有匹配任何栏目的视频进入 **General Archive**。实现见 [Home.tsx](./frontend/src/pages/Home.tsx)。 |
| `/vault/video/:id` | 视频详情 | HLS 播放器及 Auto/720p/1080p 清晰度选择、标题、观看数、标签、支持 GitHub Flavored Markdown 的描述、表情反应、赞/踩和评论。无描述时显示 `No session metadata provided.`；评论区标题为 **COMMENTS**。登录用户可互动，管理员可置顶或删除评论。实现见 [VideoView.tsx](./frontend/src/pages/VideoView.tsx) 和 [VideoPlayer.tsx](./frontend/src/components/VideoPlayer.tsx)。 |
| `/vault/login` | 登录/注册 | 在 **Console Access** 和 **New Enrollment** 两种表单之间切换。用户名至少 3 个字符，密码至少 6 个字符；数据库中的第一个注册用户自动成为管理员。实现见 [Login.tsx](./frontend/src/pages/Login.tsx) 和 [auth.js](./src/routes/auth.js)。 |
| `/vault/admin` | 管理台 | 标题为 **ADMIN CONSOLE / Master Control & Video Ingestion**。六个标签页是 **Queue Monitor、Videos、Categories、Users、Comments、Bug List**。上传区接收最高 5 GB 的 `.mp4`、`.mov` 或 `.mkv`；其他页用于公开视频/隐藏、编辑标题/描述/标签、标记 Featured/New、重试或永久删除，管理栏目和用户，清理评论，以及记录/关闭 bug。界面见 [Admin.tsx](./frontend/src/pages/Admin.tsx)，受保护的服务端操作见 [admin.js](./src/routes/admin.js)。 |

`/vault/admin` 本身没有前端路由守卫，因此任何人都能打开页面外壳；不过所有 `/vault/api/admin/*` 请求都必须通过登录和管理员权限检查，非管理员不能取得或修改管理数据。

## 3. 数据库的 9 个模型

完整定义在 [prisma/schema.prisma](./prisma/schema.prisma)，数据库使用 SQLite。

| 模型 | 保存的内容 |
| --- | --- |
| `User` | 用户名、bcrypt 密码哈希、管理员标记、创建/更新时间，以及评论、表情、投票和其关闭的 bug。 |
| `Video` | 标题、Markdown 描述、状态、HLS/缩略图/原片路径、Featured/New 标记、技术元数据、逗号分隔标签、观看数、时长、赞数和互动关系。 |
| `Category` | 首页栏目名称、标签查询字符串和显示顺序。 |
| `Vote` | 某用户对某视频的 `1`（赞）或 `-1`（踩）；同一用户和视频只保留一条。 |
| `Comment` | 评论正文、置顶标记、作者、视频及时间。 |
| `Danmaku` | 弹幕正文、视频时间（秒）、滚动/顶部/底部模式、颜色、字号、作者、视频和创建时间；删除作者或视频时级联删除。 |
| `Reaction` | 用户对视频添加的 emoji；同一用户、视频和 emoji 组合唯一。 |
| `Setting` | 简单的键值设置。目前代码只读取 `upload_directory`。 |
| `BugReport` | 管理台 bug 的标题、描述、OPEN/CLOSED 状态，以及关闭者和关闭时间。 |

`Video.tags` 不是标签关联表，而是普通字符串。首页按“不区分大小写的子字符串包含关系”匹配 `Category.tagQuery`。因此标签 `newsroom` 也会匹配查询 `news`，同一视频也可以同时出现在多个栏目中。

## 4. 上传、转码与发布的真实链路

```text
登录用户选择视频
  → POST /vault/api/videos/upload
  → Multer 写入 temp/，Video 状态设为 PROCESSING
  → BullMQ 把任务写入 Redis 的 video-processing 队列
  → 独立 worker 用 FFprobe 读取技术元数据
  → 在视频目录生成 640×360 缩略图
  → 单个 FFmpeg 进程用 h264_nvenc 生成 720p/2500k 和 1080p/5000k HLS
  → 写入 master.m3u8
  → Video 状态自动改为 PUBLIC，并保存 HLS、缩略图、时长和元数据
  → 删除 temp/ 中的高码率原片
```

上传 API 在 [videos.js](./src/routes/videos.js)，队列连接在 [queues.js](./src/queues.js)，转码与发布逻辑在 [worker-process.js](./src/worker-process.js)。API、静态媒体和前端的挂载方式见 [src/index.js](./src/index.js)。

几个操作含义需要分清：

- 上传进度 `INGESTING n%` 只表示浏览器向服务器传输文件的 HTTP 进度，不是转码进度。
- worker 成功后立即把视频设为 `PUBLIC`，没有“等待管理员审核后发布”的中间状态。
- 管理员把状态从 `PUBLIC` 切成 `HIDDEN` 后，视频不会出现在首页；再次切回 `PUBLIC` 才重新出现。
- 转码失败会把状态设为 `ERROR` 并保留临时原片，管理台可尝试 **Retry Transcoding**。成功后原片已删除，因此后续无法再用该原片重转；数据库的 `originalPath` 仍保留已失效的路径。
- 当前转码明确要求 FFmpeg 支持 NVIDIA `h264_nvenc`。代码使用普通 `scale` 滤镜，而不是 Changelog 所说的 `scale_cuda`。没有可用 NVIDIA GPU/驱动或 NVENC 编码器时，任务会失败为 `ERROR`，代码没有 CPU 编码回退。

## 5. 每周 Action News 的实际操作流程

当前系统没有定时发布或周期任务。每期节目都需要手动上传、补标签并控制公开状态。

1. 第一次部署时，由负责老师或固定维护者先注册，确保这个首个账号获得管理员权限。之后在 **Users** 中管理其他成员的 Student/Admin 身份。
2. 在 **Admin → Categories** 新建栏目：`Section Name` 填 `Action News`，`Tag Filter` 填 `news`，`Display Order` 填期望的首页顺序。这个栏目通常只需创建一次。
3. 在 **Admin → Queue Monitor** 选择本周成片，填写清晰的标题和描述后上传。描述支持 Markdown，但上传表单没有标签字段。
4. 等待队列从 Waiting/Active 结束，并在 **Videos** 中确认视频状态变成 `PUBLIC`。上传成功只代表文件已进队；转码完成才代表可播放。
5. 在 **Videos** 编辑该视频，把 `Tags` 填为 `news`。如需多个标签，用逗号分隔，例如 `news, 2026, season-5`。保存后它会进入 **Action News** 栏目。
6. 可手动打开 `New` 标记显示黄色 `New!` 角标。下一期发布后，再手动关闭上一期的 `New` 标记；系统不会自动过期。
7. 从首页打开视频，实际检查缩略图、声音、Auto/720p/1080p 播放、描述和标签。源码中的静态检查不能替代这一步播放验收。

如果节目必须在指定时间上线，现有最接近的做法是：转码完成后手动设为 `HIDDEN`，到发布时间再手动改为 `PUBLIC`。仓库里没有排程字段、定时器或自动发布服务。

`Featured` 按钮当前只会修改数据库字段和按钮外观。首页虽然读取了 `isFeatured`，却没有据此置顶、分组或排序，所以它**不会把节目推到首页顶部**。每周流程中不要依赖它；栏目顺序、标签和 `New` 标记才会产生可见效果。

## 6. 认证、互动和管理规则

- 首页视频列表、单个公开视频详情、栏目列表、缩略图和 HLS 文件都不要求登录；任何能访问服务器地址的人都能读取 `PUBLIC` 内容。静态媒体路由也不检查视频状态，因此知道具体媒体 URL 的人仍可直接请求已设为 `HIDDEN` 的 HLS/缩略图。登录只用于上传和互动，管理员权限用于后台管理。
- 上传接口只检查“已登录”，没有检查管理员身份。正常界面把上传入口放在管理台，但任何已登录用户都可直接调用上传 API。
- 打开视频详情会立即把观看数加一，包括页面刷新；没有去重或播放时长门槛。
- emoji 反应是切换操作；同一 emoji 再点一次会移除。选择器允许全部 emoji，不限于计划文档举例的四种。
- 赞/踩按用户唯一。显示的 `likes` 是所有投票值相加后最小为 0 的结果。
- 评论作者可删除自己的评论，管理员可删除或切换置顶。当前详情页仍按最新时间排序，置顶评论只改变外观，并不会真的排到最前面。
- 弹幕在播放器下方的 **Danmaku / 弹幕** 区域操作：登录后可选 Scroll/Top/Bottom、颜色和 18/24/32px 字号，内容限制 80 字，每次发送间隔至少两秒。弹幕记录当前视频时间并保存到数据库，暂停、拖动、重播和倍速时跟随播放进度。播放区右上角的全屏按钮会同时放大视频和弹幕层。
- **messages** 展开弹幕列表，点击时间可跳转，作者和管理员可删除；其他观众每十秒同步一次新增和删除。弹幕开关和透明度保存在当前浏览器。拥挤时会隐藏放不下的弹幕，所有记录仍保留在列表中。
- 管理员可改用户名、重置密码、切换权限和删除其他用户；系统阻止管理员删除自己。

## 7. 关键源码地图

| 位置 | 职责 |
| --- | --- |
| [src/index.js](./src/index.js) | Express 入口；挂载 API、媒体文件、生产前端和 `/vault` SPA 回退。 |
| [src/routes/auth.js](./src/routes/auth.js) / [src/middleware/auth.js](./src/middleware/auth.js) | 注册、登录、登出、当前用户、JWT 校验和管理员授权。 |
| [src/routes/videos.js](./src/routes/videos.js) | 上传、公开视频列表和视频详情/观看计数。 |
| [src/routes/admin.js](./src/routes/admin.js) | 视频、队列、用户、栏目、全站评论和 bug 的管理员 API。 |
| [src/routes/comments.js](./src/routes/comments.js) / [reactions.js](./src/routes/reactions.js) / [votes.js](./src/routes/votes.js) | 三类互动 API。 |
| [src/routes/danmaku.js](./src/routes/danmaku.js) | `GET/POST /vault/api/danmaku/:videoId` 读取/发送，`DELETE /vault/api/danmaku/:id` 删除；登录、输入与所有权校验。 |
| [frontend/src/components/Danmaku.tsx](./frontend/src/components/Danmaku.tsx) | 媒体时钟驱动的弹幕层、轨道分配、发送/删除、显示偏好和列表。 |
| [src/queues.js](./src/queues.js) / [src/worker-process.js](./src/worker-process.js) | Redis/BullMQ 队列和 FFmpeg 后台处理。 |
| [src/config.js](./src/config.js) / [src/db.js](./src/db.js) | 上传目录设置读取和 Prisma 客户端。 |
| [frontend/src/App.tsx](./frontend/src/App.tsx) | 导航、四个页面路由和页脚。 |
| [frontend/src/pages](./frontend/src/pages) | 首页、详情、登录和管理台界面。 |
| [frontend/src/lib/api.ts](./frontend/src/lib/api.ts) | `/vault/api` Axios 客户端和 Bearer token 注入。 |
| [prisma/schema.prisma](./prisma/schema.prisma) | SQLite 的 9 个数据模型。 |
| [start.sh](./start.sh) / [vault.service](./vault.service) / [vault-worker.service](./vault-worker.service) | Fedora/Linux 启动和 systemd 部署。 |
| [scripts/vault-admin.sh](./scripts/vault-admin.sh) | Linux 备份、临时目录清理、服务重启和 IP 查询。 |
| [tests](./tests) | Jest/Supertest 的认证、管理、互动和转码参数测试。 |

## 8. 文档与实现之间的差距

| 文档中的说法 | 当前源码实际情况 |
| --- | --- |
| Featured 会把视频移到首页顶部 | 字段和管理按钮存在，但 [Home.tsx](./frontend/src/pages/Home.tsx) 没有使用它进行排序或展示。 |
| Queue Monitor 有实时转码进度条 | 管理台每 10 秒读取 active/waiting/failed 数量；worker 没有调用 BullMQ 的 `job.updateProgress()`。红条只在存在 active 任务时全宽闪烁，不表示百分比。 |
| 管理员可动态配置上传/存储目录 | [config.js](./src/config.js) 会读取 `Setting.upload_directory`，服务端也尝试按该值提供文件；但没有设置 API，也没有管理台界面。只能直接改数据库或另写工具，普通管理员在网站里无法配置。 |
| 自动发现 `.vtt`/`.srt` 并提供字幕 | 这只出现在 [PLAN.md](./PLAN.md)。上传表单、数据库、worker、HLS 主清单和播放器都没有字幕处理或字幕轨道。 |
| 置顶评论显示在最上方 | `isPinned` 可切换并改变样式，但详情页仍明确按 `createdAt` 从新到旧排序。 |
| GPU 转码使用 `scale_cuda` | 当前 worker 使用 `h264_nvenc` 编码，但滤镜字符串是普通 `scale=...`。 |
| 项目是 LAN-exclusive | 默认监听地址是 `0.0.0.0`，且公开视频 API/媒体没有认证。它适合部署在受控校内网络，但应用本身不强制“仅校内”。 |

## 9. 后续维护前应先处理的既有风险

以下是源码中已经存在的问题，本文只记录，没有修改实现：

1. **不要直接在真实数据库上运行 `npm test`。** [auth.test.js](./tests/auth.test.js)、[admin.test.js](./tests/admin.test.js) 和 [engagement.test.js](./tests/engagement.test.js) 都复用 [src/db.js](./src/db.js) 和当前 `DATABASE_URL`，并在测试开始时执行多项 `deleteMany()`。新增的弹幕测试会拒绝真实数据库，但这不能保护其他旧测试；运行完整套件前仍须显式连接独立测试数据库。
2. **存在 Vote 外键导致删除失败的风险。** 删除视频或用户时，[admin.js](./src/routes/admin.js) 只先删 `Reaction` 和 `Comment`，没有删 `Vote`；Schema 的 Vote 关系也没有 `onDelete: Cascade`。已有投票时，永久删除视频/用户可能因外键约束返回 500。
3. **媒体不受认证或视频状态保护。** `/vault/api/videos`、`/vault/api/videos/:id`、缩略图和 HLS 路径允许未登录访问；把记录设为 `HIDDEN` 只会从列表和详情 API 隐藏它，不会阻止已知 HLS URL 的直接访问。若站点暴露到校外网络，链接持有者可直接读取节目。
4. **非公开视频的详情检查发生得太晚。** `GET /videos/:id` 没有运行可选身份解析，却在数据库更新观看数之后才检查状态；访问 `HIDDEN/PROCESSING/ERROR` 记录会先增加观看数再返回 404，管理员 token 在这个路由上也不会被识别为管理员。
5. **成功转码删除原片且没有 CPU 回退。** 这节省空间，但成片若需重新编码，只能从另行保存的校内母版重新上传。部署前应把母版保存在 The Vault 之外的可靠存储中。

在修复第 1 项之前，如需验证生产或学校数据环境，只运行不会写数据库的构建/静态检查，或先显式建立隔离的测试数据库。任何涉及真实节目播放、GPU 转码、局域网终端访问和发布时序的结论，都需要在目标机器上单独做运行验收。
