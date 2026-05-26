uniform float uTime;
uniform vec3 uColorTop;
uniform vec3 uColorBottom;
uniform float uIntensity;
varying vec2 vUv;
varying float vWorldY;
varying float vNormY;
varying float vOpacityMult;

void main() {
  float cx = (vUv.x - 0.48) * 2.0;
  float centerFade = exp(-cx * cx * 2.5);
  float verticalFade = smoothstep(0.0, 0.08, vUv.y) * smoothstep(1.0, 0.5, vUv.y);

  float s1 = sin(vWorldY * 1.7 + uTime * 1.2);
  float s2 = sin(vWorldY * 3.3 - uTime * 0.7 + 1.3);
  float s3 = sin(vWorldY * 0.8 + uTime * 2.1 + 3.7);
  float s4 = cos(vWorldY * 5.1 - uTime * 1.5 + 0.9);
  float shimmer = 0.55 + 0.2 * s1 + 0.12 * s2 + 0.08 * s3 + 0.05 * s4;

  vec3 color = mix(uColorBottom, uColorTop, vNormY);
  float alpha = centerFade * verticalFade * shimmer * uIntensity * vOpacityMult;
  gl_FragColor = vec4(color * alpha, alpha * 0.35);
}
