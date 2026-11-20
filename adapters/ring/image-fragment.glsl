precision highp float;

uniform vec2 uImageSizes;
uniform vec2 uPlaneSizes;
uniform float uOpacity;
uniform sampler2D tMap;

varying vec2 vUv;

uniform float uFocus;
varying float face, light;
void main() {
  if (uOpacity < .002) discard;
  if (face < .5) discard;
  gl_FragColor = vec4(texture2D(tMap, vUv).rgb, uOpacity);
}
