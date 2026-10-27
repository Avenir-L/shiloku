// Render only the background: page text and controls stay sharp and interactive.
export async function prepareBackgroundDissolve(origin) {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return null;
    const background = document.getElementById('bg-image');
    const host = background?.parentElement;
    if (!host || !document.body.classList.contains('bg-ready')) return null;
    const before = getComputedStyle(background, '::before');
    const style = getComputedStyle(background);
    const visible = Number(before.opacity) > .5 ? before : style;
    const url = /^url\(["']?(.*?)["']?\)$/.exec(visible.backgroundImage)?.[1];
    if (!url) return null;
    const image = new Image();
    await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = reject;
        image.src = url;
    });
    const width = innerWidth, height = innerHeight;
    const pixelRatio = Math.min(devicePixelRatio || 1, 1.5);
    const canvas = document.createElement('canvas');
    canvas.className = 'background-dissolve';
    canvas.setAttribute('aria-hidden', 'true');
    canvas.width = Math.ceil(width * pixelRatio);
    canvas.height = Math.ceil(height * pixelRatio);
    const context = canvas.getContext('2d');
    if (!context) return null;
    // A single native-sized source surface avoids rescaling the photograph per particle.
    const source = document.createElement('canvas');
    source.width = canvas.width; source.height = canvas.height;
    const paint = source.getContext('2d');
    if (!paint) return null;
    paint.scale(pixelRatio, pixelRatio);
    const rect = background.getBoundingClientRect();
    const scale = Math.max(rect.width / image.naturalWidth, rect.height / image.naturalHeight);
    const imageWidth = image.naturalWidth * scale, imageHeight = image.naturalHeight * scale;
    const position = visible.backgroundPosition.split(' ').map(value => parseFloat(value) / 100);
    const x = rect.left + (rect.width - imageWidth) * (Number.isFinite(position[0]) ? position[0] : .5);
    const y = rect.top + (rect.height - imageHeight) * (Number.isFinite(position[1]) ? position[1] : .5);
    paint.filter = style.filter;
    paint.drawImage(image, x, y, imageWidth, imageHeight);
    context.scale(pixelRatio, pixelRatio);
    const ox = Math.max(0, Math.min(width, origin?.x ?? width * .22));
    const oy = Math.max(0, Math.min(height, origin?.y ?? height * .2));
    const farthest = Math.max(...[[0, 0], [width, 0], [0, height], [width, height]].map(([x, y]) => Math.hypot(x - ox, y - oy)));
    const size = width < 769 ? 18 : 24;
    const tiles = [];
    for (let y = 0; y < height; y += size) for (let x = 0; x < width; x += size) {
        const noise = Math.random();
        tiles.push({x, y, w: Math.min(size, width - x), h: Math.min(size, height - y),
            start: Math.hypot(x + size / 2 - ox, y + size / 2 - oy) / farthest * 2050 + noise * 150,
            drift: 12 + noise * 38, angle: Math.atan2(y - oy, x - ox) - .6});
    }
    let frame = 0;
    let stopped = false;
    const cancel = () => {
        stopped = true;
        cancelAnimationFrame(frame);
        canvas.remove();
        window.removeEventListener('resize', cancel);
        document.removeEventListener('visibilitychange', onVisibility);
    };
    const onVisibility = () => { if (document.hidden) cancel(); };
    return {
        cancel,
        play() {
            if (stopped) return;
            host.append(canvas);
            window.addEventListener('resize', cancel, {once: true});
            document.addEventListener('visibilitychange', onVisibility);
            const start = performance.now();
            const draw = now => {
                if (stopped) return;
                const elapsed = now - start;
                context.clearRect(0, 0, width, height);
                for (const tile of tiles) {
                    const progress = Math.max(0, (elapsed - tile.start) / 500);
                    if (progress >= 1) continue;
                    const {x, y, w, h} = tile;
                    if (progress === 0) {
                        context.globalAlpha = 1;
                        context.drawImage(source, x * pixelRatio, y * pixelRatio, w * pixelRatio, h * pixelRatio, x, y, w, h);
                    } else {
                        // Each passing wave breaks the old photograph into fading, outward-drifting grains.
                        for (let gy = 0; gy < h; gy += 6) for (let gx = 0; gx < w; gx += 6) {
                            const scatter = Math.sin((x + gx) * 12.9898 + (y + gy) * 78.233) * 43758.5453;
                            const random = scatter - Math.floor(scatter);
                            const grain = Math.min(6, w - gx, h - gy);
                            const shift = tile.drift * progress * progress * (0.5 + random * 2);
                            const remain = 1 - progress;
                            const angle = tile.angle + (random - .5) * 2.4;
                            context.globalAlpha = remain;
                            context.drawImage(source, (x + gx) * pixelRatio, (y + gy) * pixelRatio, grain * pixelRatio, grain * pixelRatio,
                                x + gx + Math.cos(angle) * shift, y + gy + Math.sin(angle) * shift - progress * 24, grain * remain * (0.5 + random * .5), grain * remain * (0.5 + random * .5));
                        }
                    }
                }
                context.globalAlpha = 1;
                if (elapsed < 2800) frame = requestAnimationFrame(draw);
                else cancel();
            };
            draw(start);
        },
    };
}
