import { REFERENCE } from './intro-data-20261026.js';

export const DEFAULTS = Object.freeze({ title: 'SHILOKU', subtitle: '栀落余殁', duration: 5.76, sweep: 1, glow: 1 });
export const REFERENCE_DURATION = REFERENCE.source.duration;
export const FRAME = 1 / REFERENCE.source.fps;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const finite = (value, fallback, min, max) => Number.isFinite(Number(value)) ? clamp(Number(value), min, max) : fallback;

export function validateSettings(input = {}) {
  return {
    title: typeof input.title === 'string' ? input.title.slice(0, 28) : DEFAULTS.title,
    subtitle: typeof input.subtitle === 'string' ? input.subtitle.slice(0, 36) : DEFAULTS.subtitle,
    duration: finite(input.duration, DEFAULTS.duration, 3, 12),
    sweep: finite(input.sweep, DEFAULTS.sweep, .5, 2),
    glow: finite(input.glow, DEFAULTS.glow, 0, 2),
  };
}

function sweepProgress(t, a, b, speed) {
  const u = clamp((t - a) / (b - a), 0, 1);
  // Retain the speed control's existing time adjustment. At speed 1 this
  // reduces exactly to easeOutCubic: 1 - (1 - u)^3, with no sampled segments.
  const adjusted = 1 - Math.pow(1 - u, speed);
  return 1 - Math.pow(1 - adjusted, 3);
}

export function sampleMotion(seconds, settings) {
  const t = clamp(seconds / settings.duration * REFERENCE_DURATION, 0, REFERENCE_DURATION);
  let x = 1206, height = 180, y = 542, direction = 1;
  let solid = [0, 0], outline = [0, 0], phase = '光线展开';
  // Start with an empty frame. The first line unfolds before the light cone
  // appears; tying the cone to line height made it visible too early.
  if (t < .5) height = 180 * t / .5;
  const beamOpacity = clamp((t - .5) / .05, 0, 1);
  if (t >= 1.0167 && t < 2.3333) {
    x = 1206 + (727 - 1206) * sweepProgress(t, 1.0167, 2.0, settings.sweep);
    solid = [x + 2, 1280]; phase = '实心显现';
  } else if (t >= 2.3333 && t < 3.3333) {
    x = 727 + (1206 - 727) * sweepProgress(t, 2.3333, 3.3333, settings.sweep);
    direction = -1; solid = [x + 2, 1280]; outline = [680, x - 2]; phase = '描边转换';
  } else if (t >= 3.3333 && t < 3.8333) {
    x = 1205; direction = -1; height = 180 * (1 - (t - 3.3333) / .5);
    outline = [680, 1280]; phase = '描边停留';
  } else if (t >= 3.8333 && t < 4.5) {
    x = 727; direction = -1; height = 180 * (t - 3.8333) / (4.5 - 3.8333);
    outline = [680, 1280]; phase = '扫出准备';
  } else if (t >= 4.5 && t < 5.5) {
    x = 727 + (1206 - 727) * sweepProgress(t, 4.5, 5.5, settings.sweep);
    direction = -1; outline = [x + 2, 1280]; phase = '扫出消失';
  } else if (t >= 5.5 && t < 5.75) {
    x = 1206; direction = -1; phase = '光线停留';
  } else if (t >= 5.75 && t < 6.75) {
    const progress = sweepProgress(t, 5.75, 6.75, settings.sweep);
    x = 1206 + (727 - 1206) * progress;
    y += 16 * progress;
    outline = [x + 2, 1280]; phase = '回扫显现';
  } else if (t >= 6.75) {
    x = 727; y = 558; height = 180 * clamp(1 - (t - 6.75) / .58, 0, 1);
    outline = [680, 1280]; phase = '描边定格';
  }
  return { t, x, y, height: Math.max(0, height), beamOpacity, direction, solid, outline, phase };
}

