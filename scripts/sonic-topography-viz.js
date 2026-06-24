import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { applyGroundEqValue, readGroundEqSettingsStorage, writeGroundEqSettingsStorage } from './sonic/ground-eq.js';
import {
  applyStoredTriggerConfig,
  readTriggerSettingsStorage,
  snapshotTriggerConfig,
  writeTriggerSettingsStorage,
} from './sonic/trigger-settings.js';
import {
  BUILT_IN_THEME_IDS,
  CUSTOM_THEME_ID,
  cycleThemeId,
  readActiveCustomThemeStorage,
  readActiveThemeStorage,
  readCustomThemeStorage,
  readThemeRotationStorage,
  resolveThemeVisual,
  writeActiveCustomThemeStorage,
  writeActiveThemeStorage,
  writeCustomThemeStorage,
  writeThemeRotationStorage,
} from './sonic/themes.js';
import {
  applyVizBackgroundSettings,
  buildCustomPalette,
  extractPaletteFromCoverUrl,
  readVizBackgroundStorage,
  VIZ_BG_MODE_FOLLOW_SONG,
  writeVizBackgroundStorage,
} from './sonic/viz-background.js';

const VIZ_MAX_DELTA = 1 / 24;

function getVizDeviceProfile() {
  const mobile = window.matchMedia('(max-width: 900px), (hover: none) and (pointer: coarse)').matches;
  const small = window.matchMedia('(max-width: 600px)').matches;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const lowPower = mobile || reducedMotion;
  return {
    mobile,
    small,
    reducedMotion,
    grid: small ? 96 : (mobile ? 112 : 160),
    targetFps: lowPower ? 30 : 60,
    pixelRatioCap: small ? 1.0 : (mobile ? 1.1 : 1.25),
    antialias: !mobile,
    maxMeteors: mobile ? 10 : 20,
    maxParticles: mobile ? 60 : 200,
    shuttleSway: !lowPower,
  };
}


const VERTEX_SHADER = `
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <normal_pars_vertex>

uniform float uTime;
uniform float uSubBass;
uniform float uBass;
uniform float uLowMid;
uniform float uMid;
uniform float uHighMid;
uniform float uSmoothness;
uniform float uDensity;
uniform float uEnergy;
uniform float uIdleMix;
uniform vec2 uRipplePos[10];
uniform float uRippleTime[10];
uniform float uRippleStrength[10];
uniform float uRippleActive[10];
uniform float uRippleType[10];

varying float vElevation;
varying float vDistance;
varying vec2 vRippleAnim;
varying float vRelativeY;
varying vec2 vInstancePos;

vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }
float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187,  0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i  = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz; x12.xy -= i1;
  i = mod289(i);
  vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 )) + i.x + vec3(0.0, i1.x, 1.0 ));
  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
  m = m*m; m = m*m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0; vec3 h = abs(x) - 0.5; vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox; m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
  vec3 g; g.x = a0.x * x0.x + h.x * x0.y; g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}
float random(vec2 st) {
  return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
}

void main() {
  vUv = uv;
  vNormal = normal;
  vec4 instancePos = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  vec2 pos2D = instancePos.xz;
  vInstancePos = pos2D;
  float centerDist = length(pos2D);
  vDistance = centerDist;

  vec2 movingPos = pos2D * 0.05 + vec2(uTime * 0.1, uTime * 0.05);
  float baseNoise = (snoise(movingPos) + 1.0) * 0.5;
  float wave = sin(pos2D.x * 0.15 + pos2D.y * 0.1 - uTime * 0.6) * 0.5 + 0.5;
  float globalFalloff = smoothstep(60.0, 30.0, centerDist);
  float idleElevation = mix(baseNoise, wave, uSmoothness * 0.5 + 0.2) * 0.95 * globalFalloff;

  float subRegion = smoothstep(25.0, 0.0, centerDist);
  float subLift = uSubBass * subRegion * 5.5;
  float bassNoise = snoise(pos2D * 0.1 - vec2(0.0, uTime * 0.2));
  float bassRegion = smoothstep(35.0, 5.0, centerDist + bassNoise * 5.0);
  float bassMask = snoise(pos2D * 0.11 + vec2(uTime * 0.18, uTime * 0.12));
  float bassLift = uBass * bassRegion * smoothstep(0.12, 0.88, bassMask * 0.5 + 0.5 + uDensity * 0.25) * 4.5;
  float lowMidNoise = snoise(pos2D * 0.05 + vec2(uTime * 0.1, 0.0));
  float lowMidLift = uLowMid * (lowMidNoise * 0.5 + 0.5) * 2.8;
  float riverFlow = sin(pos2D.x * 0.2 + pos2D.y * 0.2 + snoise(pos2D * 0.1) * 2.0 - uTime * 2.0);
  float midLift = uMid * max(0.0, riverFlow) * 3.2;
  float highMidRegion = smoothstep(10.0, 45.0, centerDist);
  float highMidPick = snoise(pos2D * 0.14 + vec2(uTime * 0.33, uTime * 0.21));
  float highMidLift = uHighMid * highMidRegion * smoothstep(0.42, 0.96, highMidPick) * 2.5;

  float audioElevation = subLift + bassLift + lowMidLift + midLift + highMidLift;
  float spikeField = snoise(pos2D * 0.16 + vec2(uTime * 0.42, -uTime * 0.36));
  audioElevation += smoothstep(0.78, 0.98, spikeField) * uEnergy * 5.5;
  audioElevation *= globalFalloff;
  float elevation = idleElevation * uIdleMix + audioElevation;

  float rippleElevation = 0.0;
  float rippleIntensityNormal = 0.0;
  float rippleIntensityWhite = 0.0;
  float speed = 15.0;
  float width = 3.0;

  for (int i = 0; i < 10; i++) {
    if (uRippleActive[i] > 0.0) {
      float dist = length(pos2D - uRipplePos[i]);
      float timeSince = uTime - uRippleTime[i];
      float curSpeed = speed;
      float curWidth = width;
      float curFadeDist = 15.0;
      float elevationScale = 4.0;
      if (uRippleType[i] > 0.5) {
        curSpeed = 20.0;
        curWidth = 1.0;
        curFadeDist = 9.2;
        elevationScale = 1.15;
      }
      float waveRadius = timeSince * curSpeed;
      float d = dist - waveRadius;
      float rippleWave = exp(-d*d / curWidth);
      float fade = exp(-waveRadius / curFadeDist);
      float rPulse = rippleWave * fade * uRippleStrength[i];
      rippleElevation += rPulse * elevationScale;
      if (uRippleType[i] > 0.5) rippleIntensityWhite += rPulse;
      else rippleIntensityNormal += rPulse;
    }
  }

  elevation += rippleElevation;
  vRippleAnim = vec2(clamp(rippleIntensityNormal, 0.0, 1.0), clamp(rippleIntensityWhite, 0.0, 1.0));
  vElevation = elevation;

  float yPos = position.y + 0.5;
  vRelativeY = yPos;
  float totalHeight = 1.0 + elevation;
  vec3 pos = position;
  pos.y = -0.5 + yPos * totalHeight;
  vec4 worldPosition = instanceMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * viewMatrix * worldPosition;
}
`;

