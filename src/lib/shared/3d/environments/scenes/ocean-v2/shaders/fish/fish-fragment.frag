uniform sampler2D tAlbedo;
uniform vec3 uFallbackColor;
uniform float uHasTexture;
uniform vec3 uLightDir;
uniform float uAmbient;
uniform float uRoughness;
uniform vec3 uFogColor;
uniform float uFogNear;
uniform float uFogFar;

varying vec3 vNormal;
varying vec2 vUv;
varying vec3 vWorldPos;

void main() {
  vec3 albedo = mix(uFallbackColor, texture2D(tAlbedo, vUv).rgb, uHasTexture);
  vec3 N = normalize(vNormal);

  float NdotL = max(dot(N, uLightDir), 0.0);

  vec3 viewDir = normalize(cameraPosition - vWorldPos);
  vec3 H = normalize(uLightDir + viewDir);
  float NdotH = max(dot(N, H), 0.0);
  float spec = pow(NdotH, mix(8.0, 64.0, 1.0 - uRoughness));

  vec3 lit = albedo * (uAmbient + NdotL * 0.6) + vec3(spec * 0.15);

  float dist = length(vWorldPos.xz);
  float fog = smoothstep(uFogNear, uFogFar, dist);
  lit = mix(lit, uFogColor, fog);

  gl_FragColor = vec4(lit, 1.0);
}
