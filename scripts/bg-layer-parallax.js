/**
 * 2.5D layered parallax — four PNG layers with different shift speeds.
 */
const MANIFEST_URL = 'bg-layers/manifest.json';

function isDisabled() {
    return window.matchMedia(
        '(prefers-reduced-motion: reduce), (max-width: 768px), (hover: none) and (pointer: coarse)'
    ).matches;
}

function canAnimate() {
    return document.body.classList.contains('bg-ready')
        && document.body.classList.contains('intro-done')
        && !document.body.classList.contains('in-music-room');
}

export async function initBgLayerParallax(host) {
    if (!host || isDisabled()) return null;

    let manifest;
    try {
        const res = await fetch(MANIFEST_URL, { cache: 'no-cache' });
        if (!res.ok) return null;
        manifest = await res.json();
    } catch {
        return null;
    }

    const fallback = document.getElementById('bg-image');
    const stack = document.createElement('div');
    stack.className = 'bg-parallax-stack';
    stack.id = 'bg-parallax-stack';
    stack.setAttribute('aria-hidden', 'true');

    const layerEls = await Promise.all(
        manifest.layers.map(async (layer) => {
            const src = `bg-layers/${layer.file}`;
            await new Promise((resolve, reject) => {
                const probe = new Image();
                probe.onload = resolve;
                probe.onerror = reject;
                probe.src = src;
            });
            const img = document.createElement('img');
            img.className = `bg-parallax-layer bg-parallax-${layer.id}`;
            img.src = src;
            img.alt = '';
            img.draggable = false;
            img.dataset.depth = String(layer.depth);
            stack.appendChild(img);
            return { el: img, depth: layer.depth };
        })
    ).catch(() => null);

    if (!layerEls?.length) return null;

    host.appendChild(stack);

    const maxShift = manifest.maxShift ?? 28;
    const focusX = manifest.focusX ?? 0.58;
    const overscan = manifest.overscan ?? 1.08;

    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;
    let rafId = null;

    function applyShift() {
        layerEls.forEach(({ el, depth }) => {
            const px = currentX * maxShift * depth;
            const py = currentY * maxShift * depth;
            el.style.transform = `translate3d(${px}px, ${py}px, 0) scale(${overscan})`;
        });
    }

    function onMouseMove(e) {
        if (!canAnimate()) return;
        targetX = (e.clientX / window.innerWidth - 0.5) * 2;
        targetY = (e.clientY / window.innerHeight - 0.5) * -2;
    }

    function frame() {
        rafId = requestAnimationFrame(frame);
        const active = canAnimate();
        const ease = active ? 0.07 : 0.1;
        const tx = active ? targetX : 0;
        const ty = active ? targetY : 0;
        currentX += (tx - currentX) * ease;
        currentY += (ty - currentY) * ease;
        applyShift();

        const show = document.body.classList.contains('bg-ready')
            && !document.body.classList.contains('in-music-room');
        stack.style.opacity = show ? '1' : '0';
        if (fallback) {
            fallback.style.opacity = show && document.body.classList.contains('bg-layers-ready') ? '0' : '';
        }
    }

    window.addEventListener('mousemove', onMouseMove, { passive: true });
    document.body.classList.add('bg-layers-ready');
    stack.style.setProperty('--bg-focus-x', `${focusX * 100}%`);
    frame();

    return () => {
        cancelAnimationFrame(rafId);
        window.removeEventListener('mousemove', onMouseMove);
        stack.remove();
        document.body.classList.remove('bg-layers-ready');
        if (fallback) fallback.style.opacity = '';
    };
}
