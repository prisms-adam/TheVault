# PRISMS Google 学校账号登录配置

The Vault 支持 Google OpenID Connect 登录，只接受经过 Google 验证的 `@prismsus.org` 学校账号。当前接入代码已提供；需要创建学校的 Google OAuth 客户端并配置后，真实账号才能登录。无需向 The Vault 提供 Google 密码。

## 管理员与身份显示

以下三个邮箱在首次成功通过 Google 登录后自动创建网站账号并获得管理员权限，比较邮箱时忽略大小写：

| 邮箱 | 网站权限 |
| --- | --- |
| `adam.kemp@prismsus.org` | 管理员 |
| `Benjamin.Zhao@prismsus.org` | 管理员 |
| `Annie.ye@prismsus.org` | 管理员 |

名单位于 `src/auth/googleOAuth.js` 的 `ADMIN_EMAILS`。其他经过验证的学校用户默认不是管理员，可以评论、发弹幕等互动；管理员可以上传视频、管理内容、分类和用户。上传接口在读取文件之前检查管理员权限，与管理台入口的权限一致。

名单中的用户每次 Google 登录都会重新获得管理员权限；如果以后需要撤销其中一人的权限，先从名单移除，再在管理台取消该账号的管理员角色。名单只作用于经过 Google 验证的身份，注册相同字符串的本地用户名不会获得这些权限。

评论和展开后的弹幕列表显示 Google 姓名、学校邮箱和学校验证标记；旧本地账号显示用户名与 `Local` 标记。账号以稳定的 Google `sub` 关联，姓名或学校邮箱改变不会创建另一个账号。现有本地账号不会因为用户名相似而自动合并成 Google 账号，已有评论和弹幕保留原作者。

## 1. 在 Google Cloud 创建 OAuth 客户端

由拥有学校 Google Cloud 项目权限的维护者操作：

1. 打开 [Google Cloud Console](https://console.cloud.google.com/)，选择或创建属于学校 Google Workspace 组织的项目。
2. 在 **Google Auth Platform** 配置 Branding（应用名称可填 `The Vault`，并设置学校支持邮箱和开发者联系人）。在 Audience 中选择 **Internal**，使应用仅供学校组织使用。
3. 在 Data Access 中使用基础身份范围 `openid`、`email`、`profile`。不需要 Drive、Gmail 或离线访问权限。
4. 在 Clients 创建 **Web application** 类型的 OAuth 客户端。
5. 添加本地 Authorized redirect URI，必须逐字匹配：

   ```text
   http://127.0.0.1:3000/vault/api/auth/google/callback
   ```

6. 保存 Client ID 和 Client Secret。Client Secret 仅放到服务器的 `.env` 文件；不要放进前端 `VITE_*` 变量、源代码、聊天或 GitHub。

学校组织之外的 Cloud 项目可能没有 **Internal** 选项；这时需要组织管理员协助，或使用 External 测试模式并添加测试用户。无论 Google 控制台选择什么受众，应用服务器仍会验证学校域名。学校管理员也可能需要在 Workspace 的第三方应用访问控制中允许此 OAuth 客户端。

这是服务器重定向流程，无需配置 JavaScript origin 或浏览器 Google SDK。配置上述本地回调时，浏览器请使用 `http://127.0.0.1:3000/vault/`，避免将 `localhost` 和 `127.0.0.1` 混用。正式部署应注册网站实际的 HTTPS 回调，例如 `https://<学校实际域名>/vault/api/auth/google/callback`，并将服务器配置改成完全相同的地址。

## 2. 填写服务器 `.env`

保留现有 `DATABASE_URL`、`JWT_SECRET`、Redis 等配置，仅增加：

```dotenv
GOOGLE_CLIENT_ID="填写实际 Web OAuth Client ID"
GOOGLE_CLIENT_SECRET="填写实际 Client Secret"
GOOGLE_REDIRECT_URI="http://127.0.0.1:3000/vault/api/auth/google/callback"
ALLOW_LOCAL_AUTH=false
```

`ALLOW_LOCAL_AUTH=false` 关闭本地密码登录与注册，并拒绝之前签发的本地账号会话，适合学校部署。首次管理员不依赖“第一个注册用户”，由上述经过验证的三人名单决定。

本地还没有 Google 凭据时，可继续使用原来的测试账号：不配置两项 Google 凭据即可；如需在接入调试期间同时保留本地登录，可显式设 `ALLOW_LOCAL_AUTH=true`。只填写部分 Google 凭据或填写无效回调地址时，默认不会重新开放本地登录，需要修正配置。

应用使用现有网站会话 Cookie；不会把 Google ID token 放进回调后的 URL，也不存储 Google access/refresh token。Google 账号不允许通过本地密码登录或由网站管理员重置 Google 密码。

## 3. 更新数据库与启动

数据库新增 `User.email`、`User.googleSub` 和 `User.displayName` 三个可空字段及唯一索引，旧用户数据无需改写。新增 SQL 位于 `prisma/migrations/20261013000000_add_google_sso_identity/migration.sql`。

对于尚未添加这三个字段的旧实例，先停止该项目服务，备份 `prisma/dev.db` 和媒体目录，再在项目根目录执行一次增量 SQL：

```powershell
npx prisma db execute --file prisma/migrations/20261013000000_add_google_sso_identity/migration.sql --schema prisma/schema.prisma
npx prisma generate
Push-Location frontend
npm run build
Pop-Location
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\windows.ps1 Start
```

本机实例已于 2026-10-13 应用这份增量 SQL，备份为 `.local/pre-google-sso-20261013.db`，无需再次执行。该 SQL 不可重复运行，已有这些字段的数据库应跳过升级步骤。对于全新空数据库，使用项目已有的 `npx prisma db push` 初始化方式；本仓库历史迁移不是完整的新数据库基线，不要直接套用迁移目录重建数据库，也不要执行数据库 reset。仅修改 `.env` 时，重新启动 API 即可读取新配置。

## 4. 配置完成后的验收

1. 打开 `/vault/login`，确认 Google 登录按钮可用；`ALLOW_LOCAL_AUTH=false` 时不应显示本地注册表单。
2. 用普通学校账号登录，确认姓名和邮箱正确、角色不是管理员。
3. 三位指定用户分别登录，确认能够进入管理台。
4. 使用个人 Gmail 或其他组织账号应被拒绝，不应创建网站用户。
5. 发送评论和弹幕，再刷新或用另一位观众查看，确认作者姓名与学校邮箱正确。
6. 退出登录，确认会话清除；取消 Google 授权或使用过期登录页面时，应返回明确的重试提示。

自动测试使用隔离数据库与测试 RSA 密钥签发的模拟 Google 响应，覆盖令牌验证、浏览器绑定、重放、管理员名单和作者信息。它们不代表真实学校 OAuth 客户端已经通过 Google 验收；取得客户端凭据后需完成上述实际登录检查。

当前登录事务保存在单个 API 进程内，十分钟过期、使用后销毁；服务重启后进行中的 Google 登录需要重新开始。若以后部署多台 API 实例，需要将事务改为共享存储或使用固定会话路由。

## 官方参考

- [Google OpenID Connect 服务器流程](https://developers.google.com/identity/openid-connect/openid-connect)
- [Google ID token 验证与学校域校验](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token)
- [Web 应用 OAuth 配置与回调地址要求](https://developers.google.com/identity/protocols/oauth2/web-server)
- [Google Auth Platform Audience 设置](https://support.google.com/cloud/answer/15549945?hl=en)
