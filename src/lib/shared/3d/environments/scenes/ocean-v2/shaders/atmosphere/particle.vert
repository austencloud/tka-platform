attribute float aPhase;
attribute float aSize;
uniform float uTime;
uniform vec3 uCurrentDir;
uniform float uAreaWidth;
uniform float uAreaHeight;
uniform float uAreaDepth;
varying float vAlpha;
varying float vScatter;

void main() {
  float t = uTime * 0.12 + aPhase;

  vec3 turb;
  turb.x = sin(position.y * 1.3 + t * 0.7) * 0.5
         + sin(position.z * 0.8 + t * 0.3) * 0.25;
  turb.y = sin(position.x * 0.9 + t * 0.5) * 0.15
         + cos(position.z * 1.1 + t * 0.2) * 0.1;
  turb.z = cos(position.x * 1.2 + t * 0.6) * 0.5
         + sin(position.y * 0.7 + t * 0.4) * 0.25;

  vec3 drift = uCurrentDir * uTime;

  vec3 pos = position + turb + drift;

  pos.x = mod(pos.x + uAreaWidth * 0.5, uAreaWidth) - uAreaWidth * 0.5;
  pos.y = mod(pos.y, uAreaHeight);
  pos.z = mod(pos.z + uAreaDepth * 0.5, uAreaDepth) - uAreaDepth * 0.5;

  float hFrac = pos.y / uAreaHeight;
  vAlpha = (1.0 - smoothstep(0.7, 1.0, hFrac))
         * (0.3 + 0.7 * (1.0 - hFrac));

  vScatter = smoothstep(0.3, 0.9, hFrac);

  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  gl_PointSize = aSize * (800.0 / -mv.z);
  gl_Position = projectionMatrix * mv;
}