// Deterministic renderer: no internal animation clock, timers or video layers.
// A host page can drive render(seconds, settings) with any transport it needs.
export class IntroMotion {
  constructor(mount) {
    mount.innerHTML = `<svg viewBox="0 0 1920 1080" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="用 SVG 重绘的开屏动画">
      <defs>
        <clipPath id="solid-clip"><rect id="solid-rect" y="0" height="1080"/></clipPath>
        <clipPath id="outline-clip"><rect id="outline-rect" y="0" height="1080"/></clipPath>
        <linearGradient id="beam-falloff"><stop stop-color="white" stop-opacity=".16"/><stop offset=".2" stop-color="white" stop-opacity=".07"/><stop offset="1" stop-color="white" stop-opacity="0"/></linearGradient>
        <filter id="beam-soft" x="-30%" y="-70%" width="180%" height="240%"><feGaussianBlur stdDeviation="8"/></filter>
        <filter id="line-soft" x="-1000%" y="-40%" width="2100%" height="180%"><feGaussianBlur stdDeviation="5"/></filter>
      </defs>
      <g id="beam"><polygon id="beam-cone" fill="url(#beam-falloff)" filter="url(#beam-soft)"/><rect id="line-halo" x="-5" width="10" fill="white" opacity=".6" filter="url(#line-soft)"/><rect id="line-core" x="-2.8" width="5.6" fill="white"/></g>
      <g clip-path="url(#solid-clip)" fill="white" fill-rule="evenodd"><path id="solid-vector" d="${REFERENCE.solid}"/><text id="solid-text" x="761" y="576" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-style="italic" font-size="100" textLength="405" lengthAdjust="spacingAndGlyphs"></text></g>
      <g clip-path="url(#outline-clip)" fill="white" fill-rule="evenodd"><path id="outline-vector" d="${REFERENCE.outline}"/><text id="outline-text" x="761" y="576" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-style="italic" font-size="100" textLength="405" lengthAdjust="spacingAndGlyphs" fill="black" stroke="white" stroke-width="9" stroke-linejoin="round" paint-order="stroke fill"></text><path id="subtitle-vector" d="${REFERENCE.subtitle}" stroke="white" stroke-width=".55" stroke-linejoin="round"/><text id="subtitle-text" x="963" y="615" text-anchor="middle" font-family="KaiTi, STKaiti, serif" font-size="26" font-weight="700"></text></g>
    </svg>`;
    this.svg = mount.querySelector('svg');
    this.nodes = Object.fromEntries([...mount.querySelectorAll('[id]')].map(node => [node.id, node]));
    this.textKey = '';
  }

  render(seconds, settings) {
    const state = sampleMotion(seconds, settings);
    const n = this.nodes;
    const textKey = JSON.stringify([settings.title, settings.subtitle]);
    if (textKey !== this.textKey) {
      const originalTitle = settings.title === DEFAULTS.title;
      const originalSubtitle = settings.subtitle === DEFAULTS.subtitle;
      for (const kind of ['solid', 'outline']) {
        n[`${kind}-vector`].style.display = originalTitle ? '' : 'none';
        n[`${kind}-text`].style.display = originalTitle ? 'none' : '';
        n[`${kind}-text`].textContent = settings.title;
      }
      n['subtitle-vector'].style.display = originalSubtitle ? '' : 'none';
      n['subtitle-text'].style.display = originalSubtitle ? 'none' : '';
      n['subtitle-text'].textContent = settings.subtitle;
      this.textKey = textKey;
    }
    for (const kind of ['solid', 'outline']) {
      const [left, right] = state[kind];
      n[`${kind}-rect`].setAttribute('x', left);
      n[`${kind}-rect`].setAttribute('width', Math.max(0, right - left));
    }
    const h = state.height / 2;
    n.beam.setAttribute('transform', `translate(${state.x} ${state.y}) scale(${state.direction} 1)`);
    n.beam.style.display = state.height > .1 ? '' : 'none';
    n['beam-cone'].setAttribute('points', `0,${-h} 280,${-h-115} 280,${h+115} 0,${h}`);
    n['beam-cone'].setAttribute('opacity', settings.glow * Math.min(1, state.height / 60) * state.beamOpacity);
    for (const name of ['line-core', 'line-halo']) {
      n[name].setAttribute('y', -h);
      n[name].setAttribute('height', state.height);
    }
    n['line-halo'].setAttribute('opacity', .6 * settings.glow * state.beamOpacity);
    return state;
  }
}
