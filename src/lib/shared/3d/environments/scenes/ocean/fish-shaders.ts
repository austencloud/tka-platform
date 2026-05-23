const MAX_SPECIES = 50;
const MAX_SDF_STRUCTURES = 4;

const NOISE_GLSL = /* glsl */ `
vec4 permute(vec4 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod(i, 289.0);
  vec4 p = permute(permute(permute(
      i.z + vec4(0.0, i1.z, i2.z, 1.0))
    + i.y + vec4(0.0, i1.y, i2.y, 1.0))
    + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 1.0 / 7.0;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}

vec3 curlNoise(vec3 p) {
  float e = 0.1;
  vec3 dx = vec3(e, 0.0, 0.0);
  vec3 dy = vec3(0.0, e, 0.0);
  vec3 dz = vec3(0.0, 0.0, e);
  float px = snoise(p + dx) - snoise(p - dx);
  float py = snoise(p + dy) - snoise(p - dy);
  float pz = snoise(p + dz) - snoise(p - dz);
  return vec3(py - pz, pz - px, px - py) / (2.0 * e);
}
`;

const SAFE_NORMALIZE_GLSL = /* glsl */ `
vec3 safeNormalize(vec3 v) {
  float l = length(v);
  return l > 1e-6 ? v / l : vec3(0.0, 0.0, 1.0);
}

vec2 safeNormalize2(vec2 v) {
  float l = length(v);
  return l > 1e-6 ? v / l : vec2(0.0, 1.0);
}
`;

