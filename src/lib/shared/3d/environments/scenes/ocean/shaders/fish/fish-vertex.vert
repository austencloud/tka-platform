attribute vec2 aReference;

uniform sampler2D tPosition;
uniform sampler2D tVelocity;
uniform sampler2D tState;
uniform float uSize;
uniform float uTime;
uniform float uMaxSpeed;
// Rigid world-space placement of the whole school. The boids simulate around
// their own origin; this moves that origin. Zero for the ocean stage.
uniform vec3 uWorldOffset;

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

vec3 safeNormalize(vec3 v) {
  float l = length(v);
  return l > 1e-6 ? v / l : vec3(0.0, 0.0, 1.0);
}

vec2 safeNormalize2(vec2 v) {
  float l = length(v);
  return l > 1e-6 ? v / l : vec2(0.0, 1.0);
}

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

  vec4 stateInfo = texture2D(tState, aReference);
  float isFleeing = smoothstep(0.5, 1.0, stateInfo.x);
  float fleeTimeLeft = stateInfo.y;
  float panicLevel = isFleeing * smoothstep(0.0, 2.0, fleeTimeLeft);

  float envelope = pow(max(spineMask, 0.001), uAmpExponent);
  float stiffMask = mix(1.0, envelope, uStiffness);
  float panicAmpBoost = 1.0 + panicLevel * 0.4;
  float bodyAmp = uBaseAmplitude * stiffMask * max(speedRatio, 0.15) * panicAmpBoost;

  localPos.x += sin(phase) * bodyAmp;
  localPos.x += sin(uTime * freq * 0.5) * uStrideAmp;
  localPos.z += sin(phase) * uRollAmp * spineMask;

  float pecPhase = uTime * uPectoralFreq + perInstanceJitter * 3.0;
  localPos.y += sin(pecPhase) * uPectoralAmp * dorsalMask;

  localPos.y += sin(phase * 1.5) * bodyAmp * 0.3 * dorsalMask;

  float swimSpeed = length(fishVel);
  float cStartRatio = swimSpeed / (uMaxSpeed * 0.5);
  float cStartIntensity = smoothstep(1.5, 2.5, cStartRatio);
  float panicCBend = 1.0 + panicLevel * 0.8;
  float cBend = cStartIntensity * sin(localPos.z * 1.5) * 0.3 * panicCBend;
  localPos.x += cBend;

  vec3 transformed = rot * (localPos * fishScale) + fishPos + uWorldOffset;
  vWorldPos = transformed;
  vNormal = safeNormalize(rot * normal);

  gl_Position = projectionMatrix * viewMatrix * vec4(transformed, 1.0);
}
