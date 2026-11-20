/* Optional navigation example, enabled only by ?nav-preview=1.
 * New site navigation only: no native player, Wallpaper or camera overrides. */
(() => {
  'use strict';
  document.documentElement.dataset.navigationPrototype = 'true';
  const root = document.createElement('div');
  root.id = 'navigation-prototype';
  root.dataset.menuOpen = 'false';
  root.innerHTML = `
    <header class="nav-prototype-header" data-lyric-avoid>
      <button class="nav-prototype-brand" type="button" data-section="home" aria-label="SHILOKU 首页">
        <img class="nav-prototype-avatar" src="assets/profile/avatar.jpg" alt="" width="36" height="36">
        <span class="nav-prototype-brand-copy"><span class="nav-prototype-wordmark">SHILOKU.</span><span class="nav-prototype-nickname">栀落余殁</span></span>
      </button>
      <div class="nav-presence"><span class="presence-dot" aria-hidden="true"></span><span class="presence-window"><span class="presence-line">读取状态中</span></span></div>
      <nav class="nav-prototype-links" id="nav-prototype-links" aria-label="主导航">
        <button class="nav-prototype-link" type="button" data-section="home" aria-current="page">首页</button>
        <button class="nav-prototype-link" type="button" data-section="space" aria-controls="daily-scene">动态</button>
        <button class="nav-prototype-link" type="button" data-section="album" aria-controls="station-journey">相册</button>
        <button class="nav-prototype-link" type="button" data-section="music">音乐</button>
        <button class="nav-prototype-link" type="button" data-section="guestbook" aria-haspopup="dialog">留言</button>
        <button class="nav-prototype-link" type="button" data-section="about" aria-controls="station-journey">关于</button>
      </nav>
      <button class="home-sound" type="button" aria-label="开启背景音乐" title="开启背景音乐">
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M3 9h4l5-4v14l-5-4H3z"/>
          <path class="sound-waves" d="M15 8a6 6 0 010 8m3-11a10 10 0 010 14"/>
          <path class="sound-cross" d="m16 10 5 5m0-5-5 5"/>
        </svg>
      </button>
      <button class="nav-prototype-menu" type="button" aria-label="展开导航" aria-expanded="false" aria-controls="nav-prototype-links"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8h14M5 16h14"/></svg></button>
    </header>
    <div class="home-art">
      <button class="home-latest" type="button" data-section="space" aria-controls="daily-scene">
        <small>最近动态</small>
        <span>查看日常 <i aria-hidden="true">↗</i></span>
      </button>
      <span class="sky-inscription" lang="en">The sky is listening</span>
    </div>
    <div class="home-greeting">
      <h1>你好，我是栀落余殁。</h1>
      <p>最近在忙什么，都写在「动态」里。</p>
      <p>更多信息，可以看看「关于」。</p>
      <p>有趣的照片，收在「相册」里。</p>
      <p>有什么想聊的，给我留个言吧。</p>
    </div>
    <section id="daily-scene" aria-label="日常动态" inert hidden>
      <img class="daily-photo" alt="" decoding="async">
    </section>
    <dialog class="nav-prototype-panel" aria-labelledby="nav-prototype-title" data-lyric-avoid>
      <button class="nav-prototype-close" type="button" aria-label="关闭内容面板">×</button>
      <h2 id="nav-prototype-title">留言簿</h2>
      <div id="guestbook-messages" tabindex="0" aria-label="访客留言"></div>
      <form class="guestbook-form">
        <input name="name" maxlength="32" autocomplete="nickname" aria-label="昵称（可选）" placeholder="昵称（可选）">
        <textarea name="message" required minlength="2" maxlength="280" rows="2" aria-label="留言内容" placeholder="写下你想说的话…"></textarea>
        <footer><span role="status"></span><button type="submit">发送留言</button></footer>
      </form>
    </dialog>`;
  document.body.append(root);
  const greeting = root.querySelector('.home-greeting');
  const sentences = Array.from(greeting.children, line => line.textContent);
  const heading = greeting.firstElementChild;
  greeting.replaceChildren(heading);
  const still = matchMedia('(prefers-reduced-motion: reduce)');
  let greetingTimer;
  function showSentence(index) {
    const sentence = sentences[index];
    heading.setAttribute('aria-label', sentence);
    const letters = DangoCharacterMotion.units(sentence);
    const stagger = DangoCharacterMotion.revealMs(letters.length, 6000) / letters.length;
    const retreat = letters.length * stagger + 630 + 6000;
    heading.replaceChildren(...letters.map((letter, i) => {
      const glyph = document.createElement('span');
      glyph.textContent = letter;
      glyph.setAttribute('aria-hidden','true');
      glyph.style.setProperty('--arrive', i * stagger + 'ms');
      glyph.style.setProperty('--leave', (retreat + i * stagger) + 'ms');
      return glyph;
    }));
    const next = (index + 1) % sentences.length;
    greetingTimer = setTimeout(() => showSentence(next),
      retreat + letters.length * stagger + 460 + (next === 0 ? 4000 : 350));
  }
  function syncGreeting() {
    clearTimeout(greetingTimer);
    if (document.hidden || !greeting.getClientRects().length || still.matches) {
      heading.textContent = sentences[0];
      heading.setAttribute('aria-label', sentences[0]);
      return;
    }
    showSentence(0);
  }
  window.cloudContent.then(data => {
    if (!data?.nickname) return;
    root.querySelector('.nav-prototype-avatar').src = data.avatar;
    root.querySelector('.nav-prototype-nickname').textContent = data.nickname;
    root.querySelector('.sky-inscription').textContent = data.sky;
    for (const image of document.querySelectorAll('.daily-entry-avatar')) image.src = data.avatar;
    const lines = data.greetings.split('\n').map(line => line.trim()).filter(Boolean);
    if (lines.length && lines.join('\n') !== sentences.join('\n')) {
      sentences.splice(0, sentences.length, ...lines);
      syncGreeting();
    }
  });
  new IntersectionObserver(syncGreeting).observe(greeting);
  document.addEventListener('visibilitychange', syncGreeting);
  still.addEventListener('change', syncGreeting);
  window.addEventListener('pointermove', event => {
    if (event.pointerType !== 'mouse' || still.matches || !greeting.getClientRects().length) return;
    const x = (event.clientX / innerWidth - .5) * 8;
    const y = (event.clientY / innerHeight - .5) * 5;
    heading.style.transform = 'translate(' + x + 'px,' + y + 'px)';
  });
  const presence = root.querySelector('.nav-presence');
  const viewport = presence.querySelector('.presence-window');
  const line = presence.querySelector('.presence-line');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let scrollAnimation;
  function fitPresence() {
    scrollAnimation?.cancel();
    const distance = line.offsetWidth - viewport.clientWidth;
    if (distance <= 1 || reduced.matches) return;
    const travel = distance / 30;
    const duration = travel + 2.4;
    scrollAnimation = line.animate([
      {transform:'translateX(0)', offset:0},
      {transform:'translateX(0)', offset:1.2/duration},
      {transform:`translateX(-${distance}px)`, offset:(travel+1.2)/duration},
      {transform:`translateX(-${distance}px)`, offset:1}
    ], {duration:duration*1000, iterations:Infinity, direction:'alternate'});
  }
  const presenceSize = new ResizeObserver(fitPresence);
  presenceSize.observe(viewport);
  presenceSize.observe(line);
  reduced.addEventListener('change', fitPresence);
  let lastPresenceAt = 0;
  const presenceFreshness = 15 * 60 * 1000;
  async function refreshPresence() {
    let nextPoll = 5000;
    for (const url of ['/api/status', '/status.json']) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), url === '/api/status' ? 15000 : 4000);
      try {
        const response = await fetch(url, {priority:'high', signal:controller.signal});
        if (!response.ok) continue;
        const data = await response.json();
        if (!data.text && !data.primary) continue;
        const updatedAt = Date.parse(data.updatedAt);
        if (!Number.isFinite(updatedAt)) continue;
        const stale = Date.now() - updatedAt > presenceFreshness;
        // A snapshot belongs to the build and may be months behind the live feed.
        if (url === '/status.json' && (stale || updatedAt < lastPresenceAt)) continue;
        const offline = stale || data.mode === 'offline';
        const parts = [data.primary || data.text, data.secondary, ...(Array.isArray(data.lines) ? data.lines : [])];
        const label = offline ? '💤 电脑已关机' : [...new Set(parts.filter(Boolean))].join(' · ');
        presence.dataset.mode = offline ? 'offline' : data.mode || 'online';
        if (line.textContent !== label) line.textContent = label;
        presence.title = label;
        lastPresenceAt = updatedAt;
        if (url === '/api/status') nextPoll = 60000;
        break;
      } catch { /* A failed request can recover on the next poll. */ }
      finally { clearTimeout(timeout); }
    }
    if (nextPoll === 5000 && Date.now() - lastPresenceAt > presenceFreshness) {
      presence.dataset.mode = 'unknown';
      line.textContent = '正在重试状态';
      presence.title = line.textContent;
    }
    setTimeout(refreshPresence, nextPoll);
  }
  refreshPresence();
  const audio = document.getElementById('home-music');
  const sound = root.querySelector('.home-sound');
  audio.volume = 0.15;
  function syncSound() {
    const audible = !audio.paused && !audio.muted && !audio.error;
    sound.dataset.audible = String(audible);
    const label = audible ? '静音背景音乐' : '开启背景音乐';
    sound.setAttribute('aria-label', label);
    sound.title = label;
  }
  async function playMusic() {
    try { await audio.play(); } catch { /* A user gesture may be required. */ }
    syncSound();
  }
  for (const event of ['playing','pause','volumechange','error']) audio.addEventListener(event,syncSound);
  sound.addEventListener('click', () => {
    if (audio.paused) { audio.muted = false; playMusic(); }
    else audio.muted = !audio.muted;
    syncSound();
  });
  syncSound();
  playMusic();

  let room = false, imported = false, resumeHome = false, songsPromise;
  let panFrame = 0;
  const flightClass = 'room-cloud-flight';
  let pointer;
  window.addEventListener('mousemove', event => { pointer = event; });
  const viewLock = 'music-view-locked';
  document.addEventListener('click', event => {
    if (!room || document.documentElement.classList.contains(flightClass) || event.button !== 0 || !event.detail ||
        event.target.closest('#navigation-prototype,#bottom-bar,#bottom-handle,#preview-settings,#intro-splash,button,a,input,select,dialog')) return;
    const scene = document.getElementById('wallpaper').contentWindow;
    if (!scene.camera) return;
    if (document.documentElement.classList.toggle(viewLock)) {
      scene.mouseX = scene.camera.position.x;
      scene.mouseY = -scene.camera.position.y;
    } else {
      scene.onDocumentMouseMove(event);
    }
  });
  function pan(enter) {
    cancelAnimationFrame(panFrame);
    const scene = document.querySelector('#wallpaper').contentWindow;
    const camera = scene.camera;
    if (!camera) return;
    const flightYaw = enter ? -.17 : .17;
    if (reduced.matches) {
      document.documentElement.classList.remove(flightClass);
      camera.rotation.y = 0;
      camera.rotation.x = 0;
      if (pointer) scene.onDocumentMouseMove(pointer);
      return;
    }
    document.documentElement.classList.add(flightClass);
    const fromYaw = camera.rotation.y, fromPitch = camera.rotation.x;
    const fromY = camera.position.y, cloudY = Math.min(fromY, -78);
    const fallbackY = -scene.mouseY;
    scene.mouseX = camera.position.x;
    const start = performance.now();
    let advanced = 0;
    function phase(t, begin, end) {
      const u = Math.max(0, Math.min(1, (t-begin)/(end-begin)));
      return u*u*(3-2*u);
    }
    function tick(now) {
      const t = now-start;
      const dive = phase(t, 0, 1050);
      const flight = phase(t, 1050, 2950);
      const release = phase(t, 2950, 4100);
      const targetY = pointer ? -(pointer.clientY-scene.windowHalfY)*scene._speedY : fallbackY;
      const descentY = fromY + (cloudY-fromY)*dive;
      camera.position.y = descentY + (targetY-descentY)*release;
      scene.mouseY = -camera.position.y;
      camera.rotation.x = (fromPitch*(1-dive)-.105*dive)*(1-release);
      camera.rotation.y = (fromYaw + (flightYaw-fromYaw)*flight)*(1-release);
      const distance = 1600*flight;
      if (Number.isFinite(scene.start_time)) scene.start_time -= (distance-advanced)/.03;
      advanced = distance;
      if (release < 1) panFrame=requestAnimationFrame(tick);
      else {
        document.documentElement.classList.remove(flightClass);
        if (pointer) scene.onDocumentMouseMove(pointer);
      }
    }
    panFrame=requestAnimationFrame(tick);
  }
  async function readTrackLyrics(url) {
    const rows = parseLRCText(await fetch(url).then(response => response.text()));
    const original = [], translated = [];
    for (const row of rows) {
      const ms = Math.round(row.time * 1000);
      const stamp = '[' + String(Math.floor(ms/60000)).padStart(2,'0') + ':' +
        ((ms%60000)/1000).toFixed(3).padStart(6,'0') + ']';
      original.push(stamp + row.text);
      if (row.trans && row.trans !== row.text) translated.push(stamp + row.trans);
    }
    return {lyric:original.join('\n'), tlyric:translated.join('\n')};
  }
  let roomVersion = 0;
  async function setRoom(enter) {
    if (room === enter) return;
    closeRoomSearch();
    const version = ++roomVersion;
    room = enter;
    document.documentElement.classList.remove(viewLock);
    document.documentElement.classList.toggle('music-room', enter);
    pan(enter);
    if (!enter) {
      window.audio?.pause();
      if (resumeHome) playMusic();
      return;
    }
    resumeHome = !audio.paused;
    audio.pause();
    try {
      await window.nativePlayerReady;
      if (!room || version !== roomVersion) return;
      if (!songsPromise) songsPromise = fetch('music/playlist.json').then(r=>r.json()).then(list=>Promise.all(list.map(async(t,i)=>({
        type:'local',source:'local',provider:'local',name:t.title,artist:t.artist,album:t.album,
        localKey:'shiloku-preview-'+i,localUrl:new URL(t.src,location.href).href,cover:new URL(t.cover,location.href).href,
        duration:t.duration/1000,...await readTrackLyrics(t.lrc)
      }))));
      const songs=await songsPromise;
      if (!room || version !== roomVersion) return;
      if (!imported) imported=window.prepareRoomQueue(songs);
      window.revealBottomControls(3200);
    } catch(error) { songsPromise=null; console.error(error); }
  }
  const hud = document.getElementById('bottom-bar');
  const handle = document.getElementById('bottom-handle');
  let leaveTimer;
  function leaveHud(event) {
    if (hud.contains(event.relatedTarget) || handle.contains(event.relatedTarget)) return;
    clearTimeout(leaveTimer);
    leaveTimer = setTimeout(() => {
      if (!room || hud.matches(':hover') || handle.matches(':hover')) return;
      if (window.miniQueueOpen) window.closeMiniQueue();
      window.scheduleControlsHide?.(70);
    }, 180);
  }
  for (const surface of [hud, handle]) {
    surface.addEventListener('mouseenter', () => clearTimeout(leaveTimer));
    surface.addEventListener('mouseleave', leaveHud);
  }
  const searchArea = document.getElementById('search-area');
  const searchButton = document.getElementById('room-search-toggle');
  const searchInput = document.getElementById('search-input');
  root.append(searchArea);
  document.body.append(document.getElementById("collect-modal"));
  searchInput.placeholder = '搜索网易云歌曲或歌手';
  function closeRoomSearch() {
    root.classList.remove('search-open');
    searchButton.setAttribute('aria-expanded','false');
    searchInput.blur();
  }
  searchButton.addEventListener('click', async () => {
    if (root.classList.contains('search-open')) { closeRoomSearch(); return; }
    await window.nativePlayerReady;
    if (!room) return;
    root.classList.add('search-open');
    searchButton.setAttribute('aria-expanded','true');
    searchInput.focus();
  });
  document.addEventListener('pointerdown', e => {
    if (!searchArea.contains(e.target) && !searchButton.contains(e.target)) closeRoomSearch();
  });
  searchArea.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeRoomSearch(); searchButton.focus(); }
  });
  const menu = root.querySelector('.nav-prototype-menu');
  const dialog = root.querySelector('dialog');
  const items = [...root.querySelectorAll('.nav-prototype-link')];
  const guestbook = import('./guestbook-card.js').then(module => module.mountGuestbook(dialog));
  function setMenu(open) {
    root.dataset.menuOpen = String(open);
    menu.setAttribute('aria-expanded', String(open));
    menu.setAttribute('aria-label', open ? '收起导航' : '展开导航');
  }
  const daily = root.querySelector('#daily-scene');
  const journal = import('./apartment-journal.js?v=cloud-content1').then(module => module.mountJournal(daily, root.querySelector('.home-latest')));
  const photo = daily.querySelector('.daily-photo');
  // A short shutter trail uses the same decoded photograph and camera pivot.
  const exposures = [20, 42, 66].map(delay => {
    const layer = photo.cloneNode();
    layer.classList.add('daily-exposure');
    layer.style.transitionDelay = delay + 'ms';
    layer.setAttribute('aria-hidden', 'true');
    return layer;
  });
  photo.after(...exposures);
  function animateFocus(layer, duration) {
    return layer.animate([
      { filter: 'blur(0px)', offset: 0 },
      { filter: 'blur(1px)', offset: .17 },
      { filter: 'blur(5px)', offset: .36 },
      { filter: 'blur(4px)', offset: .49 },
      { filter: 'blur(0px)', offset: .78 },
      { filter: 'blur(0px)', offset: 1 }
    ], { duration });
  }
  let focusPull;
  photo.addEventListener('transitionrun', event => {
    if (event.propertyName !== 'transform' || still.matches) return;
    const zoom = photo.getAnimations().find(animation => animation.transitionProperty === 'transform');
    if (!zoom) return;
    daily.classList.add('shutter-open');
    focusPull?.cancel();
    focusPull = animateFocus(photo, zoom.effect.getComputedTiming().activeDuration);
  });
  still.addEventListener('change', () => {
    if (still.matches) focusPull?.cancel();
  });
  function settleShutter() {
    requestAnimationFrame(() => {
      if (!exposures.some(layer => layer.getAnimations().length)) daily.classList.remove('shutter-open');
    });
  }
  exposures.at(-1).addEventListener('transitionend', settleShutter);
  exposures.at(-1).addEventListener('transitioncancel', settleShutter);
  function revealDaily() {
    if (root.dataset.section === 'space') daily.classList.add('visible');
  }
  photo.addEventListener('load', revealDaily);
  photo.addEventListener('error', revealDaily);
  function select(section) {
    const active = section === 'space';
    daily.inert = !active;
    if (active) {
      daily.hidden = false;
      journal.then(view => view.open());
      if (!photo.hasAttribute('src')) {
        photo.src = 'assets/apartment-19699979.jpg';
        exposures.forEach(layer => { layer.src = photo.src; });
      }
      if (photo.complete) requestAnimationFrame(revealDaily);
    } else {
      daily.classList.remove('visible');
    }
    root.dataset.section = section;
    items.forEach(item => {
      if (item.dataset.section === section) item.setAttribute('aria-current', 'page');
      else item.removeAttribute('aria-current');
    });
  }
  let sceneSection = 'home';
  window.addEventListener('journey-destination', event => {
    sceneSection = ['home','album','about'][event.detail];
    if (root.dataset.section !== 'space') select(sceneSection);
  });
  let navigationVersion = 0;
  let departingRoom;
  async function enterStationFromRoom(version) {
    const station = document.querySelector('#station-journey .station-image');
    if (!station.src) station.src = 'assets/sakura-station/station.webp';
    try {
      await station.decode();
    } catch {
      if (version === navigationVersion) {
        select('about');
        window.dispatchEvent(new CustomEvent('journey-navigate', { detail: 'about' }));
      }
      return;
    }
    if (version !== navigationVersion) return;
    // Place the live station behind the outgoing room before uncovering it.
    window.dispatchEvent(new Event('journey-direct-station'));
    if (!still.matches && photo.naturalWidth) {
      const duration = 1650;
      const frame = document.createElement('div');
      frame.className = 'departing-room shutter-open';
      frame.setAttribute('aria-hidden', 'true');
      daily.after(frame);
      departingRoom = frame;
      // Keep the crop on the wrapper; move the photograph and its shutter samples inside it.
      for (const source of [photo, ...exposures]) {
        const layer = source.cloneNode();
        frame.append(layer);
        layer.animate([
          {transform: getComputedStyle(source).transform},
          {transform: 'scale(2.15)'}
        ], {
          duration, delay: parseFloat(source.style.transitionDelay) || 0,
          easing: 'cubic-bezier(.48,.04,.19,1)', fill: 'both'
        });
        if (source === photo) animateFocus(layer, duration);
      }
      const animation = frame.animate([
        {clipPath:'inset(0% 0% 0% 0%)'},
        {clipPath:'inset(31% 37% 69% 63%)'}
      ], {duration, easing:'cubic-bezier(.48,.04,.19,1)', fill:'both'});
      animation.onfinish = () => {
        frame.remove();
        if (departingRoom === frame) departingRoom = null;
      };
    }
    daily.hidden = true;
    select('about');
  }
  menu.addEventListener('click', () => setMenu(root.dataset.menuOpen !== 'true'));
  root.querySelectorAll('[data-section]').forEach(button => button.addEventListener('click', () => {
    setMenu(false);
    const section = button.dataset.section;
    if (section === 'guestbook') {
      if (dialog.open) dialog.close();
      else {
        dialog.show();
        guestbook.then(card => card.open());
      }
      return;
    }
    if (dialog.open) dialog.close();
    const version = ++navigationVersion;
    if (departingRoom) {
      if (section === 'about') return;
      departingRoom.remove();
      departingRoom = null;
    }
    if (section === 'about' && root.dataset.section === 'space') {
      enterStationFromRoom(version);
      return;
    }
    if (section === 'music') {
      window.dispatchEvent(new CustomEvent('journey-navigate', { detail: 'music' }));
      setRoom(true);
      select('music');
      return;
    }
    setRoom(false);
    if (section !== 'home' && document.documentElement.classList.contains(flightClass)) {
      cancelAnimationFrame(panFrame);
      document.documentElement.classList.remove(flightClass);
      const scene = document.querySelector('#wallpaper').contentWindow;
      if (scene.camera) scene.camera.rotation.set(0,0,0);
      if (pointer && scene.camera) scene.onDocumentMouseMove(pointer);
    }
    if (['home','album','about'].includes(section)) {
      if (dialog.open) dialog.close();
      select(section);
      window.dispatchEvent(new CustomEvent('journey-navigate', { detail: section }));
      return;
    }
    window.dispatchEvent(new CustomEvent('journey-navigate', {detail: section}));
    if (section === 'space') {
      select(section);
      return;
    }
  }));
  root.querySelector('.nav-prototype-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => {
    if (dialog.open || document.activeElement !== document.body) return;
    if (matchMedia('(max-width: 620px)').matches) menu.focus();
    else items.find(item => item.dataset.section === 'guestbook').focus();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && dialog.open) dialog.close();
  });
  document.addEventListener('pointerdown', event => {
    if (dialog.open && !dialog.contains(event.target) && !event.target.closest('#navigation-prototype button')) dialog.close();
  });
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const box = dialog.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close();
  });
  root.addEventListener('keydown', event => {
    event.stopPropagation();
    if (event.key === 'Escape' && dialog.open) { dialog.close(); return; }
    if (event.key === 'Escape' && root.dataset.menuOpen === 'true') {
      setMenu(false);
      menu.focus();
    }
  });
  document.addEventListener('click', event => {
    if (!root.contains(event.target)) setMenu(false);
  });
  matchMedia('(max-width: 620px)').addEventListener('change', () => setMenu(false));
  select('home');

  // Reuse the native HUD filter tree, native displacement-map generator and
  // native channel-offset function. Only geometry and unique DOM IDs differ.
  const glassTimer = setInterval(() => {
    if (typeof generateControlGlassDisplacementMap !== 'function' ||
        typeof updateGlassDisplacementMapForElement !== 'function') return;
    clearInterval(glassTimer);
    const nativeFilter = document.getElementById('mineradio-control-glass-filter');
    const surface = root.querySelector('.nav-prototype-header');
    root.dataset.glassHost = 'native-container';
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.classList.add('nav-prototype-filter-defs');
    svg.setAttribute('aria-hidden', 'true');
    const defs = document.createElementNS(ns, 'defs');
    const filter = nativeFilter.cloneNode(true);
    filter.id = 'navigation-header-glass-filter';
    filter.querySelectorAll('#control-glass-output-mask,#control-glass-output-bounds').forEach(node => node.remove());
    const map = filter.querySelector('#control-glass-map');
    map.id = 'navigation-header-glass-map';
    defs.append(filter); svg.append(defs); root.append(svg);
    const nativeSheet = [...document.styleSheets].find(sheet => sheet.href && sheet.href.includes('/comparison/mineradio-original/css/index.css'));
    const nativeStyle = [...nativeSheet.cssRules].find(rule => rule.selectorText === '#bottom-bar.visible').style;
    for (const property of ['background', 'box-shadow', 'backdrop-filter', '-webkit-backdrop-filter']) {
      surface.style.setProperty(property, nativeStyle.getPropertyValue(property));
    }
    if (supportsControlGlassSvgFilter()) {
      surface.style.backdropFilter = 'url(#navigation-header-glass-filter) saturate(1)';
      surface.style.webkitBackdropFilter = 'url(#navigation-header-glass-filter) saturate(1)';
      root.dataset.glass = 'native-rgb';
    } else root.dataset.glass = 'native-fallback';
    applyControlGlassChromaticOffsetToFilter(filter, CONTROL_GLASS_BASE_SHIFT_X, CONTROL_GLASS_CHROMA_MAX_SPREAD, .08);
    boundNativeControlGlassOutput(filter, surface, 'navigation-header-glass');
    const sync = () => updateGlassDisplacementMapForElement(surface, map, 'navigationHeaderKey');
    sync(); new ResizeObserver(sync).observe(surface);
  }, 100);
})();
