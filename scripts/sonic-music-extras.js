const SIDE_NAV_HINT_KEY = 'sonic-topography-side-nav-hint-seen-v1';

function updateFullscreenBtnLabel() {
  const btn = document.getElementById('sonic-fullscreen-btn');
  if (!btn) return;
  btn.textContent = document.fullscreenElement ? 'Exit FS' : 'Fullscreen';
}

export function initSonicMusicExtras({
  musicRoom,
  brandBtn,
  sidebarRail,
}) {
  const hint = document.createElement('div');
  hint.className = 'sonic-side-nav-hint hidden';
  hint.innerHTML = `
    <div>Click SHILOKU. to open the side rail</div>
    <div>Or move the mouse to the left edge</div>
  `;
  musicRoom?.querySelector('.aether-ui')?.appendChild(hint);

  if (!localStorage.getItem(SIDE_NAV_HINT_KEY)) {
    hint.classList.remove('hidden');
  }

  function markHintSeen() {
    localStorage.setItem(SIDE_NAV_HINT_KEY, '1');
    hint.classList.add('hidden');
  }

  function setMobileSidebar(open) {
    sidebarRail?.classList.toggle('is-open', open);
    if (open) markHintSeen();
  }

  brandBtn?.addEventListener('click', () => {
    setMobileSidebar(!sidebarRail?.classList.contains('is-open'));
  });

  sidebarRail?.addEventListener('mouseenter', () => {
    if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      setMobileSidebar(true);
    }
  });

  document.getElementById('sonic-fullscreen-btn')?.addEventListener('click', async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await (musicRoom?.requestFullscreen?.() || document.documentElement.requestFullscreen());
    } catch (error) {
      console.warn('Fullscreen toggle failed:', error);
    }
    setMobileSidebar(false);
  });

  document.addEventListener('fullscreenchange', () => {
    musicRoom?.classList.toggle('sonic-fullscreen', Boolean(document.fullscreenElement));
    updateFullscreenBtnLabel();
  });

  updateFullscreenBtnLabel();

  if (typeof window.wallpaperRegisterAudioListener === 'function') {
    window.wallpaperRegisterAudioListener((audioArray) => {
      const analyzer = window.__shilokuViz?.analyzer;
      if (!analyzer?.dataArray?.length) return;
      const half = Math.floor(audioArray.length / 2);
      for (let i = 0; i < analyzer.dataArray.length; i++) {
        const sourceIndex = Math.min(half - 1, Math.floor((i / analyzer.dataArray.length) * half));
        const left = Math.min(1, Math.max(0, audioArray[sourceIndex] || 0));
        const right = Math.min(1, Math.max(0, audioArray[sourceIndex + half] || 0));
        analyzer.dataArray[i] = Math.round(((left + right) / 2) * 255);
      }
      analyzer.wallpaperAudioActiveUntil = performance.now() + 300;
    });
  }

  return {};
}
