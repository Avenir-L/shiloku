/*
MIT + Commons Clause License Condition v1.0

Copyright (c) 2026 David Haz

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, and distribute the Software **as part of an application, website, or product**, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

## Commons Clause Restriction

You may use this Software, including for any commercial purpose, **so long as you do not sell, sublicense, or redistribute the components themselves-whether alone, in a bundle, or as a ported version.**

## No Warranty

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

*/
/* Fold entrance adapted from React Bits Fold Text by David Haz (2026).
 * Original: https://github.com/DavidHDev/react-bits/blob/main/src/content/TextAnimations/FoldText/FoldText.jsx
 * Full MIT + Commons Clause notice is included above.
 * Shiloku adaptations: native Web Animations, Chinese spacing, slow easing,
 * reduced crease shading, and no continuous text animation.
 */
(() => {
  const root = document.getElementById('shiloku-home');
  const hero = root.querySelector('.sh-hero');
  const visual = root.querySelector('.sh-letters');


  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const settings = { duration: 2400, depth: true };
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine) and (min-width: 720px)');
  let animations = [], generation = 0;

  const background = root.querySelector('.sh-fallback');
  const intro = root.querySelector('.sh-intro');
  const avatar = root.querySelector('.sh-avatar');
  const depthPosition = { x: 0, y: 0 };
  const depthTarget = { x: 0, y: 0 };
  let depthFrame = 0, lastDepthTime = 0;
  const depthEnabled = () => settings.depth && finePointer.matches && !reduced.matches && !document.hidden && !document.body.classList.contains('music-room-open');
  function paintDepth() {
    const { x, y } = depthPosition;
    // Overscan hides image edges even at the most extreme pointer position.
    // The image stays intact; different layer speeds create the depth cue.
    background.style.transform = `translate3d(${-10 * x}px,${-7 * y}px,0) scale(1.045)`;
    intro.style.transform = `translate3d(${4 * x}px,${3 * y}px,0)`;
    avatar.style.transform = `translate3d(${2 * x}px,${1.5 * y}px,0)`;
  }
  function stopDepth() {
    cancelAnimationFrame(depthFrame);
    depthFrame = 0; lastDepthTime = 0;
    depthPosition.x = depthPosition.y = depthTarget.x = depthTarget.y = 0;
    background.style.transform = intro.style.transform = avatar.style.transform = '';
    hero.removeAttribute('data-depth-active');
  }
  function advanceDepth(time) {
    depthFrame = 0;
    if (!depthEnabled() || !root.isConnected) { stopDepth(); return; }
    const elapsed = lastDepthTime ? Math.min(time - lastDepthTime, 50) : 16;
    lastDepthTime = time;
    const smoothing = 1 - Math.exp(-elapsed / 150);
    depthPosition.x += (depthTarget.x - depthPosition.x) * smoothing;
    depthPosition.y += (depthTarget.y - depthPosition.y) * smoothing;
    const moving = Math.abs(depthPosition.x - depthTarget.x) + Math.abs(depthPosition.y - depthTarget.y) > 0.001;
    if (!moving) { depthPosition.x = depthTarget.x; depthPosition.y = depthTarget.y; }
    paintDepth();
    if (moving) depthFrame = requestAnimationFrame(advanceDepth);
    else lastDepthTime = 0;
  }
  function queueDepth() {
    if (!depthFrame) depthFrame = requestAnimationFrame(advanceDepth);
  }
  function centerDepth() {
    depthTarget.x = depthTarget.y = 0;
    if (depthEnabled()) queueDepth(); else stopDepth();
  }
  function syncDepth() {
    if (!depthEnabled()) { stopDepth(); return; }
    hero.setAttribute('data-depth-active', 'true');
    centerDepth();
  }
  hero.addEventListener('pointermove', event => {
    if (!depthEnabled() || event.pointerType === 'touch') return;
    const rect = hero.getBoundingClientRect();
    depthTarget.x = Math.max(-1, Math.min(1, (event.clientX - rect.left) / rect.width * 2 - 1));
    depthTarget.y = Math.max(-1, Math.min(1, (event.clientY - rect.top) / rect.height * 2 - 1));
    queueDepth();
  }, { passive: true });
  hero.addEventListener('pointerleave', centerDepth);
  hero.addEventListener('pointercancel', centerDepth);
  window.addEventListener('blur', centerDepth);
  window.addEventListener('resize', centerDepth, { passive: true });
  finePointer.addEventListener('change', syncDepth);
  const characters = Array.from(visual.textContent);
  visual.textContent = '';
  for (const letter of characters) {
    const segment = document.createElement('span');
    segment.className = 'sh-glyph';
    const piece = document.createElement('span');
    piece.className = 'sh-fold-piece';
    piece.textContent = letter;
    const shadow = document.createElement('span');
    shadow.className = 'sh-fold-shadow';
    shadow.textContent = letter;
    piece.append(shadow);
    segment.append(piece);
    visual.append(segment);
  }
  function describe() {}
  function reset() {
    generation++;
    animations.forEach(animation => animation.cancel());
    animations = [];
    describe();
  }
  function sync() {
    syncDepth();
    describe();
  }

  async function play() {
    reset();
    const token = generation;
    if (reduced.matches) return;
    try {
      await Promise.race([
        document.fonts.load('500 76px ShilokuModern', '栀落余殁'),
        new Promise(resolve => setTimeout(resolve, 700))
      ]);
    } catch (_) { /* A system font remains readable. */ }
    if (token !== generation || document.hidden || reduced.matches) return;
    const factor = settings.duration / 2400;
    const easing = 'cubic-bezier(.33,.05,.18,1)';
    const animate = (element, frames, duration, delay = 0) => {
      const animation = element.animate(frames, {
        duration: duration * factor, delay: delay * factor, easing, fill: 'both'
      });
      animations.push(animation);
    };


    root.querySelectorAll('.sh-fold-piece').forEach((piece, index) => {
      // Same hinge principle as Fold Text. Longer settling, no bounce.
      animate(piece, [
        { transform: 'rotateX(82deg) translateZ(-12px)', opacity: 0 },
        { transform: 'rotateX(24deg) translateZ(-3px)', opacity: 0.86, offset: 0.45 },
        { transform: 'rotateX(0deg) translateZ(0)', opacity: 1 }
      ], 1980, index * 140);
      animate(piece.querySelector('.sh-fold-shadow'), [{ opacity: 0.38 }, { opacity: 0 }], 1850, index * 140);
    });
    animate(root.querySelector('.sh-roman>span'), [
      { opacity: 0, transform: 'translateY(12px)', letterSpacing: '.25em' },
      { opacity: 1, transform: 'translateY(0)', letterSpacing: '.16em' }
    ], 1300, 550);
    root.querySelectorAll('.sh-bio p span').forEach((line, index) => animate(line, [
      { opacity: 0, transform: 'translateY(105%)' },
      { opacity: 1, transform: 'translateY(0)' }
    ], 950, 1000 + index * 150));
    // Contact actions remain available throughout, and only move a little.
    root.querySelectorAll('.sh-social a').forEach((link, index) => animate(link, [
      { opacity: 0.35, transform: 'translateY(5px)' }, { opacity: 1, transform: 'translateY(0)' }
    ], 700, 1300 + index * 95));
    Promise.all(animations.map(animation => animation.finished))
      .then(() => { if (generation === token) reset(); }).catch(() => {});
  }

  reduced.addEventListener('change', () => { reset(); sync(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) reset(); syncDepth(); });
  root.querySelectorAll('a[href^="#sh-"]').forEach(link => link.addEventListener('click', event => {
    const target = root.querySelector(link.getAttribute('href'));
    if (!target) return;
    event.preventDefault();
    target.scrollIntoView({ behavior: reduced.matches ? 'instant' : 'smooth', block: 'start' });
    target.querySelector('a')?.focus({ preventScroll: true });
  }));
  sync();
  requestAnimationFrame(play);
})();

