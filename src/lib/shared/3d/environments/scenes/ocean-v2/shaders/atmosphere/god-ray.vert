attribute float aOpacityMult;
varying vec2 vUv;
varying float vWorldY;
varying float vNormY;
varying float vOpacityMult;
uniform float uHeight;
uniform float uGroundY;

void main() {
  vUv = uv;
  vOpacityMult = aOpacityMult;
  vec4 worldPos = modelMatrix * instanceMatrix * vec4(position, 1.0);
  vWorldY = worldPos.y;
  vNormY = clamp((worldPos.y - uGroundY) / uHeight, 0.0, 1.0);
  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