export const velocityShader = /* glsl */ `
uniform float uDelta;
uniform float uTime;
uniform float uSepDist;
uniform float uAliDist;
uniform float uMaxSpeed;
uniform float uMinSpeed;
uniform float uGroundY;
uniform float uHeightMin;
uniform float uHeightMax;
uniform float uStageRadius;
uniform float uBoundRadius;
uniform float uFishCount;
uniform float uMaxSteer;
uniform float uTargetSize;
uniform float uHalfSpeedTime;
uniform float uCurrentStrength;
uniform float uPerceptionCos;
uniform sampler2D tTraits;

uniform vec3 uSchoolCenters[${MAX_SPECIES}];
uniform float uSchoolRadius;

uniform vec3 uScatterOrigin;
uniform float uScatterRadius;
uniform float uScatterForce;
uniform float uScatterStartTime;
uniform float uScatterWaveSpeed;

uniform int uDartCount;
uniform int uDartIndices[8];
uniform float uDartStrength;

uniform int uExcursionCount;
uniform int uExcursionIndices[4];
uniform float uExcursionBias[4];

uniform int uSpawnCount;
uniform int uSpawnStartIdx;
uniform vec4 uSpawnVelocities[64];

// ── SDF obstacle avoidance uniforms ──────────────────────────────────
uniform int uReefSDFCount;
uniform sampler3D uReefSDF0;
uniform sampler3D uReefSDF1;
uniform sampler3D uReefSDF2;
uniform sampler3D uReefSDF3;
uniform mat4 uReefSDFInvMatrix0;
uniform mat4 uReefSDFInvMatrix1;
uniform mat4 uReefSDFInvMatrix2;
uniform mat4 uReefSDFInvMatrix3;
uniform float uReefAvoidDist;   // world-space distance at which avoidance kicks in
uniform float uReefAvoidForce;  // strength of the avoidance push

${NOISE_GLSL}
${SAFE_NORMALIZE_GLSL}

// ── SDF sampling with tetrahedron gradient ──────────────────────────
// Returns the signed distance from the SDF at the given world position.
// Negative = inside mesh, positive = outside.
float sampleSDF(sampler3D sdfTex, mat4 invMatrix, vec3 worldPos) {
  vec3 uvw = (invMatrix * vec4(worldPos, 1.0)).xyz;
  // If outside [0,1]³, the point is outside the SDF volume — return large positive
  if (any(lessThan(uvw, vec3(0.0))) || any(greaterThan(uvw, vec3(1.0)))) {
    return 999.0;
  }
  return texture(sdfTex, uvw).r;
}

// Compute the SDF gradient using the tetrahedron technique (4 taps).
// Returns the normalized direction pointing away from the surface (outward).
vec3 sdfGradient(sampler3D sdfTex, mat4 invMatrix, vec3 worldPos, float h) {
  vec2 k = vec2(1.0, -1.0);
  return normalize(
    k.xyy * sampleSDF(sdfTex, invMatrix, worldPos + k.xyy * h) +
    k.yyx * sampleSDF(sdfTex, invMatrix, worldPos + k.yyx * h) +
    k.yxy * sampleSDF(sdfTex, invMatrix, worldPos + k.yxy * h) +
    k.xxx * sampleSDF(sdfTex, invMatrix, worldPos + k.xxx * h)
  );
}

// Compute avoidance force from a single SDF structure.
// Returns a repulsion vector (zero if fish is far enough away).
vec3 sdfAvoidance(sampler3D sdfTex, mat4 invMatrix, vec3 worldPos, float avoidDist, float force) {
  float dist = sampleSDF(sdfTex, invMatrix, worldPos);
  if (dist > avoidDist || dist > 998.0) return vec3(0.0);

  // The closer to (or inside) the surface, the stronger the push
  float strength = 1.0 - clamp(dist / avoidDist, 0.0, 1.0);
  // Inside the mesh: extra strong push
  if (dist < 0.0) strength = 1.0 + abs(dist) * 2.0;

  vec3 grad = sdfGradient(sdfTex, invMatrix, worldPos, 0.3);
  return grad * strength * strength * force;
}

void main() {
  int fishIdx = int(gl_FragCoord.y) * int(resolution.x) + int(gl_FragCoord.x);

  if (uSpawnCount > 0 && fishIdx >= uSpawnStartIdx && fishIdx < uSpawnStartIdx + uSpawnCount) {
    gl_FragColor = uSpawnVelocities[fishIdx - uSpawnStartIdx];
    return;
  }

  vec2 uv = gl_FragCoord.xy / resolution.xy;
  vec4 posData = texture2D(texturePosition, uv);
  vec3 pos = posData.xyz;
  vec4 velData = texture2D(textureVelocity, uv);
  vec3 vel = velData.xyz;
  float instanceScale = velData.w;

  if (pos.x > 9000.0) { gl_FragColor = vec4(0.0, 0.0, 0.0, instanceScale); return; }

  vec4 traits = texture2D(tTraits, uv);
  float speedMult = traits.r;
  float socialMult = traits.g;
  float boldness = traits.b;

  int mySpecies = int(floor(posData.w));

  vec3 sep = vec3(0.0);
  vec3 ali = vec3(0.0);
  vec3 coh = vec3(0.0);
  float sepN = 0.0;
  float aliN = 0.0;
  float cohN = 0.0;

  vec3 forward = safeNormalize(vel);

  for (float y = 0.0; y < resolution.y; y += 1.0) {
    for (float x = 0.0; x < resolution.x; x += 1.0) {
      vec2 ref = (vec2(x, y) + 0.5) / resolution.xy;
      vec4 neighborPos = texture2D(texturePosition, ref);
      vec3 op = neighborPos.xyz;
      if (op.x > 9000.0) continue;

      vec3 toNeighbor = op - pos;
      float d = length(toNeighbor);
      if (d < 0.001 || d > uAliDist * 1.5) continue;

      float cosAngle = dot(forward, safeNormalize(toNeighbor));
      if (cosAngle < uPerceptionCos) continue;

      int neighborSpecies = int(floor(neighborPos.w));
      bool sameSpecies = (mySpecies == neighborSpecies);

      if (d < uSepDist) {
        sep += safeNormalize(pos - op) * (1.0 - d / uSepDist);
        sepN += 1.0;
      }
      if (d < uAliDist && sameSpecies) {
        ali += texture2D(textureVelocity, ref).xyz;
        aliN += 1.0;
      }
      if (d < uAliDist * 1.5 && sameSpecies) {
        coh += op;
        cohN += 1.0;
      }
    }
  }

  vec3 steer = vec3(0.0);

  if (sepN > 0.0) steer += safeNormalize(sep / sepN) * 0.3;
  if (aliN > 0.0) steer += (ali / aliN - vel) * 0.6 * socialMult;
  if (cohN > 0.0) steer += safeNormalize(coh / cohN - pos) * 0.8 * socialMult;

  if (mySpecies < ${MAX_SPECIES}) {
    vec3 toSchool = uSchoolCenters[mySpecies] - pos;
    float schoolDist = length(toSchool);
    if (schoolDist > uSchoolRadius) {
      float pull = (schoolDist - uSchoolRadius) / uSchoolRadius;
      steer += safeNormalize(toSchool) * pull * 0.5;
    }
  }

  float curlScale = uCurrentStrength * (1.0 - socialMult * 0.4);
  vec3 curlForce = curlNoise(pos * 0.15 + uTime * 0.02) * curlScale;
  steer += curlForce;

  vec2 toCenter = -pos.xz;
  float distXZ = length(pos.xz);
  if (distXZ > uBoundRadius * 0.6) {
    float t = (distXZ - uBoundRadius * 0.6) / (uBoundRadius * 0.4);
    steer.xz += safeNormalize2(toCenter) * t * 1.5;
  }

  float minY = uGroundY + uHeightMin;
  float maxY = uGroundY + uHeightMax;
  if (pos.y < minY + 0.5) steer.y += (minY + 0.5 - pos.y) * 2.0;
  if (pos.y > maxY - 0.5) steer.y -= (pos.y - maxY + 0.5) * 2.0;

  float avoidDist = (uStageRadius + 2.5) * (1.5 - boldness * 0.4);
  if (distXZ < avoidDist) {
    float pen = avoidDist - distXZ;
    steer.xz += safeNormalize2(pos.xz) * pen * 3.0;
  }

  float distToRay = distance(pos, uScatterOrigin);
  float boldScatter = uScatterRadius * (1.3 - boldness * 0.6);
  if (distToRay < boldScatter && uScatterForce > 0.0 && uScatterOrigin.y > -900.0) {
    vec3 away = safeNormalize(pos - uScatterOrigin);
    float proximity = 1.0 - distToRay / boldScatter;

    // Fountain effect: tangential split for head-on fish
    vec3 tangent = safeNormalize(cross(away, vec3(0.0, 1.0, 0.0)));
    vec3 fishDir = safeNormalize(vel.xyz);
    float dotFwd = abs(dot(fishDir, away));
    float tangentWeight = smoothstep(0.3, 0.8, dotFwd) * 0.6;
    vec3 fleeDir = safeNormalize(mix(away, tangent, tangentWeight));

    // Trafalgar wave: distance-delayed onset
    float delay = distToRay * uScatterWaveSpeed;
    float timeSinceScatter = uTime - uScatterStartTime;
    float waveReached = step(delay, timeSinceScatter);

    steer += fleeDir * uScatterForce * proximity * proximity * (1.5 - boldness) * waveReached;
  }

  // ── SDF reef obstacle avoidance ──────────────────────────────────
  if (uReefSDFCount > 0) {
    steer += sdfAvoidance(uReefSDF0, uReefSDFInvMatrix0, pos, uReefAvoidDist, uReefAvoidForce);
  }
  if (uReefSDFCount > 1) {
    steer += sdfAvoidance(uReefSDF1, uReefSDFInvMatrix1, pos, uReefAvoidDist, uReefAvoidForce);
  }
  if (uReefSDFCount > 2) {
    steer += sdfAvoidance(uReefSDF2, uReefSDFInvMatrix2, pos, uReefAvoidDist, uReefAvoidForce);
  }
  if (uReefSDFCount > 3) {
    steer += sdfAvoidance(uReefSDF3, uReefSDFInvMatrix3, pos, uReefAvoidDist, uReefAvoidForce);
  }

  float bodyLength = uTargetSize * instanceScale;
  float adjMax = uMaxSpeed * speedMult * bodyLength;
  float adjMin = uMinSpeed * speedMult * bodyLength;

  vec4 stateData = texture2D(textureState, uv);
  float state = stateData.x;
  vec3 threatDir = vec3(stateData.z, 0.0, stateData.w);

  if (state > 0.5 && state < 1.5) {
    steer = safeNormalize(threatDir) * 2.0 + sep * 0.3;
    adjMax *= 2.0;
  }
  if (state > 1.5 && state < 2.5) {
    steer = safeNormalize(threatDir) * 1.5;
    adjMax *= 1.5;
  }
  if (state > 2.5 && state < 3.5) {
    steer *= 0.1;
    adjMax *= 0.2;
  }
  if (state > 5.5 && state < 6.5) {
    int si = int(floor(posData.w));
    vec3 home = uSchoolCenters[si];
    float dHome = distance(pos, home);
    if (dHome < uSchoolRadius) {
      steer = safeNormalize(threatDir) * 1.5;
    } else {
      steer = safeNormalize(home - pos) * 1.0;
    }
  }

  float steerLen = length(steer);
  if (steerLen > uMaxSteer) steer = steer / steerLen * uMaxSteer;

  float drag = pow(0.5, uDelta / max(uHalfSpeedTime, 0.01));
  vel = vel * drag + steer * uDelta;

  float spd = length(vel);
  if (spd > adjMax) vel = vel / spd * adjMax;
  if (spd > 0.001 && spd < adjMin) vel = vel / spd * adjMin;

  for (int i = 0; i < 8; i++) {
    if (i >= uDartCount) break;
    if (fishIdx == uDartIndices[i]) {
      vel += safeNormalize(vel) * uDartStrength;
    }
  }

  for (int i = 0; i < 4; i++) {
    if (i >= uExcursionCount) break;
    if (fishIdx == uExcursionIndices[i]) {
      vel.y += uExcursionBias[i];
    }
  }

  gl_FragColor = vec4(vel, instanceScale);
}
`;

