# 主站内容管理

后台「主站内容」管理共享头像、昵称、副昵称、中文/英文/日文简介、了解更多弹窗和画作列表
保存并发布后，主站下一次加载读取新版本，不需要重新部署

- `api/admin?action=content-get|content-save|content-upload` 沿用站长会话、同源 JSON POST 和请求限流
- `GET /api/site-content` 只返回公开资料及未隐藏画作，不返回后台凭据或原画作来源路径
- `GET /api/site-content?avatar=1` 不缓存地转到当前主站头像，供个人空间等页面复用
- 前端共享模块 `scripts/site-profile.js` 同步 `#site-avatar`、`[data-site-avatar]` 和 `[data-site-nickname]`
- 主站中英日切换使用保存的对应语言文案，未编辑的初始资料沿用原文案

内容保存在现有 Redis 的 `shiloku:content:v1`，未保存过时从当前静态文案和作品清单建立初始视图
画作显示顺序与后台列表一致，`wip` 和 `hidden` 可分别设置
版本号通过 Lua CAS 比较，旧页面保存会返回 409，保留页面内编辑并要求重新载入

图片在浏览器解码后以 WebP 质量 0.94 编码，头像最长边不超过 1024，画作最长边初始不超过 2400
超过 600,000 字节时逐步缩小尺寸，源文件限制 12 MB
服务端只接受具备对应文件签名的 JPG/PNG/WebP，不允许 SVG、外部 URL 或任意站内资源作为上传图片
图片按 SHA-256 寻址，存于 `shiloku:content-image:v1:<hash>`，公开图片 URL 不含原文件名
未发布图片保留 7 天，发布时转为持久保存，重复上传不会缩短已发布图片的寿命
「移出展示」移除画作条目，不破坏原始文件及旧图片链接

个人空间仍为本地布局预览；该网页的作者头像已改为共享头像地址，正式接入时同样使用共享资料
聊天内的静态布局示意与实际网页数据独立

本地隔离验证：先 `npm run build`，设置 `SHILOKU_PREVIEW_PORT=8786` 后运行 `node scripts/admin-preview.mjs`
进入 `http://localhost:8786/admin/preview`，仅本机内存存储，既不读取也不修改线上数据库