const FRAGMENT_SHADER = `
#include <common>
#include <uv_pars_fragment>
#include <normal_pars_fragment>

uniform float uTime;
uniform float uPresence;
uniform float uBrilliance;
uniform float uAir;
uniform float uWarmth;
uniform float uBrightness;
uniform float uSharpness;
uniform float uSparkleActive;
uniform vec3 uBaseColor1;
uniform vec3 uBaseColor2;
uniform vec3 uCoolCore;
uniform vec3 uCoolEdge;
uniform vec3 uWarmCore;
uniform vec3 uWarmEdge;
uniform vec3 uRippleColor;
uniform float uGlowIntensity;

varying float vElevation;
varying float vDistance;
varying vec2 vRippleAnim;
varying float vRelativeY;
varying vec2 vInstancePos;

float random(vec2 st) {
  return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
}

void main() {
  bool isTop = vNormal.y > 0.5;
  float distFromTop = 1.0 - vRelativeY;
  float centerDist = length(vInstancePos);
  float normElevation = clamp(vElevation / 8.0, 0.0, 1.0);
  vec3 cBase1 = uBaseColor1;
  vec3 cBase2 = uBaseColor2;
  float warmBlend = smoothstep(0.0, 1.0, uWarmth * 1.5 + (0.5 - centerDist/80.0));
  vec3 zoneCore = mix(uCoolCore, uWarmCore, warmBlend);
  vec3 zoneEdge = mix(uCoolEdge, uWarmEdge, warmBlend);
  vec2 colorCell = floor(vInstancePos * 1.15);
  float rnd = random(colorCell);
  float colorWave = sin(vInstancePos.x * 0.06 + vInstancePos.y * 0.045) * 0.5 + 0.5;
  float colorMix = mix(fract(rnd * 9.0), colorWave, 0.28);
  vec3 targetGlow = mix(zoneCore, zoneEdge, colorMix);
  float distFade = 1.0 - smoothstep(40.0, 75.0, centerDist);
  targetGlow = mix(targetGlow, vec3(0.4, 0.8, 1.0), uBrightness * 0.54);
  vec3 currentGlow = mix(cBase2, targetGlow, normElevation) * uGlowIntensity * distFade;
  currentGlow = mix(currentGlow, uRippleColor, vRippleAnim.x);
  currentGlow = mix(currentGlow, vec3(1.0, 1.0, 1.0), vRippleAnim.y * 0.78);
  vec3 bodyColor = mix(cBase1, cBase2, vRelativeY * distFade);
  vec3 finalColor;

  if (isTop) {
    float topIntensity = smoothstep(0.0, 0.4, normElevation);
    float twinkleDistFalloff = smoothstep(60.0, 30.0, centerDist);
    float twinkleMultiplier = mix(twinkleDistFalloff, 1.0, smoothstep(0.01, 0.1, normElevation));
    if (fract(rnd * 31.0) > 0.95 && normElevation < 0.1) {
      topIntensity += uAir * 2.0 * twinkleMultiplier * uSparkleActive;
    }
    finalColor = mix(cBase2, currentGlow, topIntensity);
    float edgeX = smoothstep(0.05, 0.01, vUv.x) + smoothstep(0.95, 0.99, vUv.x);
    float edgeY = smoothstep(0.05, 0.01, vUv.y) + smoothstep(0.95, 0.99, vUv.y);
    float edge = min(edgeX + edgeY, 1.0);
    finalColor += currentGlow * edge * 0.8 * (topIntensity + 0.3);
    float flashChance = smoothstep(0.3, 1.0, uPresence);
    if (fract(rnd * 53.0) > 0.98 - flashChance * 0.1) {
      float flashSync = sin(uTime * 40.0 + rnd * 100.0) * 0.5 + 0.5;
      finalColor += mix(vec3(1.0), vec3(0.5, 1.0, 1.0), rnd) * flashSync * uPresence * (1.0 + uSharpness * 2.0) * twinkleMultiplier * uSparkleActive;
    }
    if (edge > 0.5 && fract(rnd * 89.0 + uTime * 2.0) > 0.98) {
      finalColor += vec3(1.0) * uBrilliance * 3.0 * twinkleMultiplier * uSparkleActive;
    }
  } else {
    float verticalFalloff = mix(1.0, 3.0, uSharpness);
    float sideGlow = smoothstep(0.5 / verticalFalloff, 0.0, distFromTop) * normElevation;
    if (normElevation < 0.02) sideGlow = 0.0;
    finalColor = mix(bodyColor, currentGlow, sideGlow * 1.5);
    float rimGlow = smoothstep(0.03, 0.0, distFromTop) * normElevation;
    finalColor += currentGlow * rimGlow;
  }

  finalColor += uRippleColor * vRippleAnim.x * 0.38;
  finalColor += vec3(1.0, 1.0, 1.0) * vRippleAnim.y * 0.55;
  float aerialFog = smoothstep(30.0, 65.0, vDistance);
  vec3 atmosphericColor = mix(cBase1, cBase2, 0.4);
  finalColor = mix(finalColor, atmosphericColor, aerialFog * 0.5);

  float coarse = random(gl_FragCoord.xy * 1.35 + uTime * 0.22) - 0.5;
  float fine1 = random(gl_FragCoord.xy * 2.4 + uTime * 0.48) - 0.5;
  float fine2 = random(gl_FragCoord.xy * 5.2 - uTime * 0.3 + vUv * 175.0) - 0.5;
  float fine3 = random(vInstancePos * 34.0 + vUv * 195.0 + uTime * 1.8) - 0.5;
  float fine4 = random(gl_FragCoord.xy * 9.0 + vUv * 240.0 - uTime * 0.16) - 0.5;
  float fineGrain = coarse * 0.2 + fine1 * 0.3 + fine2 * 0.24 + fine3 * 0.16 + fine4 * 0.1;
  finalColor *= 1.0 + fineGrain * 0.13;
  finalColor += vec3(fineGrain) * 0.11;

  float alphaFade = 1.0 - smoothstep(55.0, 78.0, vDistance);
  gl_FragColor = vec4(finalColor, alphaFade);
}
`;

class TriggerConfig {
  constructor(action) {
    this.action = action;
    this.enabled = true;
    this.mode = 'Auto Beat';
    this.freqIndex = -1;
    this.threshold = 0.5;
    this.sensitivity = action === 'Meteor' ? 0.477 : 0.159;
    this.cooldown = action === 'Meteor' ? 227 : 56;
    this.bandStart = action === 'Meteor' ? 159 : 0;
    this.bandEnd = action === 'Meteor' ? 174 : 16;
    this.pulseStrength = action === 'Meteor' ? 0.53 : 0.212;
    this.currentCooldown = 0;
    this.beatHold = 0;
    this.lastEvalEnergy = 0;
    this.lastEvalThresh = 0;
    this.fluxHistory = new Array(40).fill(0);
    this.fluxHistoryIndex = 0;
    this.smoothedFlux = 0;
    this.prevSmoothedFlux = 0;
  }

  getTriggerRange() {
    if (this.mode === 'Auto Beat') return [this.bandStart, this.bandEnd];
    const center = this.freqIndex >= 0 ? this.freqIndex : Math.floor(0.2 * 512);
    return [Math.max(0, center - 2), Math.min(511, center + 2)];
  }
}

