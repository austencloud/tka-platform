const TROPHIC_ROLE_COUNT = 6;

export const stateShader = /* glsl */ `
uniform float uDelta;
uniform float uTime;
uniform float uFleeRange;
uniform float uHuntRange;
uniform float uPanicRadius;
uniform float uHomeRadius;
uniform float uPerceptionCos;
uniform sampler2D tTraits;

uniform int uTrophicRole[50];

uniform float uThreatMatrix[${TROPHIC_ROLE_COUNT * TROPHIC_ROLE_COUNT}];
uniform float uHuntMatrix[${TROPHIC_ROLE_COUNT * TROPHIC_ROLE_COUNT}];

uniform vec3 uSchoolCenters[50];

uniform vec3 uScatterOrigin;
uniform float uScatterRadius;

void main() {
  vec2 uv = gl_FragCoord.xy / resolution.xy;
  vec4 posData = texture2D(texturePosition, uv);
  vec3 pos = posData.xyz;
  if (pos.x > 9000.0) { gl_FragColor = vec4(0.0); return; }

  vec4 velData = texture2D(textureVelocity, uv);
  vec3 vel = velData.xyz;
  vec3 forward = length(vel) > 0.001 ? normalize(vel) : vec3(0.0, 0.0, 1.0);

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
  if (rayDist < uScatterRadius && myTrophic != 0 && myTrophic != 5) {
    newState = 1.0;
    newTimer = 2.0;
    vec3 awayFromRay = normalize(pos - uScatterOrigin);
    threatDirX = awayFromRay.x;
    threatDirZ = awayFromRay.z;
  }

  for (float ny = 0.0; ny < resolution.y; ny += 1.0) {
    for (float nx = 0.0; nx < resolution.x; nx += 1.0) {
      vec2 ref = (vec2(nx, ny) + 0.5) / resolution.xy;
      vec4 nPos = texture2D(texturePosition, ref);
      vec3 op = nPos.xyz;
      if (op.x > 9000.0) continue;

      vec3 toNeighbor = op - pos;
      float d = length(toNeighbor);
      if (d < 0.001) continue;

      float facing = dot(forward, normalize(toNeighbor));
      if (facing < uPerceptionCos) continue;

      int neighborSpecies = int(floor(nPos.w));
      int neighborTrophic = uTrophicRole[neighborSpecies];

      if (d < uFleeRange && uThreatMatrix[myTrophic * 6 + neighborTrophic] > 0.5) {
        newState = 1.0;
        newTimer = 3.0;
        vec3 away = normalize(pos - op);
        threatDirX = away.x;
        threatDirZ = away.z;
      }

      if (d < uHuntRange && facing > 0.7 && uHuntMatrix[myTrophic * 6 + neighborTrophic] > 0.5) {
        newState = 2.0;
        newTimer = 5.0;
        vec3 toward = normalize(op - pos);
        threatDirX = toward.x;
        threatDirZ = toward.z;
      }

      if (mySpecies == neighborSpecies && d < uPanicRadius) {
        vec4 neighborState = texture2D(textureState, ref);
        if (neighborState.x > 0.5 && neighborState.x < 1.5) {
          newState = 1.0;
          newTimer = 2.0;
          threatDirX = neighborState.z;
          threatDirZ = neighborState.w;
        }
      }

      if (myTrophic == 4 && neighborSpecies != mySpecies && d < uHomeRadius) {
        newState = 6.0;
        newTimer = 2.0;
        vec3 toward = normalize(op - pos);
        threatDirX = toward.x;
        threatDirZ = toward.z;
      }
    }
  }

  gl_FragColor = vec4(newState, newTimer, threatDirX, threatDirZ);
}
`;