export const positionShader = /* glsl */ `
uniform float uDelta;
uniform int uSpawnCount;
uniform int uSpawnStartIdx;
uniform vec4 uSpawnPositions[64];
uniform int uDespawnCount;
uniform int uDespawnStartIdx;

void main() {
  int fishIdx = int(gl_FragCoord.y) * int(resolution.x) + int(gl_FragCoord.x);

  if (uDespawnCount > 0 && fishIdx >= uDespawnStartIdx && fishIdx < uDespawnStartIdx + uDespawnCount) {
    gl_FragColor = vec4(9999.0, 9999.0, 9999.0, 0.0);
    return;
  }

  if (uSpawnCount > 0 && fishIdx >= uSpawnStartIdx && fishIdx < uSpawnStartIdx + uSpawnCount) {
    gl_FragColor = uSpawnPositions[fishIdx - uSpawnStartIdx];
    return;
  }

  vec2 uv = gl_FragCoord.xy / resolution.xy;
  vec4 posData = texture2D(texturePosition, uv);
  vec3 vel = texture2D(textureVelocity, uv).xyz;

  // NaN firewall: if velocity is NaN, zero it; if position is NaN, respawn
  if (any(isnan(vel)) || any(isinf(vel))) vel = vec3(0.0);
  posData.xyz += vel * uDelta;

  if (any(isnan(posData.xyz)) || any(isinf(posData.xyz))) {
    float hash1 = fract(sin(uv.x * 12.9898 + uv.y * 78.233) * 43758.5453);
    float hash2 = fract(sin(uv.x * 39.346 + uv.y * 11.135) * 43758.5453);
    float hash3 = fract(sin(uv.x * 73.156 + uv.y * 29.984) * 43758.5453);
    posData.xyz = vec3(
      (hash1 - 0.5) * 20.0,
      2.0 + hash2 * 5.0,
      (hash3 - 0.5) * 20.0
    );
  }

  gl_FragColor = posData;
}
`;

