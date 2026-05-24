const TROPHIC_ROLE_COUNT = 6;

export const stateShader = /* glsl */ `
uniform float uDelta;
uniform float uTime;
uniform float uFleeRange;
uniform float uHuntRange;
uniform float uPanicRadius;
uniform float uHomeRadius;
uniform float uPerceptionCos;

uniform int uTrophicRole[50];

uniform float uThreatMatrix[${TROPHIC_ROLE_COUNT * TROPHIC_ROLE_COUNT}];
uniform float uHuntMatrix[${TROPHIC_ROLE_COUNT * TROPHIC_ROLE_COUNT}];

uniform vec3 uSchoolCenters[50];

uniform vec3 uScatterOrigin;
uniform float uScatterRadius;
uniform vec3 uCameraRight;

uniform sampler2D textureTraits;

vec3 safeNormalize(vec3 v) {
  float l = length(v);
  return l > 1e-6 ? v / l : vec3(0.0, 0.0, 1.0);
}

void main() {
  vec2 uv = gl_FragCoord.xy / resolution.xy;
  int fishIdx = int(gl_FragCoord.y) * int(resolution.x) + int(gl_FragCoord.x);
  vec4 posData = texture2D(texturePosition, uv);
  vec3 pos = posData.xyz;
  if (pos.x > 9000.0) { gl_FragColor = vec4(0.0); return; }

  vec4 velData = texture2D(textureVelocity, uv);
  vec3 vel = velData.xyz;
  vec3 forward = safeNormalize(vel);

  vec4 traitsData = texture2D(textureTraits, uv);
  float boldness = traitsData.z;

  vec4 stateData = texture2D(textureState, uv);
  float currentState = stateData.x;
  float stateTimer = stateData.y;

  int mySpecies = int(floor(posData.w));
  int myTrophic = uTrophicRole[mySpecies];

  float newState = currentState;
  float newTimer = max(0.0, stateTimer - uDelta);
  float threatDirX = stateData.z;
  float threatDirZ = stateData.w;

  if (newTimer <= 0.0 && currentState != 0.0) {
    newState = 0.0;
  }

  float rayDist = distance(pos, uScatterOrigin);
  if (rayDist < uScatterRadius && uScatterOrigin.y > -900.0) {
    vec3 awayFromRay = safeNormalize(pos - uScatterOrigin);
    float lateralSign = sign(dot(awayFromRay, uCameraRight));
    if (abs(lateralSign) < 0.01) lateralSign = 1.0;
    vec3 lateralDir = uCameraRight * lateralSign;
    vec3 biasedFlee = safeNormalize(awayFromRay * 0.4 + lateralDir * 0.6);
    threatDirX = biasedFlee.x;
    threatDirZ = biasedFlee.z;
    newState = 1.0;
    if (currentState < 0.5 || newTimer < 1.0) {
      newTimer = 5.0 + boldness * 2.0;
    }
  }

  float panicAccum = 0.0;
  vec3 cascadeDirAccum = vec3(0.0);

  for (float ny = 0.0; ny < resolution.y; ny += 1.0) {
    for (float nx = 0.0; nx < resolution.x; nx += 1.0) {
      vec2 ref = (vec2(nx, ny) + 0.5) / resolution.xy;
      vec4 nPos = texture2D(texturePosition, ref);
      vec3 op = nPos.xyz;
      if (op.x > 9000.0) continue;

      vec3 toNeighbor = op - pos;
      float d = length(toNeighbor);
      if (d < 0.001) continue;

      float facing = dot(forward, safeNormalize(toNeighbor));
      if (facing < uPerceptionCos) continue;

      int neighborSpecies = int(floor(nPos.w));
      int neighborTrophic = uTrophicRole[neighborSpecies];

      if (d < uFleeRange && uThreatMatrix[myTrophic * 6 + neighborTrophic] > 0.5) {
        newState = 1.0;
        newTimer = 3.0;
        vec3 away = safeNormalize(pos - op);
        threatDirX = away.x;
        threatDirZ = away.z;
      }

      if (d < uHuntRange && facing > 0.7 && uHuntMatrix[myTrophic * 6 + neighborTrophic] > 0.5) {
        newState = 2.0;
        newTimer = 5.0;
        vec3 toward = safeNormalize(op - pos);
        threatDirX = toward.x;
        threatDirZ = toward.z;
      }

      if (mySpecies == neighborSpecies && d < uPanicRadius) {
        vec4 neighborState = texture2D(textureState, ref);
        if (neighborState.x > 0.5 && neighborState.x < 1.5) {
          float panicWeight = (1.0 - d / uPanicRadius);
          panicWeight *= panicWeight;
          panicWeight *= (1.0 - boldness * 0.5);

          panicAccum += panicWeight;

          vec3 neighborFleeDir = vec3(neighborState.z, 0.0, neighborState.w);
          vec3 awayFromNeighbor = safeNormalize(pos - op);
          vec3 cascadeDir = safeNormalize(neighborFleeDir * 0.5 + awayFromNeighbor * 0.5);
          cascadeDirAccum += cascadeDir * panicWeight;
        }

        vec3 neighborVel = texture2D(textureVelocity, ref).xyz;
        float neighborSpeed = length(neighborVel);
        float neighborTraits_w = texture2D(textureVelocity, ref).w;
        float normalSpeed = neighborTraits_w * 2.0;
        if (neighborSpeed > normalSpeed * 2.5 && d < uPanicRadius * 0.6) {
          float sprintWeight = 0.3 * (1.0 - d / (uPanicRadius * 0.6));
          panicAccum += sprintWeight;
          cascadeDirAccum += safeNormalize(pos - op) * sprintWeight;
        }
      }

      if (myTrophic == 4 && neighborSpecies != mySpecies && d < uHomeRadius) {
        newState = 6.0;
        newTimer = 2.0;
        vec3 toward = safeNormalize(op - pos);
        threatDirX = toward.x;
        threatDirZ = toward.z;
      }
    }
  }

  if (panicAccum > 0.3 && newState < 0.5) {
    float threshold = fract(sin(float(fishIdx) * 12.9898 + uTime * 0.37) * 43758.5453);
    float catchChance = clamp(panicAccum, 0.0, 1.0);
    if (threshold < catchChance) {
      newState = 1.0;
      newTimer = 4.0 + boldness * 1.5;
      vec3 cascadeDir = safeNormalize(cascadeDirAccum);
      threatDirX = cascadeDir.x;
      threatDirZ = cascadeDir.z;
    }
  }

  gl_FragColor = vec4(newState, newTimer, threatDirX, threatDirZ);
}
`;
