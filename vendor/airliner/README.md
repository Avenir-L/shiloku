# Three.js 官方客机加载与检查工具

2026-11-18：GLTFLoader.r128.js 已用于云海和模型检查页；OrbitControls.r128.js 仅用于airliner-model.html观察原模型。GLTFExporter暂未加载。客机使用用户下载的完整A320 V2 GLB，不是自建几何。下文准备/等待文件是此前历史状态，当前交接以integration-status.md顶部为准。

客机模型尚未下载或接入；这里不是飞机几何模型。用户最新要求先搜索现成高精度模型，暂停自建实现。候选记录在 Shiloku网站/06-参考源码/客机模型候选/README.md。

以下为 Three.js r128 官方原文件，通过 GitHub 连接器获取；未从 integration.html 加载，不改变当前云海、歌词或播放器。

- OrbitControls.r128.js：https://github.com/mrdoob/three.js/blob/r128/examples/js/controls/OrbitControls.js
- GLTFExporter.r128.js：https://github.com/mrdoob/three.js/blob/r128/examples/js/exporters/GLTFExporter.js
- GLTFLoader.r128.js：https://github.com/mrdoob/three.js/blob/r128/examples/js/loaders/GLTFLoader.js
- THREE-LICENSE.txt：https://github.com/mrdoob/three.js/blob/r128/LICENSE

后续若使用旋转控制，仅用于检查模型外观；云海中的飞机按用户要求自动从右往左慢慢掠过，不设置飞行方向控制。

2026-11-17 后续：用户已授权继续接入首选A320 V2。实际打开原作者页并点击下载后，出现Sketchfab登录窗口；用户明确选择自行下载到本地，再告知路径。目前等模型文件，不绕过登录获取模型，不以自建飞机或低精度替代品填充。官方GLTFLoader已备好，仍不从云海入口加载。用户新增要求飞行速度合理；拿到原模型后结合实际远景尺寸、镜头和航线校准，不能提前把任意横穿时长冒充已经验证的合理巡航速度。
