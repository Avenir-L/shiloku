(function (global) {
    const CDN_BASE = 'https://cdn.jsdelivr.net/gh/Avenir-L/shiloku@main';
    const CDN_VERSION = '20260701b';
    const CDN_FILES = new Set([
        'avatar.jpg',
        'bg.jpg',
        'watermark.mp4',
        'watermark-mobile.mp4',
    ]);
    const CDN_MEDIA = /\.(mp3|jpe?g|png|lrc)$/i;
    const isLocal = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);

    global.shilokuAssetUrl = function assetUrl(file) {
        if (!file || isLocal) return file;
        const name = String(file).replace(/^\//, '');
        if (/^https?:\/\//i.test(name)) return file;
        if (CDN_FILES.has(name) || CDN_MEDIA.test(name)) {
            return `${CDN_BASE}/${name}?v=${CDN_VERSION}`;
        }
        return file;
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
