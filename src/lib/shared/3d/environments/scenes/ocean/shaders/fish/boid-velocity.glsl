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

uniform vec3 uSchoolCenters[50];
uniform float uSchoolRadius;

uniform vec3 uCursorRayOrigin;
uniform vec3 uCursorRayDir;
uniform float uCursorActive;
uniform float uScatterRadius;
uniform float uScatterForce;
uniform float uScatterStartTime;
uniform float uScatterWaveSpeed;
uniform float uFlashBurst;

uniform int uDartCount;
uniform int uDartIndices[8];
uniform float uDartStrength;

uniform int uExcursionCount;
uniform int uExcursionIndices[4];
uniform float uExcursionBias[4];

uniform int uSpawnCount;
uniform int uSpawnStartIdx;
uniform vec4 uSpawnVelocities[64];

// ── Simplex noise ──────────────────────────────────────────────────────

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

// ── Safe normalize ─────────────────────────────────────────────────────

vec3 safeNormalize(vec3 v) {
  float l = length(v);
  return l > 1e-6 ? v / l : vec3(0.0, 0.0, 1.0);
}

vec2 safeNormalize2(vec2 v) {
  float l = length(v);
  return l > 1e-6 ? v / l : vec2(0.0, 1.0);
}

// ── Main ───────────────────────────────────────────────────────────────

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

  if (mySpecies < 50) {
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

  // Scatter against the cursor RAY, not a single world point. Distance is the
  // perpendicular gap from the fish to the cursor's line of sight, so a fish
  // under the cursor flees regardless of its depth — fixes the dead scatter a
  // plane-intersection origin caused (fish off the plane's depth read as far).
  float scatterIntensity = 0.0;
  vec3 toCursor = pos - uCursorRayOrigin;
  float alongRay = max(dot(toCursor, uCursorRayDir), 0.0);
  vec3 closestOnRay = uCursorRayOrigin + uCursorRayDir * alongRay;
  vec3 rejection = pos - closestOnRay;
  float distToRay = length(rejection);
  float boldScatter = uScatterRadius * (1.3 - boldness * 0.6);
  if (distToRay < boldScatter && uScatterForce > 0.0 && uCursorActive > 0.5) {
    vec3 away = safeNormalize(rejection);
    float proximity = 1.0 - distToRay / boldScatter;

    vec3 tangent = safeNormalize(cross(away, vec3(0.0, 1.0, 0.0)));
    vec3 fishDir = safeNormalize(vel.xyz);
    float dotFwd = abs(dot(fishDir, away));
    float tangentWeight = smoothstep(0.3, 0.8, dotFwd) * 0.6;
    vec3 fleeDir = safeNormalize(mix(away, tangent, tangentWeight));

    float delay = distToRay * uScatterWaveSpeed;
    float timeSinceScatter = uTime - uScatterStartTime;
    float waveReached = step(delay, timeSinceScatter);

    scatterIntensity = proximity * proximity * (1.5 - boldness * 0.3) * waveReached;
    steer += fleeDir * uScatterForce * scatterIntensity;

    if (uFlashBurst > 0.5) {
      steer += away * uScatterForce * 2.0 * proximity;
    }
  }

  float bodyLength = uTargetSize * instanceScale;
  float adjMax = uMaxSpeed * speedMult * bodyLength;
  float adjMin = uMinSpeed * speedMult * bodyLength;

  vec4 stateData = texture2D(textureState, uv);
  float state = stateData.x;
  vec3 threatDir = vec3(stateData.z, 0.0, stateData.w);

  if (state > 0.5 && state < 1.5) {
    float fleeTimer = stateData.y;
    float maxFleeTime = 6.0;
    float timeSinceStartle = maxFleeTime - fleeTimer;

    // How much the fish has recovered (0 = fresh scare, 1 = fully calm)
    float recovery = smoothstep(1.0, 5.0, timeSinceStartle);

    if (scatterIntensity < 0.01) {
      // Blend from flee-only steering to normal boids as recovery progresses
      vec3 fleeSteer = safeNormalize(threatDir) * 2.0 + sep * 0.3;
      steer = mix(fleeSteer, steer, recovery);
    }

    // 4-phase recovery: burst -> sustain -> elevated -> calm-down
    float burstMult = 3.5;    // 0-0.3s: explosive escape
    float sustainMult = 2.5;  // 0.3-1.0s: fast sustained flee
    float elevatedMult = 1.6; // 1.0-3.0s: still jittery, above cruising
    float calmMult = 1.0;     // 3.0-6.0s: gradual return to normal

    float speedMult = mix(burstMult, sustainMult, smoothstep(0.0, 0.3, timeSinceStartle));
    speedMult = mix(speedMult, elevatedMult, smoothstep(0.8, 2.5, timeSinceStartle));
    speedMult = mix(speedMult, calmMult, smoothstep(3.0, 6.0, timeSinceStartle));
    adjMax *= speedMult;

    if (scatterIntensity > 0.01) {
      steer += safeNormalize(threatDir) * uScatterForce * 0.5;
    }
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

  float effectiveMaxSteer = uMaxSteer + scatterIntensity * uScatterForce * 0.8;
  float steerLen = length(steer);
  if (steerLen > effectiveMaxSteer) steer = steer / steerLen * effectiveMaxSteer;

  float drag = pow(0.5, uDelta / max(uHalfSpeedTime, 0.01));
  vel = vel * drag + steer * uDelta;

  adjMax += scatterIntensity * uScatterForce * 0.3;

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