class SonicAudioAnalyzer {
  constructor(audioEl) {
    this.audioEl = audioEl;
    this.audioCtx = null;
    this.analyser = null;
    this.inputNode = null;
    this.outputConnected = false;
    this.sourceReady = false;
    this.dataArray = new Uint8Array(512);
    this.wallpaperAudioActiveUntil = 0;
    this.prevData = new Array(512).fill(0);
    this.prevBrightness = 0;
    this.visualReleaseUntil = 0;
    this.visualReleaseMs = 6500;
    this.visualRiseMs = 4800;
    this.pulseTrigger = new TriggerConfig('Pulse');
    this.meteorTrigger = new TriggerConfig('Meteor');
    this.onFreqTrigger = null;
    this.vizBands = {
      subBass: 0, bass: 0, lowMid: 0, mid: 0, highMid: 0, energy: 0, beat: 0,
    };
    this.smoothed = {
      bass: 0, mid: 0, treble: 0, energy: 0,
      subBass: 0, lowMid: 0, highMid: 0, presence: 0, brilliance: 0, air: 0,
      warmth: 0, brightness: 0, sharpness: 0, smoothness: 0, density: 0, spectralCentroid: 0,
    };
  }

  resetPipeline() {
    this.inputNode = null;
    this.outputConnected = false;
    this.sourceReady = false;
  }