(() => {
  const home = document.getElementById('shiloku-home');
  let lastMusicTrigger = null;
  let homeScroll = 0;
  home.querySelectorAll('[data-open-music]').forEach(link => link.addEventListener('click', event => {
    event.preventDefault();
    lastMusicTrigger = link;
    homeScroll = window.scrollY;
    window.__shilokuOpenMusicRoom?.();
    requestAnimationFrame(() => document.getElementById('page-nav-btn')?.focus({preventScroll:true}));
  }));
  home.querySelectorAll('[data-home-action]').forEach(button => button.addEventListener('click', () => {
    document.getElementById(button.dataset.homeAction)?.click();
  }));
  let wasInMusic = document.body.classList.contains('music-room-open');
  new MutationObserver(() => {
    const inMusic = document.body.classList.contains('music-room-open');
    if (wasInMusic && !inMusic) requestAnimationFrame(() => {
      window.scrollTo({top:homeScroll,behavior:'instant'});
      lastMusicTrigger?.focus({preventScroll:true});
    });
    wasInMusic = inMusic;
  }).observe(document.body,{attributes:true,attributeFilter:['class']});

  const copy = {
    zh: ['很高兴，在这里遇见你。', '这里收录插画与歌单，', '还有一些想与你分享的日常。', '留一点时间，', '给喜欢的声音。', '进入音乐室', '音乐室', '联系我'],
    en: ['Glad you found your way here.', 'Illustrations, playlists,', 'and little things worth sharing.', 'Make a little time', 'for the sounds you love.', 'Enter music room', 'Music room', 'Contact'],
    ja: ['ここで出会えて、うれしいです。', 'イラストやプレイリスト、', '日々の小さなことを集めています。', '好きな音に、', '少しだけ時間を。', '音楽室へ', '音楽室', '連絡先']
  };
  function translateHome() {
    const lang = window.shilokuI18n?.getLang?.() || 'zh';
    const text = copy[lang] || copy.zh;
    home.querySelector('.sh-greeting').textContent = text[0];
    home.querySelectorAll('.sh-bio p span').forEach((el,index) => el.textContent = text[index+1]);
    const heading = home.querySelector('.sh-music-heading h2');
    heading.replaceChildren(document.createTextNode(text[3]),document.createElement('br'),document.createTextNode(text[4]));
    home.querySelector('.sh-room-link').firstChild.textContent = text[5] + ' ';
    home.querySelector('.sh-nav [data-open-music]').firstChild.textContent = text[6] + ' ';
    home.querySelector('.sh-nav a[href="#sh-social"]').textContent = text[7];
  }
  window.addEventListener('shiloku:langchange', translateHome);
  window.addEventListener('DOMContentLoaded', translateHome, {once:true});
})();
