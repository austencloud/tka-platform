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

  // Light enters at the surface and attenuates on the way down: full strength
  // just under the water plane, tapering as it nears the seabed, with a soft
  // top edge so the column never hard-clips against the water.
  // The previous curve was inverted — smoothstep(1.0, 0.5, vUv.y) erased the
  // entire top half, so a shaft was brightest in the dark deep and absent where
  // it actually enters the water.
  float verticalFade = smoothstep(1.0, 0.88, vUv.y) * smoothstep(0.0, 0.28, vUv.y);
  float depthFalloff = mix(0.5, 1.0, vNormY);

  float s1 = sin(vWorldY * 1.7 + uTime * 1.2);
  float s2 = sin(vWorldY * 3.3 - uTime * 0.7 + 1.3);
  float s3 = sin(vWorldY * 0.8 + uTime * 2.1 + 3.7);
  float s4 = cos(vWorldY * 5.1 - uTime * 1.5 + 0.9);
  float shimmer = 0.55 + 0.2 * s1 + 0.12 * s2 + 0.08 * s3 + 0.05 * s4;

  vec3 color = mix(uColorBottom, uColorTop, vNormY);
  float alpha =
    centerFade * verticalFade * depthFalloff * shimmer * uIntensity * vOpacityMult;

  // Emit straight colour and let AdditiveBlending's SrcAlpha x One do the single
  // multiply. The old line premultiplied (color * alpha) AND passed alpha * 0.35
  // as source alpha, so the blend squared it: a nominal 0.216 alpha reached the
  // framebuffer at 0.35 * 0.216^2 = 0.016. The shafts were mathematically
  // invisible, which is why no screenshot of this scene has ever shown one.
  // Consequence: uIntensity now reads roughly 25x stronger than the same number
  // did before this fix. Do not compare it to historical values.
  gl_FragColor = vec4(color, alpha);
}