  connect() {
    if (this.sourceReady && this.inputNode) return true;
    try {
      if (!this.audioCtx) {
        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (!this.analyser) {
        this.analyser = this.audioCtx.createAnalyser();
        this.analyser.fftSize = 1024;
        this.analyser.smoothingTimeConstant = 0.55;
        this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
      }
      if (!this.inputNode) {
        try {
          this.inputNode = this.audioCtx.createMediaElementSource(this.audioEl);
        } catch (error) {
          const message = String(error?.message || error);
          if (!message.includes('already connected')) throw error;
          if (!this.isPlaying) return false;
          const streamFactory = this.audioEl.captureStream || this.audioEl.mozCaptureStream;
          if (typeof streamFactory !== 'function') {
            console.warn('[sonic-viz] 音频元素已被占用，无法创建频谱分析');
            return false;
          }
          const stream = streamFactory.call(this.audioEl);
          if (!stream) return false;
          this.inputNode = this.audioCtx.createMediaStreamSource(stream);
        }
        this.inputNode.connect(this.analyser);
      }
      if (!this.outputConnected) {
        this.analyser.connect(this.audioCtx.destination);
        this.outputConnected = true;
      }
      this.sourceReady = true;
      return true;
    } catch (error) {
      console.warn('[sonic-viz] 音频分析器连接失败:', error);
      return false;
    }
  }

  ensureReady() {
    if (!this.connect() && this.isPlaying) {
      this.resetPipeline();
      this.connect();
    }
    this.resume();
  }

  resume() {
    if (this.audioCtx?.state === 'suspended') this.audioCtx.resume();
  }

  get isPlaying() {
    return !this.audioEl.paused && !this.audioEl.ended;
  }

  get isVisualReleasing() {
    return performance.now() < this.visualReleaseUntil;
  }

  beginVisualRelease(durationMs = this.visualReleaseMs) {
    const until = performance.now() + durationMs;
    this.visualReleaseUntil = Math.max(this.visualReleaseUntil, until);
  }

  clearVisualRelease() {
    this.visualReleaseUntil = 0;
  }

  evaluateTrigger(config, fluxScore, delta) {
    if (!config.enabled || !this.isPlaying) return;
    const frameStep = delta * 60;
    const binCount = this.dataArray.length || 512;
    const [startBin, endBin] = config.getTriggerRange();

    if (config.mode === 'Advanced') {
      let eVal = 0;
      if (config.freqIndex >= 0 && config.freqIndex < binCount) {
        let sum = 0;
        let count = 0;
        for (let k = startBin; k <= endBin; k++) {
          sum += (this.dataArray[k] || 0) / 255;
          count += 1;
        }
        eVal = count ? sum / count : 0;
        config.lastEvalThresh = config.threshold;
        if (config.currentCooldown <= 0 && eVal > config.threshold && this.onFreqTrigger) {
          this.onFreqTrigger(eVal, 'Advanced', config.action);
          config.currentCooldown = 60;
        }
      }
      config.lastEvalEnergy = eVal;
    }

    if (config.currentCooldown > 0) config.currentCooldown -= frameStep;

    if (config.mode !== 'Auto Beat') {
      config.prevSmoothedFlux = config.smoothedFlux;
      return;
    }

    config.smoothedFlux += (fluxScore - config.smoothedFlux) * 0.4;
    config.fluxHistory[config.fluxHistoryIndex] = config.smoothedFlux;
    config.fluxHistoryIndex = (config.fluxHistoryIndex + 1) % config.fluxHistory.length;

    let avgFlux = 0;
    for (let i = 0; i < config.fluxHistory.length; i++) avgFlux += config.fluxHistory[i];
    avgFlux /= config.fluxHistory.length;

    let fluxVariance = 0;
    for (let i = 0; i < config.fluxHistory.length; i++) {
      fluxVariance += Math.pow(config.fluxHistory[i] - avgFlux, 2);
    }
    fluxVariance /= config.fluxHistory.length;
    const fluxStdDev = Math.sqrt(fluxVariance);
    const thresholdMultiplier = Math.max(0.1, 5.0 - config.sensitivity * 4.0);
    const adaptiveThreshold = Math.max(0.05, avgFlux + fluxStdDev * thresholdMultiplier);
    const isPeak = config.prevSmoothedFlux > adaptiveThreshold && config.prevSmoothedFlux >= config.smoothedFlux;

    if (config.beatHold > 0) {
      config.beatHold -= frameStep;
    } else if (isPeak && config.prevSmoothedFlux - config.smoothedFlux > 0.0001) {
      const strength = config.prevSmoothedFlux * 3.0 * config.pulseStrength;
      if (strength >= 0.028 && this.onFreqTrigger) {
        this.onFreqTrigger(strength, 'Kick', config.action);
      }
      config.beatHold = config.cooldown;
    }
    config.prevSmoothedFlux = config.smoothedFlux;
  }

  getRawFrequencyData() {
    const hasWallpaper = performance.now() < this.wallpaperAudioActiveUntil;
    if (this.analyser && (this.isPlaying || hasWallpaper)) {
      this.analyser.getByteFrequencyData(this.dataArray);
    }
    return this.dataArray;
  }

  persistTriggerSettings() {
    writeTriggerSettingsStorage({
      Pulse: snapshotTriggerConfig(this.pulseTrigger),
      Meteor: snapshotTriggerConfig(this.meteorTrigger),
    });
  }

  getAudioData(delta = 1 / 120) {
    const hasWallpaper = performance.now() < this.wallpaperAudioActiveUntil;
    if (!this.analyser && !hasWallpaper) return { ...this.smoothed, viz: this.vizBands };

    const isVisualReleasing = this.isVisualReleasing;
    const binCount = this.dataArray.length;
    let energySum = 0;
    let centroidNum = 0;
    let centroidDen = 0;
    let subBassSum = 0;
    let bassSum = 0;
    let lowMidSum = 0;
    let midSum = 0;
    let highMidSum = 0;
    let presenceSum = 0;
    let brillianceSum = 0;
    let airSum = 0;
    let jumpVolatilitySum = 0;
    let fluxPulse = 0;
    let fluxMeteor = 0;

    if (this.isPlaying || hasWallpaper) {
      this.analyser.getByteFrequencyData(this.dataArray);
      for (let i = 0; i < binCount; i++) {
        const val = this.dataArray[i] / 255;
        energySum += val;
        centroidNum += i * val;
        centroidDen += val;
        const prevVal = this.prevData[i] || 0;
        jumpVolatilitySum += Math.abs(val - prevVal);
        if (i >= this.pulseTrigger.bandStart && i <= this.pulseTrigger.bandEnd) {
          const diff = val - prevVal;
          if (diff > 0) fluxPulse += diff;
        }
        if (i >= this.meteorTrigger.bandStart && i <= this.meteorTrigger.bandEnd) {
          const diff = val - prevVal;
          if (diff > 0) fluxMeteor += diff;
        }
        this.prevData[i] = val;
        if (i <= 1) subBassSum += val;
        else if (i <= 3) bassSum += val;
        else if (i <= 7) lowMidSum += val;
        else if (i <= 18) midSum += val;
        else if (i <= 46) highMidSum += val;
        else if (i <= 93) presenceSum += val;
        else if (i <= 186) brillianceSum += val;
        else if (i <= 372) airSum += val;
      }
      this.evaluateTrigger(this.pulseTrigger, fluxPulse, delta);
      this.evaluateTrigger(this.meteorTrigger, fluxMeteor, delta);
    } else {
      const binDecay = isVisualReleasing ? 0.94 : 0;
      const prevDecay = isVisualReleasing ? 0 : 0;
      for (let i = 0; i < binCount; i++) {
        if (isVisualReleasing) {
          this.dataArray[i] = Math.floor(this.dataArray[i] * binDecay);
          this.prevData[i] *= prevDecay;
        } else {
          this.dataArray[i] = 0;
          this.prevData[i] = 0;
        }
      }
    }

    const energy = energySum / binCount;
    const subBass = subBassSum / 2;
    const bass = bassSum / 2;
    const lowMid = lowMidSum / 4;
    const mid = midSum / 11;
    const highMid = highMidSum / 28;
    const presence = presenceSum / 47;
    const brilliance = brillianceSum / 93;
    const air = airSum / 186;
    const oldBass = (subBassSum + bassSum + lowMidSum) / 8;
    const oldMid = (midSum + highMidSum) / 39;
    const oldTreble = (presenceSum + brillianceSum + airSum) / 326;
    const warmth = energySum > 0 ? (subBassSum + bassSum + lowMidSum + midSum) / energySum : 0;
    const brightness = energySum > 0 ? (presenceSum + brillianceSum + airSum) / energySum : 0;
    const sharpness = Math.max(0, brightness - this.prevBrightness) * 10;
    this.prevBrightness = brightness;
    const smoothnessVal = Math.max(0, 1.0 - (jumpVolatilitySum / binCount) * 2.0);
    const activeThreshold = energy * 1.5;
    let activeBands = 0;
    [subBass, bass, lowMid, mid, highMid, presence, brilliance, air].forEach((band) => {
      if (band > activeThreshold) activeBands++;
    });
    const density = activeBands / 8;
    const spectralCentroid = centroidDen > 0 ? centroidNum / centroidDen : 0;
    const hasIncomingAudio = this.isPlaying && energySum > 0;
    const dt = hasIncomingAudio ? 0.15 : (isVisualReleasing ? 0.035 : 0.08);
    const k = dt;
    const s = this.smoothed;
    s.bass += (oldBass - s.bass) * k;
    s.mid += (oldMid - s.mid) * k;
    s.treble += (oldTreble - s.treble) * k;
    s.energy += (energy - s.energy) * k;
    s.subBass += (subBass - s.subBass) * k;
    s.lowMid += (lowMid - s.lowMid) * k;
    s.highMid += (highMid - s.highMid) * k;
    s.presence += (presence - s.presence) * k;
    s.brilliance += (brilliance - s.brilliance) * k;
    s.air += (air - s.air) * k;
    s.warmth += (warmth - s.warmth) * k;
    s.brightness += (brightness - s.brightness) * k;
    s.sharpness += (sharpness - s.sharpness) * k;
    s.smoothness += (smoothnessVal - s.smoothness) * k;
    s.density += (density - s.density) * k;
    s.spectralCentroid += (spectralCentroid - s.spectralCentroid) * k;

    const vk = hasIncomingAudio ? 0.38 : (isVisualReleasing ? 0.12 : 0.18);
    const v = this.vizBands;
    v.subBass += (subBass - v.subBass) * vk;
    v.bass += (bass - v.bass) * vk;
    v.lowMid += (lowMid - v.lowMid) * vk;
    v.mid += (mid - v.mid) * vk;
    v.highMid += (highMid - v.highMid) * vk;
    v.energy += (energy - v.energy) * vk;
    v.beat += (Math.min(0.8, fluxPulse * 5) - v.beat) * Math.min(1, vk * 1.1);

    return { ...this.smoothed, viz: this.vizBands };
  }
}

function makeRippleUniforms() {
  return {
    uRipplePos: { value: Array.from({ length: 10 }, () => new THREE.Vector2()) },
    uRippleTime: { value: new Float32Array(10).fill(-100) },
    uRippleStrength: { value: new Float32Array(10) },
    uRippleActive: { value: new Float32Array(10) },
    uRippleType: { value: new Float32Array(10) },
  };
}

export function initSonicTopographyViz({ container, audioEl, musicRoom, roomOpenClass = 'music-room-open', stats = null, volumeSlider = null }) {
  if (!container || !audioEl || !musicRoom) return;

  const profile = getVizDeviceProfile();
  let vizFrameMs = 1000 / profile.targetFps;

  const analyzer = new SonicAudioAnalyzer(audioEl);
  const storedTriggers = readTriggerSettingsStorage();
  applyStoredTriggerConfig(analyzer.pulseTrigger, storedTriggers.Pulse);
  applyStoredTriggerConfig(analyzer.meteorTrigger, storedTriggers.Meteor);

  let customThemes = readCustomThemeStorage();
  let activeCustomThemeId = readActiveCustomThemeStorage(customThemes);
  let activeThemeId = readActiveThemeStorage();
  let themeRotation = readThemeRotationStorage([...BUILT_IN_THEME_IDS, ...customThemes.map((p) => p.id)]);
  let groundEqSettings = readGroundEqSettingsStorage();
  let vizBackgroundSettings = readVizBackgroundStorage();
  let themeRotationTimer = null;
  let latestVizBgPalette = buildCustomPalette(vizBackgroundSettings);

  const THEME_BLUE_DEFAULT_KEY = 'shiloku-sonic-default-blue-v1';
  if (typeof window !== 'undefined' && !window.localStorage.getItem(THEME_BLUE_DEFAULT_KEY)) {
    activeThemeId = 'nocturnal';
    themeRotation = { enabled: false, intervalSeconds: 10, themeIds: [...BUILT_IN_THEME_IDS] };
    writeActiveThemeStorage('nocturnal');
    writeThemeRotationStorage(themeRotation, [...BUILT_IN_THEME_IDS, ...customThemes.map((p) => p.id)]);
    window.localStorage.setItem(THEME_BLUE_DEFAULT_KEY, '1');
  }

  const resolveCurrentTheme = () => resolveThemeVisual(
    THREE,
    activeThemeId,
    customThemes,
    activeCustomThemeId,
  );

  let targetTheme = resolveCurrentTheme();
  const themeTargets = {
    uBaseColor1: targetTheme.uBaseColor1.clone(),
    uBaseColor2: targetTheme.uBaseColor2.clone(),
    uCoolCore: targetTheme.uCoolCore.clone(),
    uCoolEdge: targetTheme.uCoolEdge.clone(),
    uWarmCore: targetTheme.uWarmCore.clone(),
    uWarmEdge: targetTheme.uWarmEdge.clone(),
    uRippleColor: targetTheme.uRippleColor.clone(),
    uGlowIntensity: targetTheme.uGlowIntensity,
  };

  const GRID = profile.grid;
  const SPACING = 1.05;
  const COUNT = GRID * GRID;
  const MAX_METEORS = profile.maxMeteors;
  const MAX_PARTICLES = profile.maxParticles;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 200);
  camera.position.set(36, 42, 36);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({
    antialias: profile.antialias,
    alpha: true,
    powerPreference: 'high-performance',
    desynchronized: profile.mobile,
    depth: true,
    stencil: false,
  });
  renderer.debug.checkShaderErrors = !profile.mobile;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, profile.pixelRatioCap));
  renderer.setClearColor(0x000000, 0);
  container.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0, 0);
  controls.enablePan = false;
  controls.autoRotate = true;
  controls.autoRotateSpeed = targetTheme.uRotationSpeed;
  controls.minDistance = 12;
  controls.maxDistance = 130;
  controls.maxPolarAngle = Math.PI / 2.2;
  controls.enableDamping = false;
  controls.touches = {
    ONE: THREE.TOUCH.ROTATE,
    TWO: THREE.TOUCH.DOLLY_ROTATE,
  };
  if (profile.mobile) {
    controls.minDistance = 16;
    controls.maxDistance = 95;
    controls.rotateSpeed = 0.55;
    controls.zoomSpeed = 0.7;
  }

  const shouldRunVizLoop = () => {
    return document.body.classList.contains(roomOpenClass)
      && !document.hidden;
  };

  const setVizLoopActive = (active) => {
    renderer.setAnimationLoop(active && shouldRunVizLoop() ? animate : null);
  };

  const fog = new THREE.Fog(`#${targetTheme.uBaseColor1.getHexString()}`, 30, 95);
  scene.fog = fog;
  scene.add(new THREE.AmbientLight(0xffffff, 0.5));
  const dirLight = new THREE.DirectionalLight(0xffffff, 1);
  dirLight.position.set(10, 20, 10);
  scene.add(dirLight);

  const rippleUniforms = makeRippleUniforms();
  const material = new THREE.ShaderMaterial({
    defines: { USE_INSTANCING: '', USE_UV: '' },
    uniforms: {
      uTime: { value: 0 },
      uSubBass: { value: 0 },
      uBass: { value: 0 },
      uLowMid: { value: 0 },
      uMid: { value: 0 },
      uHighMid: { value: 0 },
      uSmoothness: { value: 0 },
      uDensity: { value: 0 },
      uEnergy: { value: 0 },
      uIdleMix: { value: 1 },
      uPresence: { value: 0 },
      uBrilliance: { value: 0 },
      uAir: { value: 0 },
      uWarmth: { value: 0 },
      uBrightness: { value: 0 },
      uSparkleActive: { value: 0 },
      uSharpness: { value: 0 },
      uBaseColor1: { value: targetTheme.uBaseColor1.clone() },
      uBaseColor2: { value: targetTheme.uBaseColor2.clone() },
      uCoolCore: { value: targetTheme.uCoolCore.clone() },
      uCoolEdge: { value: targetTheme.uCoolEdge.clone() },
      uWarmCore: { value: targetTheme.uWarmCore.clone() },
      uWarmEdge: { value: targetTheme.uWarmEdge.clone() },
      uRippleColor: { value: targetTheme.uRippleColor.clone() },
      uGlowIntensity: { value: targetTheme.uGlowIntensity },
      ...rippleUniforms,
    },
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    transparent: true,
  });

  const geometry = new THREE.BoxGeometry(0.9, 1, 0.9);
  const mesh = new THREE.InstancedMesh(geometry, material, COUNT);
  const tempMatrix = new THREE.Matrix4();
  const offset = (GRID * SPACING) / 2;
  let idx = 0;
  for (let x = 0; x < GRID; x++) {
    for (let z = 0; z < GRID; z++) {
      tempMatrix.makeTranslation(x * SPACING - offset, 0.5, z * SPACING - offset);
      mesh.setMatrixAt(idx++, tempMatrix);
    }
  }
  mesh.instanceMatrix.needsUpdate = true;
  mesh.frustumCulled = true;
  const vizGroup = new THREE.Group();
  scene.add(vizGroup);
  vizGroup.add(mesh);

  if (!renderer.capabilities.isWebGL2) {
    console.warn('[sonic-viz] 建议使用 WebGL2 浏览器以显示完整 3D 视效');
  }

  const meteorMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
  const meteorMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.4, 1.2, 0.4), meteorMat, MAX_METEORS);
  meteorMesh.frustumCulled = false;
  vizGroup.add(meteorMesh);

  const particleMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false, transparent: true, opacity: 0.6 });
  const particleMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), particleMat, MAX_PARTICLES);
  particleMesh.frustumCulled = false;
  vizGroup.add(particleMesh);

  const ripples = Array.from({ length: 10 }, () => ({ pos: new THREE.Vector2(), time: -100, strength: 0, isActive: 0, rippleType: 0 }));
  let rippleIndex = 0;
  let lastMeteorSpawnTime = -Infinity;
  const meteors = Array.from({ length: MAX_METEORS }, () => ({ active: false, x: 0, y: -1000, z: 0, speed: 0, strength: 0 }));
  let meteorIndex = 0;
  const particles = Array.from({ length: MAX_PARTICLES }, () => ({
    active: false, x: 0, y: -1000, z: 0, vx: 0, vy: 0, vz: 0, life: 0, maxLife: 1, scale: 1,
  }));
  let particleIndex = 0;

  const dummyMatrix = new THREE.Matrix4();
  const dummyPosition = new THREE.Vector3();
  const dummyRotation = new THREE.Quaternion();
  const dummyScale = new THREE.Vector3();
  const shuttlePosOff = new THREE.Vector3();
  const shuttleTargetOff = new THREE.Vector3();
  const shuttleLookTarget = new THREE.Vector3();
  const warmMeteorColor = new THREE.Color();
  const whiteColor = new THREE.Color(1, 1, 1);

  function applyShuttleSway(intensity = 1) {
    if (intensity <= 0) return;
    const amp = 0.16 + intensity * 0.05;
    const t = clockElapsed;
    const bank = Math.sin(t * 0.33) * 0.9 + Math.sin(t * 0.71) * 0.22;

    shuttlePosOff.set(
      Math.sin(t * 0.42) * 0.2 * amp,
      Math.sin(t * 0.54) * 0.14 * amp,
      Math.cos(t * 0.46) * 0.16 * amp,
    );
    shuttleTargetOff.set(
      bank * 0.11 * amp,
      Math.cos(t * 0.58) * 0.05 * amp,
      Math.sin(t * 0.49) * 0.04 * amp,
    );
    const roll = bank * 0.04 * amp;

    camera.position.add(shuttlePosOff);
    shuttleLookTarget.copy(controls.target).add(shuttleTargetOff);
    camera.lookAt(shuttleLookTarget);
    camera.rotateZ(roll);
  }

  function pushRippleUniform(i) {
    const slot = ripples[i];
    const u = material.uniforms;
    u.uRipplePos.value[i].copy(slot.pos);
    u.uRippleTime.value[i] = slot.time;
    u.uRippleStrength.value[i] = slot.strength;
    u.uRippleActive.value[i] = slot.isActive;
    u.uRippleType.value[i] = slot.rippleType;
  }

  function syncRippleUniforms(elapsed) {
    material.uniforms.uTime.value = elapsed;
  }

  const RIPPLE_RING = 0;
  const RIPPLE_WHITE = 1;

  function addRipple(x, z, strength, isWhite = false) {
    const slot = ripples[rippleIndex];
    slot.pos.set(x, z);
    slot.time = clockElapsed;
    slot.strength = strength * volumeToReact(currentVolumeLevel) * VIZ_REACT_GAIN;
    slot.rippleType = isWhite ? RIPPLE_WHITE : RIPPLE_RING;
    slot.isActive = 1;
    pushRippleUniform(rippleIndex);
    rippleIndex = (rippleIndex + 1) % 10;
  }

  function spawnParticle(x, y, z, speedMultiplier) {
    const p = particles[particleIndex];
    p.active = true;
    p.x = x + (Math.random() - 0.5) * 1.5;
    p.y = y + (Math.random() - 0.5) * 1.5;
    p.z = z + (Math.random() - 0.5) * 1.5;
    p.vx = (Math.random() - 0.5) * 2.0;
    p.vy = Math.random() * 2.0 + speedMultiplier * 10.0;
    p.vz = (Math.random() - 0.5) * 2.0;
    p.life = 0;
    p.maxLife = 0.5 + Math.random() * 0.5;
    p.scale = Math.random() * 0.6 + 0.2;
    particleIndex = (particleIndex + 1) % MAX_PARTICLES;
  }

  function addMeteor(strength) {
    const cooldownSeconds = analyzer.meteorTrigger.cooldown / 60;
    if (clockElapsed - lastMeteorSpawnTime < cooldownSeconds) return;
    lastMeteorSpawnTime = clockElapsed;
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * 25;
    const m = meteors[meteorIndex];
    m.active = true;
    m.x = Math.cos(angle) * dist;
    m.z = Math.sin(angle) * dist;
    m.y = 30 + Math.random() * 10;
    m.speed = (1.0 + Math.random() * 0.5 + strength * 1.5) * (0.85 + VIZ_REACT_GAIN * 0.25);
    m.strength = strength * VIZ_REACT_GAIN;
    meteorIndex = (meteorIndex + 1) % MAX_METEORS;
  }

  analyzer.onFreqTrigger = (strength, mode, action) => {
    if (action === 'Meteor') {
      addMeteor(strength);
      return;
    }
    const angle = Math.random() * Math.PI * 2;
    if (mode === 'Kick') {
      const dist = Math.random() * 25;
      addRipple(Math.cos(angle) * dist, Math.sin(angle) * dist, Math.min(strength * 3.18, 4.24));
    } else {
      const dist = 10 + Math.random() * 25;
      addRipple(Math.cos(angle) * dist, Math.sin(angle) * dist, Math.min(strength * 3.18, 3.18));
    }
  };

  const statEls = stats ? Object.fromEntries(
    Object.entries(stats).map(([key, ids]) => [
      key,
      {
        value: ids.value ? document.getElementById(ids.value) : null,
        bar: ids.bar ? document.getElementById(ids.bar) : null,
      },
    ]),
  ) : null;
  let lastVizActive = null;

  const STAT_GAIN = { bass: 48, mid: 72, treble: 88, energy: 68 };

  function updateStats(data) {
    if (!statEls) return;
    Object.entries(statEls).forEach(([key, els]) => {
      const raw = Math.max(0, Number(data[key]) || 0);
      const gain = STAT_GAIN[key] ?? 70;
      const pct = Math.min(100, raw * gain);
      if (els.value) els.value.textContent = pct.toFixed(1);
      if (els.bar) els.bar.style.width = `${pct.toFixed(1)}%`;
    });
  }
  let clockElapsed = 0;
  let vizLastFrameAt = 0;
  const VOLUME_SCALE_MIN = 0.5;
  const VOLUME_SCALE_MAX = 1.0;
  const VOLUME_REACT_MIN = 0.1;
  const VIZ_REACT_GAIN = 1.0;
  let targetVolumeLevel = 1;
  let currentVolumeLevel = 1;

  const readVolumeLevel = () => {
    if (!volumeSlider) return 1;
    const value = Number(volumeSlider.value);
    return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 1;
  };

  const volumeToScale = (level) => VOLUME_SCALE_MIN + level * (VOLUME_SCALE_MAX - VOLUME_SCALE_MIN);
  const volumeToReact = (level) => VOLUME_REACT_MIN + level * (1 - VOLUME_REACT_MIN);

  if (volumeSlider) {
    targetVolumeLevel = readVolumeLevel();
    currentVolumeLevel = targetVolumeLevel;
    volumeSlider.addEventListener('input', () => {
      targetVolumeLevel = readVolumeLevel();
    });
  }

  function applyVizBackground(paletteOverride = null) {
    const result = applyVizBackgroundSettings(musicRoom, vizBackgroundSettings, paletteOverride);
    latestVizBgPalette = result.palette;
    const fogColor = latestVizBgPalette.fog || latestVizBgPalette.deep || latestVizBgPalette.mid;
    if (fogColor) fog.color.set(fogColor);
    return latestVizBgPalette;
  }

  async function applyVizBackgroundFromCover(url) {
    if (vizBackgroundSettings.mode !== VIZ_BG_MODE_FOLLOW_SONG || !url) return null;
    const palette = await extractPaletteFromCoverUrl(url);
    return applyVizBackground(palette);
  }

  function setVizBackgroundSettings(nextSettings) {
    vizBackgroundSettings = writeVizBackgroundStorage(nextSettings);
    if (vizBackgroundSettings.mode !== VIZ_BG_MODE_FOLLOW_SONG) {
      return applyVizBackground();
    }
    return latestVizBgPalette;
  }

  function refreshThemeTargets() {
    targetTheme = resolveCurrentTheme();
    themeTargets.uBaseColor1.copy(targetTheme.uBaseColor1);
    themeTargets.uBaseColor2.copy(targetTheme.uBaseColor2);
    themeTargets.uCoolCore.copy(targetTheme.uCoolCore);
    themeTargets.uCoolEdge.copy(targetTheme.uCoolEdge);
    themeTargets.uWarmCore.copy(targetTheme.uWarmCore);
    themeTargets.uWarmEdge.copy(targetTheme.uWarmEdge);
    themeTargets.uRippleColor.copy(targetTheme.uRippleColor);
    themeTargets.uGlowIntensity = targetTheme.uGlowIntensity;
    controls.autoRotateSpeed = targetTheme.uRotationSpeed;
    if (vizBackgroundSettings.mode !== VIZ_BG_MODE_FOLLOW_SONG) {
      applyVizBackground();
    } else if (latestVizBgPalette) {
      fog.color.set(latestVizBgPalette.fog || latestVizBgPalette.deep);
    } else {
      fog.color.set(`#${targetTheme.uBaseColor1.getHexString()}`);
    }
    if (targetTheme.accentHex) {
      musicRoom.style.setProperty('--aether-accent', targetTheme.accentHex);
      musicRoom.style.setProperty('--music-accent', targetTheme.accentHex);
    }
    musicRoom.classList.toggle('player-panel-hidden', !targetTheme.uShowPlayerPanel);
    window.dispatchEvent(new CustomEvent('sonic:theme-changed', {
      detail: {
        themeId: activeThemeId,
        customThemeId: activeCustomThemeId,
        themeName: targetTheme.name,
        showPlayerPanel: targetTheme.uShowPlayerPanel,
        accentHex: targetTheme.accentHex,
      },
    }));
  }

  function applyThemeState(nextThemeId, nextCustomId = activeCustomThemeId) {
    activeThemeId = nextThemeId;
    activeCustomThemeId = nextCustomId;
    writeActiveThemeStorage(activeThemeId);
    writeActiveCustomThemeStorage(activeCustomThemeId);
    refreshThemeTargets();
  }

  function setCustomThemes(nextThemes, nextActiveId = activeCustomThemeId) {
    customThemes = nextThemes;
    activeCustomThemeId = nextActiveId;
    writeCustomThemeStorage(customThemes);
    writeActiveCustomThemeStorage(activeCustomThemeId);
    refreshThemeTargets();
    restartThemeRotation();
  }

  function setThemeRotation(nextRotation) {
    themeRotation = nextRotation;
    writeThemeRotationStorage(themeRotation, [...BUILT_IN_THEME_IDS, ...customThemes.map((p) => p.id)]);
    restartThemeRotation();
  }

  function setGroundEqSettings(nextSettings) {
    groundEqSettings = nextSettings;
    writeGroundEqSettingsStorage(groundEqSettings);
  }

  function restartThemeRotation() {
    if (themeRotationTimer) {
      clearInterval(themeRotationTimer);
      themeRotationTimer = null;
    }
    if (!themeRotation.enabled || themeRotation.themeIds.length < 2) return;
    themeRotationTimer = window.setInterval(() => {
      const currentThemeKey = activeThemeId === CUSTOM_THEME_ID ? activeCustomThemeId : activeThemeId;
      const currentIndex = themeRotation.themeIds.indexOf(currentThemeKey);
      const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % themeRotation.themeIds.length : 0;
      const nextId = themeRotation.themeIds[nextIndex];
      if (BUILT_IN_THEME_IDS.includes(nextId)) applyThemeState(nextId, activeCustomThemeId);
      else applyThemeState(CUSTOM_THEME_ID, nextId);
    }, themeRotation.intervalSeconds * 1000);
  }

  function cycleTheme() {
    const next = cycleThemeId(activeThemeId, activeCustomThemeId, customThemes);
    applyThemeState(next.themeId, next.customId);
  }

  function reloadSonicSettingsFromStorage() {
    customThemes = readCustomThemeStorage();
    activeCustomThemeId = readActiveCustomThemeStorage(customThemes);
    activeThemeId = readActiveThemeStorage();
    themeRotation = readThemeRotationStorage([...BUILT_IN_THEME_IDS, ...customThemes.map((p) => p.id)]);
    groundEqSettings = readGroundEqSettingsStorage();
    vizBackgroundSettings = readVizBackgroundStorage();
    latestVizBgPalette = buildCustomPalette(vizBackgroundSettings);
    const storedTriggers = readTriggerSettingsStorage();
    applyStoredTriggerConfig(analyzer.pulseTrigger, storedTriggers.Pulse);
    applyStoredTriggerConfig(analyzer.meteorTrigger, storedTriggers.Meteor);
    refreshThemeTargets();
    applyVizBackground();
    restartThemeRotation();
  }

  refreshThemeTargets();
  applyVizBackground();
  restartThemeRotation();

  function resize() {
    const w = container.clientWidth || window.innerWidth;
    const h = container.clientHeight || window.innerHeight;
    if (w < 2 || h < 2) return;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, profile.pixelRatioCap));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function ensureAudio() {
    analyzer.ensureReady();
  }

  function animate(now = 0) {
    const open = document.body.classList.contains(roomOpenClass);
    if (!open) {
      musicRoom.classList.remove('viz-active');
      renderer.domElement.style.opacity = '0';
      renderer.domElement.style.pointerEvents = 'none';
      vizLastFrameAt = 0;
      lastVizActive = null;
      return;
    }

    if (!vizLastFrameAt) vizLastFrameAt = now;
    const elapsedMs = now - vizLastFrameAt;
    if (elapsedMs < vizFrameMs) return;
    vizLastFrameAt = now;
    const delta = Math.min(Math.max(elapsedMs / 1000, 0), VIZ_MAX_DELTA);

    if (renderer.domElement.style.opacity !== '1') {
      renderer.domElement.style.opacity = '1';
      renderer.domElement.style.pointerEvents = 'auto';
      renderer.domElement.style.cursor = 'default';
      renderer.domElement.style.touchAction = 'none';
    }
    ensureAudio();
    clockElapsed += delta;
    controls.autoRotate = true;
    controls.update();

    targetVolumeLevel = readVolumeLevel();
    currentVolumeLevel = THREE.MathUtils.lerp(currentVolumeLevel, targetVolumeLevel, Math.min(1, 5 * delta));
    const volScale = volumeToScale(currentVolumeLevel);
    const volReact = volumeToReact(currentVolumeLevel);

    const data = analyzer.getAudioData(delta);
    vizGroup.scale.setScalar(volScale);
    controls.autoRotateSpeed = targetTheme.uRotationSpeed;

    const playing = analyzer.isPlaying;

    const releasing = analyzer.isVisualReleasing;
    const vizActive = playing || releasing;
    if (lastVizActive !== vizActive) {
      musicRoom.classList.toggle('viz-active', vizActive);
      lastVizActive = vizActive;
    }

    const lerpSpeed = 3.0 * delta;
    const mat = material.uniforms;
    mat.uBaseColor1.value.lerp(themeTargets.uBaseColor1, lerpSpeed);
    mat.uBaseColor2.value.lerp(themeTargets.uBaseColor2, lerpSpeed);
    mat.uCoolCore.value.lerp(themeTargets.uCoolCore, lerpSpeed);
    mat.uCoolEdge.value.lerp(themeTargets.uCoolEdge, lerpSpeed);
    mat.uWarmCore.value.lerp(themeTargets.uWarmCore, lerpSpeed);
    mat.uWarmEdge.value.lerp(themeTargets.uWarmEdge, lerpSpeed);
    mat.uRippleColor.value.lerp(themeTargets.uRippleColor, lerpSpeed);
    const glowTarget = Math.max(
      0.4 * themeTargets.uGlowIntensity,
      (playing || releasing) ? themeTargets.uGlowIntensity * volReact * 0.72 : themeTargets.uGlowIntensity * 0.34 * volReact,
    );
    const glowLerp = (playing || releasing) ? lerpSpeed : Math.min(1, 1.1 * delta);
    mat.uGlowIntensity.value = THREE.MathUtils.lerp(mat.uGlowIntensity.value, glowTarget, glowLerp);

    const transitionLerp = (durationMs) => 1 - Math.pow(0.018, delta / (durationMs / 1000));
    const audioLerp = playing
      ? transitionLerp(analyzer.visualRiseMs)
      : transitionLerp(analyzer.visualReleaseMs);
    const setAudioUniform = (key, value) => {
      if (playing) {
        mat[key].value = value;
      } else {
        mat[key].value = THREE.MathUtils.lerp(mat[key].value, value, audioLerp);
      }
    };

    const viz = data.viz || data;
    const react = volReact * VIZ_REACT_GAIN;
    const eqCurve = groundEqSettings.curve;
    const eqSubBass = applyGroundEqValue(viz.subBass * react, eqCurve, 0.00);
    const eqBass = applyGroundEqValue(viz.bass * react, eqCurve, 0.12);
    const eqLowMid = applyGroundEqValue(viz.lowMid * react, eqCurve, 0.28);
    const eqMid = applyGroundEqValue(viz.mid * react, eqCurve, 0.42);
    const eqHighMid = applyGroundEqValue(viz.highMid * react, eqCurve, 0.58);
    const eqPresence = applyGroundEqValue(data.presence * volReact, eqCurve, 0.72);
    const eqBrilliance = applyGroundEqValue(data.brilliance * volReact, eqCurve, 0.86);
    const eqAir = applyGroundEqValue(data.air * volReact, eqCurve, 1.00);
    const eqAverage = eqCurve.reduce((sum, value) => sum + value, 0) / Math.max(1, eqCurve.length);
    const eqEnergy = applyGroundEqValue(Math.max(viz.energy, viz.beat * 0.6) * react, eqCurve, eqAverage / 100);
    const eqDenom = Math.max(0.001, eqSubBass + eqBass + eqLowMid + eqMid + eqPresence + eqBrilliance + eqAir);

    setAudioUniform('uSubBass', eqSubBass);
    setAudioUniform('uBass', eqBass);
    setAudioUniform('uLowMid', eqLowMid);
    setAudioUniform('uMid', eqMid);
    setAudioUniform('uEnergy', eqEnergy);
    setAudioUniform('uHighMid', eqHighMid);
    setAudioUniform('uSmoothness', data.smoothness);
    setAudioUniform('uDensity', data.density * volReact);
    setAudioUniform('uPresence', eqPresence);
    setAudioUniform('uBrilliance', eqBrilliance);
    setAudioUniform('uAir', eqAir);
    setAudioUniform('uWarmth', Math.max(0, Math.min(1, (eqSubBass + eqBass + eqLowMid + eqMid) / eqDenom)));
    setAudioUniform('uBrightness', Math.max(0, Math.min(1, (eqPresence + eqBrilliance + eqAir) / eqDenom)));
    mat.uSparkleActive.value = playing ? 1 : 0;
    setAudioUniform('uSharpness', data.sharpness * volReact);
    mat.uIdleMix.value = THREE.MathUtils.lerp(
      mat.uIdleMix.value,
      playing ? 0.38 : 1.0,
      playing ? lerpSpeed * 1.4 : Math.min(1, 1.1 * delta),
    );
    syncRippleUniforms(clockElapsed);
    updateStats(data);

    const warmMeteor = warmMeteorColor.copy(mat.uWarmCore.value).lerp(whiteColor, 0.7);
    meteorMat.color.lerp(warmMeteor, lerpSpeed);
    particleMat.color.copy(meteorMat.color);

    for (let i = 0; i < MAX_METEORS; i++) {
      const m = meteors[i];
      if (!m.active) {
        dummyPosition.set(0, -1000, 0);
        dummyScale.set(0, 0, 0);
      } else {
        m.y -= m.speed * 60 * delta;
        if (m.y <= 0) {
          m.active = false;
          addRipple(m.x, m.z, Math.min(m.strength * 1.22, 1.46), true);
          for (let j = 0; j < 10; j++) spawnParticle(m.x, 0.5, m.z, m.speed * 1.5);
        }
        dummyPosition.set(m.x, Math.max(0, m.y), m.z);
        dummyScale.set(1.5, 1.5, 1.5);
        if (m.y > 0 && Math.random() > 0.24) spawnParticle(m.x, m.y, m.z, m.speed * 0.2);
      }
      dummyMatrix.compose(dummyPosition, dummyRotation, dummyScale);
      meteorMesh.setMatrixAt(i, dummyMatrix);
    }
    meteorMesh.instanceMatrix.needsUpdate = true;

    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = particles[i];
      if (!p.active) {
        dummyPosition.set(0, -1000, 0);
        dummyScale.set(0, 0, 0);
      } else {
        p.life += delta;
        if (p.life >= p.maxLife) {
          p.active = false;
          dummyScale.set(0, 0, 0);
        } else {
          p.x += p.vx * delta * 10;
          p.y += p.vy * delta * 10;
          p.z += p.vz * delta * 10;
          const s = p.scale * (1.0 - p.life / p.maxLife);
          dummyPosition.set(p.x, p.y, p.z);
          dummyScale.set(s, s, s);
        }
      }
      dummyMatrix.compose(dummyPosition, dummyRotation, dummyScale);
      particleMesh.setMatrixAt(i, dummyMatrix);
    }
    particleMesh.instanceMatrix.needsUpdate = true;

    applyShuttleSway(profile.shuttleSway ? currentVolumeLevel : 0);
    renderer.render(scene, camera);
  }

  resize();
  ensureAudio();
  setVizLoopActive(document.body.classList.contains(roomOpenClass));

  const onAudioStart = () => {
    analyzer.clearVisualRelease();
    analyzer.ensureReady();
  };
  const onAudioPause = () => {
    analyzer.beginVisualRelease();
  };
  audioEl.addEventListener('play', onAudioStart);
  audioEl.addEventListener('playing', onAudioStart);
  audioEl.addEventListener('pause', onAudioPause);

  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', () => {
    setVizLoopActive(document.body.classList.contains(roomOpenClass));
  });
  new MutationObserver(() => {
    const open = document.body.classList.contains(roomOpenClass);
    setVizLoopActive(open);
    if (open) {
      resize();
      ensureAudio();
    }
  }).observe(document.body, { attributes: true, attributeFilter: ['class'] });

  window.addEventListener('shiloku:nowplaying', (event) => {
    const cover = event.detail?.song?.cover;
    if (cover) void applyVizBackgroundFromCover(cover);
  });

  window.__shilokuViz = {
    analyzer,
    testRipple: () => addRipple(0, 0, 2.5),
    ensureAudio,
    getRawFrequencyData: () => analyzer.getRawFrequencyData(),
    getGroundEqSettings: () => ({ ...groundEqSettings, curve: [...groundEqSettings.curve] }),
    setGroundEqSettings,
    getThemeState: () => ({
      activeThemeId,
      activeCustomThemeId,
      customThemes: customThemes.map((p) => ({ ...p })),
      themeRotation: { ...themeRotation, themeIds: [...themeRotation.themeIds] },
      resolvedTheme: {
        name: targetTheme.name,
        accentHex: targetTheme.accentHex,
        showPlayerPanel: targetTheme.uShowPlayerPanel,
        rotationSpeed: targetTheme.uRotationSpeed,
      },
    }),
    applyThemeState,
    setCustomThemes,
    setThemeRotation,
    cycleTheme,
    reloadSonicSettingsFromStorage,
    persistTriggerSettings: () => analyzer.persistTriggerSettings(),
    refreshThemeAccent: () => refreshThemeTargets(),
    getVizBackgroundSettings: () => ({ ...vizBackgroundSettings }),
    setVizBackgroundSettings,
    applyVizBackgroundFromCover,
  };

  return { analyzer, renderer, resize };
}
