# Shiloku 项目语境

个人主页 + 音乐室（全屏 3D 可视化 + 播放器）。

## 模块

| 名称 | 路径 | 说明 |
| --- | --- | --- |
| 主页 | 仓库根或 `index.html` | 自我介绍、链入音乐室 |
| 音乐室 | `#music-room` | 全屏视效与播放界面 |
| 视效宿主 | `#music-viz-host` | Three.js 方块地形，`scripts/sonic-topography-viz.js` |
| 播放器 UI | `.aether-player` | 右上角（手机端底部）播放控制 |
| 歌词区 | `.aether-lyrics` | 滚动歌词，原文 + 中文翻译 |
| 本地预览 | `scripts/start-local-preview.bat` | 端口 8765，含网易云代理；启动前会自动清旧进程 |
| 停止预览 | `scripts/stop-local-preview.bat` | 释放 8765 端口 |
| 网易云代理 | `/api/netease/*` | 仅本地预览服务器提供 |

## 术语

- **音乐室**：进入 `#music-room` 后的沉浸式播放页，不是旧版唱片 UI。
- **视效释放**：暂停时方块缓慢落下，由 `visualReleaseMs` 控制。
- **本地歌单**：仓库内 `.mp3` + `.lrc` 文件。
- **网易云队列**：通过搜索播放的在线歌曲列表 `neteaseQueue`。

## 部署

- 静态站可部署到 Vercel（`vercel.json`）。
- 大文件音频/图片在仓库内；`scripts/secrets.local.json` 勿提交。
