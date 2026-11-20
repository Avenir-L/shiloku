(function initIntroSplash() {
            const splash = document.getElementById('intro-splash');
            const mount = document.getElementById('splash-motion');
            const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
            const mobileViewport = window.matchMedia('(max-width: 768px), (hover: none) and (pointer: coarse)');
            // Daily-space return links already target page three; do not replay the opening.
            if (location.hash === '#daily-entry' || !splash || !mount || reducedMotion.matches) {
                splash?.remove();
                document.body.classList.add('intro-done');
                return;
            }

            document.body.classList.add('splash-active');
            const slowPreview = new URLSearchParams(location.search).get('intro-network') === 'slow';
            let finished = false;
            let animationFrame = 0;
            let deadline = 0;
            let updateViewport = null;

            const finish = () => {
                if (finished) return;
                finished = true;
                clearTimeout(deadline);
                cancelAnimationFrame(animationFrame);
                splash.removeEventListener('click', finish);
                if (updateViewport) mobileViewport.removeEventListener('change', updateViewport);
                document.body.classList.remove('splash-active');
                document.body.classList.add('intro-done');
                splash.classList.add('is-exiting');
                const removeSplash = () => splash.remove();
                splash.addEventListener('animationend', (event) => {
                    if (event.target === splash && event.animationName === 'splashExit') removeSplash();
                }, { once: true });
                setTimeout(removeSplash, 700);
            };

            splash.addEventListener('click', finish);
            // A failed/slow animation download must never trap the visitor.
            deadline = setTimeout(finish, 5000);
            import('./intro-motion-20261026.js').then(({ IntroMotion, DEFAULTS }) => {
                if (finished) return;
                const motion = new IntroMotion(mount);
                const settings = { ...DEFAULTS };
                updateViewport = () => motion.svg.setAttribute('preserveAspectRatio',
                    mobileViewport.matches ? 'xMidYMid slice' : 'xMidYMid meet');
                updateViewport();
                mobileViewport.addEventListener('change', updateViewport);
                splash.dataset.introDuration = String(settings.duration);
                splash.dataset.introRenderer = 'svg';
                motion.render(0, settings);
                clearTimeout(deadline);
                deadline = setTimeout(finish, slowPreview ? 35000 : 15000);
                // Reuse the original lettering and sweep clips. The cutout exposes
                // the live homepage through the letters during the final pass.
                const defs = motion.svg.querySelector('defs');
                defs.insertAdjacentHTML('beforeend', `
                    <linearGradient id="intro-daylight" gradientUnits="userSpaceOnUse" x1="0" x2="105">
                        <stop stop-color="#86caff"/><stop offset=".4" stop-color="#c4ebff"/>
                        <stop offset="1" stop-color="#656f80"/>
                    </linearGradient>
                    <mask id="intro-window" maskUnits="userSpaceOnUse" x="-4000" y="-4000" width="10000" height="10000">
                        <rect x="-4000" y="-4000" width="10000" height="10000" fill="white"/>
                        <g clip-path="url(#outline-clip)"><use id="intro-cutout" href="#solid-vector" fill="black" fill-rule="evenodd" opacity="0"/></g>
                    </mask>`);
                defs.insertAdjacentHTML('afterend', `
                    <rect x="-4000" y="-4000" width="10000" height="10000" fill="black" mask="url(#intro-window)"/>`);
                motion.nodes['outline-vector'].parentNode.insertAdjacentHTML('afterbegin',
                    '<use id="intro-ink" href="#solid-vector" fill="url(#intro-daylight)" fill-rule="evenodd"/>');
                const daylight = defs.querySelector('#intro-daylight');
                const cutout = defs.querySelector('#intro-cutout');
                const ink = motion.svg.querySelector('#intro-ink');
                motion.nodes['solid-vector'].parentNode.setAttribute('fill', 'url(#intro-daylight)');
                splash.style.background = 'transparent';
                let shown = 0, seconds = 0, sawFrame = false;
                let startTime = null;
                const milestones = [0, 3, 6.5, 9.5, 13];
                let elapsed = 0;
                let openingStarted = null;
                const svg = motion.svg;
                const word = motion.nodes['solid-vector'];
                let split;
                function prepareCurtains() {
                    const box = word.getBBox();
                    const y = box.y + box.height / 2;
                    // The italic S and U meet the seam inside their bounding box.
                    let left = box.x, right = box.x + box.width;
                    while (left < right && !word.isPointInFill(new DOMPoint(left, y))) left += .25;
                    while (right > left && !word.isPointInFill(new DOMPoint(right, y))) right -= .25;
                    const create = tag => document.createElementNS(svg.namespaceURI, tag);
                    const frame = create('g');
                    frame.id = 'intro-final-frame';
                    for (const child of [...svg.children]) {
                        if (child !== defs) frame.append(child);
                    }
                    defs.append(frame);
                    defs.insertAdjacentHTML('beforeend', `<radialGradient id="wing-light"><stop stop-color="#edfbff"/><stop offset=".28" stop-color="#c1e7ff" stop-opacity=".65"/><stop offset="1" stop-color="#a7dbff" stop-opacity="0"/></radialGradient>`);
                    frame.insertAdjacentHTML('beforeend', `
                        <path id="intro-wings" fill="none" stroke="#b5d7e7" stroke-width="1" vector-effect="non-scaling-stroke"/>
                        <g id="wing-glints" opacity="0" fill="url(#wing-light)">
                            <ellipse cy="${y}" rx="8" ry="2"/><ellipse cy="${y}" rx="8" ry="2"/>
                        </g>`);
                    function curtain(id, top, bottom) {
                        defs.insertAdjacentHTML('beforeend', `<clipPath id="${id}-clip"><rect x="-4000" y="${top}" width="10000" height="${bottom-top}"/></clipPath>`);
                        svg.insertAdjacentHTML('beforeend', `<g id="${id}"><g clip-path="url(#${id}-clip)"><use href="#intro-final-frame"/></g></g>`);
                        return svg.querySelector('#' + id);
                    }
                    return {y, left, right, glints: frame.querySelector('#wing-glints'), wings: frame.querySelector('#intro-wings'),
                        upper: curtain('intro-upper', -4000, y + 1), lower: curtain('intro-lower', y - 1, 6000)};
                }
                let subtitleHidden = false;
                const holdMs = 1250;
                const sweepMs = 1050;
                const settleMs = 200;
                const openEyes = (now) => {
                    if (finished) return;
                    if (openingStarted === null) {
                        split = prepareCurtains();
                        openingStarted = now;
                        clearTimeout(deadline);
                    }
                    const elapsedMs = now - openingStarted;
                    if (!subtitleHidden) {
                        const fade = Math.min(1, elapsedMs / 1000);
                        const opacity = 1 - fade * fade * (3 - 2 * fade);
                        motion.nodes['subtitle-vector'].setAttribute('opacity', opacity);
                        motion.nodes['subtitle-text'].setAttribute('opacity', opacity);
                        if (fade === 1) subtitleHidden = true;
                    }
                    const sweep = Math.max(0, Math.min(1, (elapsedMs - holdMs) / sweepMs));
                    const extent = sweep * sweep * (3 - 2 * sweep);
                    const matrix = svg.getScreenCTM();
                    const bounds = svg.getBoundingClientRect();
                    const x0 = (bounds.left - matrix.e) / matrix.a;
                    const x1 = (bounds.right - matrix.e) / matrix.a;
                    const { left, right, y } = split;
                    const leftTip = left + (x0 - left) * extent;
                    const rightTip = right + (x1 - right) * extent;
                    split.wings.setAttribute('d', `M${left} ${y}H${leftTip} M${right} ${y}H${rightTip}`);
                    split.glints.firstElementChild.setAttribute('cx', leftTip);
                    split.glints.lastElementChild.setAttribute('cx', rightTip);
                    split.glints.setAttribute('opacity', Math.min(1, sweep * 12, (1 - sweep) * 6));
                    const revealMs = elapsedMs - holdMs - sweepMs - settleMs;
                    if (revealMs <= 0) {
                        animationFrame = requestAnimationFrame(openEyes);
                        return;
                    }
                    const fraction = Math.min(1, revealMs / 4400);
                    const eased = fraction * fraction * (3 - 2 * fraction);
                    const top = (bounds.top - matrix.f) / matrix.d;
                    const bottom = (bounds.bottom - matrix.f) / matrix.d;
                    split.upper.setAttribute('transform', `translate(0 ${(top-y-2)*eased})`);
                    split.lower.setAttribute('transform', `translate(0 ${(bottom-y+2)*eased})`);
                    if (fraction === 1) finish();
                    else animationFrame = requestAnimationFrame(openEyes);
                };
                const animate = (now) => {
                    if (finished) return;
                    try {
                        const dt = startTime === null ? 0 : Math.max(0, (now-startTime)/1000);
                        startTime = now;
                        const cloud = document.querySelector('#wallpaper')?.contentWindow;
                        const nav = !!document.querySelector('.nav-prototype-header');
                        const texture = !!cloud?.material?.uniforms.map.value.image?.naturalWidth;
                        const rendered = document.querySelector('#wallpaper')?.dataset.fieldReady === 'true' && texture && Number.isFinite(cloud.position);
                        const ready = nav && rendered && sawFrame;
                        sawFrame = rendered;
                        const target = ready ? 1 : (1 + Number(nav) + Number(!!cloud?.renderer) + Number(texture))/5;
                        elapsed += dt;
                        // In the demo, stagger readiness milestones even on a warm local cache.
                        const simulated = slowPreview ? milestones.filter(at => elapsed >= at).length / 5 : 1;
                        shown = Math.min(target, simulated, shown + dt * (slowPreview ? .12 : .85));
                        daylight.setAttribute('gradientTransform', `translate(${650 + 535 * shown} 0)`);
                        // Hold the original readable outline until the homepage can take over.
                        const limit = shown === 1 ? settings.duration : settings.duration*.51;
                        seconds = Math.min(limit, seconds + dt);
                        motion.render(seconds, settings);
                        const reveal = Math.max(0, Math.min(1, (seconds / settings.duration - .83) / .13));
                        cutout.setAttribute('opacity', String(reveal));
                        ink.setAttribute('opacity', String(1 - reveal));
                        if (seconds >= settings.duration) openEyes(now);
                        else animationFrame = requestAnimationFrame(animate);
                    } catch {
                        finish();
                    }
                };
                animationFrame = requestAnimationFrame(animate);
            }).catch(finish);
        })();