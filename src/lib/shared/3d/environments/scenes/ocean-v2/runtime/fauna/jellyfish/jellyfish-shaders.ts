export const normalVert = /* glsl */ `
varying vec2 vUv;
varying vec3 vNormal;

void main() {
  vUv = uv;
  vNormal = normalize(position);
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
}
`;

export const bulbFrag = /* glsl */ `
uniform vec3 diffuse;
uniform vec3 diffuseB;
uniform float opacity;
uniform float time;
varying vec2 vUv;
varying vec3 vNormal;

const vec3 eye = vec3(0.0, 0.0, 1.0);

float oscillate(float vMin, float vMax, float t) {
  float halfRange = (vMax - vMin) / vMax * 0.5;
  return (sin(t) * halfRange + (1.0 - halfRange)) * vMax;
}

float accumulate(vec2 uv, float saturation, float scale) {
  saturation -= sin(uv.x * 60.0) * 0.25 + sin(uv.x * 50.0 * scale) * 0.25 + 0.75;
  saturation -= sin(uv.y * sin(uv.x * 5.0) * 5.0 * scale) * 0.05;
  saturation -= sin(uv.y * sin((1.0 - uv.x) * 5.0) * 5.0 * scale) * 0.05;
  saturation -= sin(uv.y * sin(uv.y + cos(uv.x) * 2.0) * 3.0 * scale) * 0.15;
  saturation -= sin(uv.y * sin(uv.y + cos(1.0 - uv.x) * 2.0) * 3.0 * scale) * 0.15;
  saturation -= sin((uv.y - 1.5) * sin(uv.y + cos(uv.x - 1.0) * 2.0) * 4.0 * scale) * 0.15;
  saturation -= sin((uv.y - 1.5) * sin(uv.y + cos(uv.x) * 2.0) * 3.0 * scale) * 0.15;
  saturation -= sin(uv.y * 5.0) * 0.15 + sin(uv.y * 2.5) * 1.25;
  return saturation;
}

void main() {
  vec3 normal = normalize(mat3(viewMatrix) * vNormal);
  float rim = 1.0 - max(dot(eye, normal), 0.0);
  float saturation = 0.0;

  vec2 uv0 = vUv;
  vec2 uv1 = uv0 + rim;
  vec2 uv2 = vec2(-rim * 0.25);
  vec2 uv3 = vec2(rim, uv0.y);

  float scale0 = oscillate( 8.0, 15.0, time * 0.25 + 0.5);
  float scale1 = oscillate(12.0, 20.0, time * 0.125);

  saturation += max(accumulate(uv0, 2.0, scale0), -0.5);
  saturation += max(accumulate(uv1, 2.0, scale1),  0.25);
  saturation += max(accumulate(uv2, 1.0, 1.0), -0.25);
  saturation += max(accumulate(uv3, 1.0, 1.0), -0.25);

  vec3 baseColor = mix(diffuse, diffuseB, smoothstep(-0.5, 0.5, saturation));
  float baseAlpha = (1.0 - smoothstep(-0.5, 2.5, saturation)) * opacity;

  // Fresnel rim glow on the hood — bioluminescent edge emission
  float fresnelGlow = pow(rim, 3.0) * 0.8;
  vec3 glowTint = diffuse * 1.5 + vec3(0.05, 0.15, 0.3);

  gl_FragColor = vec4(baseColor + glowTint * fresnelGlow, baseAlpha + fresnelGlow * 0.2);
}
`;

export const gelVert = /* glsl */ `
varying vec3 vNormal;

void main() {
  vNormal = normalize(position);
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
}
`;

export const gelFrag = /* glsl */ `
uniform vec3 diffuse;
uniform float opacity;
varying vec3 vNormal;

void main() {
  vec3 eye = vec3(0.0, 0.0, 1.0);
  vec3 normal = normalize(mat3(viewMatrix) * vNormal);
  float rim = 1.0 - max(dot(eye, normal), 0.0);

  float rimLight = 0.25 +
    smoothstep(0.25, 1.0, rim) * 0.5 +
    smoothstep(0.90, 1.0, rim) * 0.8;

  // Fresnel rim glow — bioluminescent subsurface scattering approximation
  float fresnelGlow = pow(rim, 2.5) * 1.2;
  vec3 glowColor = diffuse * 1.8 + vec3(0.1, 0.2, 0.4);

  gl_FragColor.rgb = diffuse * vec3(rimLight) + glowColor * fresnelGlow;
  gl_FragColor.a = opacity + fresnelGlow * 0.3;
}
`;

export const tentacleVert = /* glsl */ `
uniform float area;
varying float centerDist;

void main() {
  centerDist = length(position);
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
}
`;

export const tentacleFrag = /* glsl */ `
uniform vec3 diffuse;
uniform float opacity;
uniform float area;
varying float centerDist;

void main() {
  float illumination = area * 2.0 / (centerDist * centerDist);
  gl_FragColor = vec4(
    mix(vec3(1.0), diffuse, clamp(illumination, 0.0, 1.25)),
    clamp(opacity * illumination * illumination, 0.0, opacity));
}
`;

export const tailFrag = /* glsl */ `
uniform vec3 diffuse;
uniform vec3 diffuseB;
uniform float opacity;
uniform float scale;
varying vec2 vUv;
varying vec3 vNormal;

const vec3 eye = vec3(0.0, 0.0, 1.0);

float accumulate(vec2 uv, float saturation, float scale) {
  saturation -= sin(uv.y * 12.0 * scale) * 0.8 + uv.y * 1.5 + sin(uv.x * 20.0 * scale) * 0.1 + 0.85;
  saturation -= sin(uv.y * sin(uv.x * 5.0) * 5.0 * scale) * 0.05;
  saturation -= sin(uv.y * sin((1.0 - uv.x) * 5.0) * 5.0 * scale) * 0.05;
  saturation -= sin(uv.y * sin(uv.y + cos(uv.x) * 2.0) * 10.0 * scale) * 0.15;
  saturation -= sin(uv.y * sin(uv.y + cos(1.0 - uv.x) * 2.0) * 10.0 * scale) * 0.15;
  return saturation;
}

void main() {
  vec2 uv = vUv;
  vec3 normal = normalize(mat3(viewMatrix) * vNormal);
  float rim = 1.0 - max(dot(eye, normal), 0.0);
  float saturation = 0.0;

  saturation += accumulate(uv, 2.0, scale);
  saturation += max(accumulate(vec2(rim), 0.75, scale * 0.25), -0.25);

  gl_FragColor = vec4(
    mix(diffuseB, diffuse, saturation) * opacity,
    clamp(saturation, 0.2, 1.0) * opacity);
}
`;
