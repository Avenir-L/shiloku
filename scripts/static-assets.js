(function (global) {
    const CDN_BASE = 'https://cdn.jsdelivr.net/gh/Avenir-L/shiloku@main';
    const CDN_FILES = new Set([
        'avatar.jpg',
        'bg.jpg',
        'watermark.mp4',
        'watermark-mobile.mp4',
    ]);
    const isLocal = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);

    global.shilokuAssetUrl = function assetUrl(file) {
        if (!file || isLocal) return file;
        const name = String(file).replace(/^\//, '');
        return CDN_FILES.has(name) ? `${CDN_BASE}/${name}` : file;
    };

    global.shilokuApplyStaticAssets = function applyStaticAssets() {
        document.querySelectorAll('img[data-shiloku-asset]').forEach((img) => {
            const file = img.getAttribute('data-shiloku-asset');
            if (file) img.src = global.shilokuAssetUrl(file);
        });
        document.documentElement.style.setProperty(
            '--shiloku-bg-url',
            `url("${global.shilokuAssetUrl('bg.jpg')}")`,
        );
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', global.shilokuApplyStaticAssets, { once: true });
    } else {
        global.shilokuApplyStaticAssets();
    }
}(window));
