// Give the original SVG chain a scene-only SourceGraphic. DOM labels and other
// glass surfaces cannot enter this buffer, including during camera movement.
function createSceneGlass(wallpaper, overlay, cloudFrame,finish) {
  const sky = new Image();
  sky.src = wallpaper.container.style.backgroundImage.slice(4, -1).replace(/^["']|["']$/g, '');
  const entries = new Map();
  let previous = -Infinity;
  function attach(host, id) {
    const frame = document.createElement('span');
    frame.className = 'scene-glass-frame';
    frame.setAttribute('aria-hidden', 'true');
    const canvas = document.createElement('canvas');
    canvas.style.filter = 'url(#' + id + ')';
    frame.append(canvas);
    host.prepend(frame);
    host.classList.add('scene-glass-host');
    return { host, canvas, context: canvas.getContext('2d') };
  }
  return function draw(now) {
    if (!sky.naturalWidth || now - previous < 1000 / 24 || !document.documentElement.classList.contains('control-glass-svg-ok')) return;
    previous = now;
    let clouds;
    for (const [selector, id] of [['#bottom-bar', 'mineradio-control-glass-filter'], ['.nav-prototype-header', 'navigation-header-glass-filter']]) {
      const host = document.querySelector(selector);
      if (!host || host.hidden || !document.getElementById(id)) continue;
      if (selector === '#bottom-bar' && (!host.classList.contains('visible') || host.classList.contains('soft-hidden'))) continue;
      if (!entries.has(host)) entries.set(host, attach(host, id));
      const {canvas, context} = entries.get(host);
      const width = host.offsetWidth, height = host.offsetHeight;
      const rect = host.getBoundingClientRect();
      if (!width || !height || !rect.width || !rect.height) continue;
      if (canvas.width !== width) canvas.width = width;
      if (canvas.height !== height) canvas.height = height;
      context.setTransform(width / rect.width, 0, 0, height / rect.height, -rect.left * width / rect.width, -rect.top * height / rect.height);
      if(document.getElementById('station-journey')?.dataset.stage==='station'){
        window.stationGlassFrame(context);
      } else {
        // The Wallpaper page keeps its original sky gradient in this canvas.
        context.drawImage(sky, 0, 0, innerWidth, innerHeight);
        clouds ||= cloudFrame();
        context.drawImage(clouds, 0, 0, innerWidth, innerHeight);
        finish(context);
        context.drawImage(overlay, 0, 0, innerWidth, innerHeight);
        if (window.stationGlassFrame) window.stationGlassFrame(context);
      }
      if (selector === '.nav-prototype-header') {
        const daily = document.getElementById('daily-scene');
        const photo = daily?.querySelector('img');
        if (photo?.naturalWidth && !daily.hidden) {
          const alpha = Number(getComputedStyle(daily).opacity);
          if (alpha > 0) {
            const scale = Math.max(innerWidth/photo.naturalWidth, innerHeight/photo.naturalHeight);
            const w = photo.naturalWidth*scale, h = photo.naturalHeight*scale;
            context.globalAlpha = alpha;
            context.drawImage(photo,(innerWidth-w)*(innerWidth<=620?.33:.5),(innerHeight-h)*.52,w,h);
            context.globalAlpha = 1;
          }
        }
      }
    }
  };
}
