# 站长管理后台

当前范围：通行密钥登录、网易云账号状态/扫码/手动更新、通行密钥追加登记、离线恢复码，以及独立的留言只读面板。空间页面明确标记尚未接入；后续图文、草稿、发布及日志使用独立内容数据库，不复用留言数据。

## 本地查看

`npm ci`、`npm run build`、`node scripts/admin-preview.mjs`。

打开 `http://localhost:8785/admin/`。此预览使用内存中的独立认证数据、模拟音乐和模拟留言，不访问生产存储。一次性测试初始化凭证保存在 `.scratch/admin/local-preview.json`，仅供本机预览。重启预览会清空全部模拟数据。测试凭证与正式域名不能互通，不要将预览服务暴露到公网。

## 正式启用前

1. 确认部署目标为 `avenir`（实际服务于 `www.shiloku.cn`），Node.js 24；构建执行 `npm run build`，保留根目录静态站结构。
2. 配置服务端 Redis REST 变量：`KV_REST_API_URL/TOKEN` 或 `UPSTASH_REDIS_REST_URL/TOKEN`。不改留言已有数据键。
3. 配置 `ADMIN_ORIGIN=https://www.shiloku.cn`。登录必须固定使用这一域名；跨设备通行密钥验证由系统负责，需要兼容设备和蓝牙等条件。
4. 在可信本机生成 32 字节随机密钥并以 base64 写入服务端 `ADMIN_ENCRYPTION_KEY`，离线备份。它用于 AES-256-GCM 加密网易云 Cookie，不进入浏览器或 Git。更换它之前必须迁移/重新加密已有密文，不能直接覆盖。
5. 发布后，在可信本机以相同服务端变量运行 `node --env-file=.env.admin.local scripts/admin-bootstrap.mjs`。不要将 env 文件加入 Git。工具将 30 分钟有效的一次性初始化地址写入 `.scratch/admin/owner-setup.txt`，不在终端打印凭证。
6. 站长本人打开初始化地址，使用 iPhone 或 Windows Hello 登记第一个通行密钥。初始化提交以 Redis 事务原子地登记凭据并关闭入口，不开放自助注册。
7. 登录后尽快添加备用设备并生成恢复码，离线保存。恢复码仅保存哈希、每个只能使用一次；恢复会话只能登记新密钥，不能读写音乐或留言。恢复登记成功时，原通行密钥全部替换并退出其他会话；之后请重新登记备用设备。不要在公共设备上保存通行密钥。
8. 本人用网易云 App 扫描后台二维码并确认。服务端验证成功才加密替换旧凭据；失败不会覆盖旧账号。所有访客可用的新音乐请求读取持久化凭据，无需重新部署。现有播放不会被强制打断。原部署 `NETEASE_COOKIE` 仅在尚未保存后台账号时作为兼容回退。

## 权限与隔离

- 认证使用 SimpleWebAuthn，要求用户验证。挑战 5 分钟有效、一次消费，严格核对 RP ID 和 Origin。
- 会话为随机不透明令牌，数据库仅以哈希索引；生产 Cookie 使用 `__Host-` 前缀、Secure、HttpOnly、SameSite=Strict，1 小时有效。敏感操作要求最近 5 分钟内通过验证。
- 管理写接口要求匹配 Origin 的 JSON POST，并有请求频率和内容长度限制；数据存储失败时拒绝操作。
- 账号凭据和二维码上游 key 不返回浏览器；二维码轮询绑定当前管理会话。
- 公开 `/api/netease/cookie`、`cookie-bootstrap`、`cookie-refresh`、`qr-login` 继续返回 403，不因后台上线而恢复。
- 管理数据使用 `shiloku:admin:v1:*`，音乐账号使用 `shiloku:music:v1:account`。留言仅执行现有键 `shiloku:guestbook:v1` 的读取，没有添加、删除或迁移操作。
- 不向前端暴露 Redis token、加密密钥或网易 Cookie。页面不使用第三方 CDN，动态文字用 textContent 渲染。

## 迁移与恢复

单独备份管理员凭据（公钥、设备信息）、音乐密文、加密密钥及恢复码哈希。临时会话和挑战无需迁移。保留域名、RP ID、Origin 后，可迁移通行密钥公钥记录到新后台。留言和未来空间数据库分别迁移、分别核对。

可在账号与安全页面移除设备，操作要求最近 5 分钟内验证过身份，且至少保留一个可用通行密钥。移除时同时撤销全部现存会话，需要用保留的凭据重新登录。未登记任何可用凭据且恢复码丢失时，不提供公开重置入口，需要站长从可信基础设施恢复。

## 验证

`npm run build`

`node --test tests/admin*.test.mjs tests/netease-owner-security.test.mjs tests/chat-security.test.mjs tests/guestbook-persistence.test.mjs`

单元测试覆盖加密、防篡改、未授权拦截、跨来源拒绝、真实签名验证、Origin/用户验证、挑战重放、初始化关闭、扫码会话隔离和凭据持久化。浏览器使用本机软件认证器响应验证完整页面流程，不等于已经测试用户真实 iPhone/Windows Hello，也不代表已完成网易云扫码授权。