export const renderVertexShader = /* glsl */ `
attribute vec2 aReference;

uniform sampler2D tPosition;
uniform sampler2D tVelocity;
uniform float uSize;
uniform float uTime;
uniform float uMaxSpeed;

uniform float uSwimFreq;
uniform float uWaveK;
uniform float uBaseAmplitude;
uniform float uStiffness;
uniform float uAmpExponent;
uniform float uStrideAmp;
uniform float uRollAmp;
uniform float uPectoralFreq;
uniform float uPectoralAmp;

varying vec3 vNormal;
varying vec2 vUv;
varying vec3 vWorldPos;

${SAFE_NORMALIZE_GLSL}

void main() {
  vec4 posData = texture2D(tPosition, aReference);
  vec3 fishPos = posData.xyz;
  vUv = uv;

  vec4 velData = texture2D(tVelocity, aReference);
  vec3 fishVel = velData.xyz;
  float instanceScale = velData.w;

  vec3 forward = safeNormalize(fishVel);
  vec3 worldUp = vec3(0.0, 1.0, 0.0);
  if (abs(dot(forward, worldUp)) > 0.99) worldUp = vec3(1.0, 0.0, 0.0);

  vec3 right = safeNormalize(cross(worldUp, forward));
  vec3 up = cross(forward, right);
  mat3 rot = mat3(right, up, forward);

  float fishScale = uSize * instanceScale;
  vec3 localPos = position;

  float spineMask = localPos.z * 0.5 + 0.5;
  float dorsalMask = max(localPos.y, 0.0);

  float speedMult = length(fishVel) / max(uMaxSpeed * 0.5, 0.001);
  float speedRatio = clamp(speedMult, 0.0, 2.0);
  float perInstanceJitter = aReference.x * 2.0;
  float freq = uSwimFreq * mix(0.4, 1.0, min(speedRatio, 1.0)) + perInstanceJitter;
  float phase = uTime * freq + localPos.z * uWaveK;

  float envelope = pow(max(spineMask, 0.001), uAmpExponent);
  float stiffMask = mix(1.0, envelope, uStiffness);
  float bodyAmp = uBaseAmplitude * stiffMask * max(speedRatio, 0.15);

  localPos.x += sin(phase) * bodyAmp;
  localPos.x += sin(uTime * freq * 0.5) * uStrideAmp;
  localPos.z += sin(phase) * uRollAmp * spineMask;

  float pecPhase = uTime * uPectoralFreq + perInstanceJitter * 3.0;
  localPos.y += sin(pecPhase) * uPectoralAmp * dorsalMask;

  localPos.y += sin(phase * 1.5) * bodyAmp * 0.3 * dorsalMask;

  float swimSpeed = length(fishVel);
  float cStartRatio = swimSpeed / (uMaxSpeed * 0.5);
  float cStartIntensity = smoothstep(1.5, 2.5, cStartRatio);
  float cBend = cStartIntensity * sin(localPos.z * 1.5) * 0.3;
  localPos.x += cBend;

  vec3 transformed = rot * (localPos * fishScale) + fishPos;
  vWorldPos = transformed;
  vNormal = safeNormalize(rot * normal);

  gl_Position = projectionMatrix * viewMatrix * vec4(transformed, 1.0);
}
`;

export const renderFragmentShader = /* glsl */ `
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
`;
