# 音乐室账号维护

网易云账号属于站长，访客只能播放音乐、搜索歌曲和调整本机偏好。

公开网站不提供 Cookie 输入、扫码登录、登录态刷新或凭据读取。`/api/netease/cookie`、`cookie-bootstrap`、`cookie-refresh`、`qr-login` 均返回 403；伪造 localhost Host/Origin 也不能启用。播放接口只读取服务端 `NETEASE_COOKIE`，忽略访客传入的账号凭据，不再维护共享的可写进程登录态。

站长继续使用本机工具维护：

- `scripts/netease-qr-cli.mjs` 直接向网易云创建、检查登录二维码，不依赖公开网站的管理接口。
- `scripts/sync-netease-cookie.ps1` 保留本机 Cookie 同步流程。
- `scripts/push-netease-cookie-to-vercel.ps1` 将本机 Cookie 更新至已配置的 Vercel 项目环境变量；更新后需要重新部署才能让运行实例采用新值。

访客预设导入导出只处理播放列表和视觉偏好，忽略旧文件中的 `neteaseCookie` 字段。前端不再自动读取、上传或刷新浏览器中历史保存的网易凭据。不要把 Cookie 文件、Vercel 凭据或含凭据的旧预设分享给访客。

回归检查：`node --test tests/netease-owner-security.test.mjs`。
