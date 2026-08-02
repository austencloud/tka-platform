uniform float uTime;
uniform float uWaveScale;
uniform float uWaveSpeed;
uniform float uWaveAmplitude;
uniform float uSize;
varying vec2 vUv;
varying vec3 vWorldPosition;
varying float vDisplacement;
varying vec3 vNormal;
varying float vEdgeFade;

vec3 gerstnerWave(vec2 D, float w, float A, float Q, float phi,
                  vec2 p, float t, inout vec3 tangent, inout vec3 binormal) {
  float phase = w * dot(D, p) + phi * t;
  float S = sin(phase);
  float C = cos(phase);
  float WA = w * A;
  tangent += vec3(-Q * D.x * D.x * WA * S,
                  -Q * D.x * D.y * WA * S,
                   D.x * WA * C);
  binormal += vec3(-Q * D.x * D.y * WA * S,
                   -Q * D.y * D.y * WA * S,
                    D.y * WA * C);
  return vec3(Q * A * D.x * C,
              Q * A * D.y * C,
               A * S);
}

void main() {
  vUv = uv;
  vec3 pos = position;
  // Three's PlaneGeometry is authored in local XY, then WaterSurface rotates
  // the mesh into world XZ. Wave displacement and derivatives must therefore
  // use XY here; treating the unrotated plane as XZ collapsed one wave axis.
  vec2 p = pos.xy;
  vec3 tangent = vec3(1.0, 0.0, 0.0);
  vec3 binormal = vec3(0.0, 1.0, 0.0);
  vec3 disp = vec3(0.0);
  float baseW = uWaveScale;
  float baseA = uWaveAmplitude;
  float speed = uWaveSpeed;
  disp += gerstnerWave(normalize(vec2(1.0, 0.6)), baseW, baseA,
                       0.6, speed, p, uTime, tangent, binormal);
  disp += gerstnerWave(normalize(vec2(-0.4, 1.0)), baseW * 1.3, baseA * 0.6,
                       0.5, speed * 1.2, p, uTime, tangent, binormal);
  disp += gerstnerWave(normalize(vec2(0.8, -0.3)), baseW * 2.1, baseA * 0.3,
                       0.4, speed * 1.6, p, uTime, tangent, binormal);
  disp += gerstnerWave(normalize(vec2(-0.6, -0.8)), baseW * 3.2, baseA * 0.15,
                       0.3, speed * 2.0, p, uTime, tangent, binormal);
  float edgeDist = length(pos.xy);
  float halfSize = uSize * 0.5;
  float dispFade = 1.0 - smoothstep(halfSize * 0.35, halfSize * 0.65, edgeDist);
  pos += disp * dispFade;
  vDisplacement = disp.z * dispFade;
  vEdgeFade = dispFade;
  vec3 localNormal = normalize(cross(tangent, binormal));
  vNormal = normalize((modelMatrix * vec4(localNormal, 0.0)).xyz);
  vec4 worldPos = modelMatrix * vec4(pos, 1.0);
  vWorldPosition = worldPos.xyz;
  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
