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

  // NaN/Inf firewall — uses arithmetic checks to avoid HLSL X3577 warning
  if (vel != vel || any(greaterThan(abs(vel), vec3(1e38)))) vel = vec3(0.0);
  posData.xyz += vel * uDelta;

  if (posData.xyz != posData.xyz || any(greaterThan(abs(posData.xyz), vec3(1e38)))) {
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
