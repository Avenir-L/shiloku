precision highp float;
attribute vec3 position, normal;
attribute vec2 uv;
uniform float uSpeed, uTime, uFocus;
uniform mat4 modelViewMatrix, projectionMatrix;
varying vec2 vUv;
varying float face, light;
void main() {
  vUv = uv;
  face = normal.z;
  light = dot(normalize(mat3(modelViewMatrix)*normal),normalize(vec3(-.6,.5,.8)));
  vec3 p = position;
  p.z += (sin(p.x*4.+uTime)+cos(p.y*2.+uTime))*clamp(uSpeed,-1.,1.)*(1.-uFocus);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p,1.);
}
