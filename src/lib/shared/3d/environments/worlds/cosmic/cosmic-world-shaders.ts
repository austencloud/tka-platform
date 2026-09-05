export const COSMIC_SKY_VERTEX_SHADER = /* glsl */ `
  varying vec3 vSkyDirection;
  void main() {
    vSkyDirection = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const COSMIC_SKY_FRAGMENT_SHADER = /* glsl */ `
  uniform vec3 uTopColor;
  uniform vec3 uMidColor;
  uniform vec3 uBottomColor;
  uniform float uHasMid;
  uniform float uGradientStart;
  uniform float uGradientEnd;
  uniform float uMoonEnabled;
  uniform sampler2D uMoonTexture;
  uniform vec3 uMoonDirection;
  uniform float uMoonAngularRadius;
  uniform float uMoonOpacity;
  uniform float uMoonGlowScale;
  uniform float uMoonGlowOpacity;
  uniform float uMoonSurfaceLift;
  uniform float uMoonHorizonWarmth;
  uniform float uSunEnabled;
  uniform vec3 uSunDirection;
  uniform float uSunAngularRadius;
  uniform vec3 uSunColor;
  uniform float uSunOpacity;
  uniform float uSunGlowScale;
  uniform float uSunGlowOpacity;
  uniform vec3 uHorizonGlowColor;
  uniform vec2 uHorizonGlowBearing;
  uniform float uHorizonGlowHeight;
  uniform float uHorizonGlowSpread;
  uniform float uHorizonGlowIntensity;
  varying vec3 vSkyDirection;

  void main() {
    vec3 skyDirection = normalize(vSkyDirection);
    float rawHeight = skyDirection.y * 0.5 + 0.5;
    float h = clamp(
      (rawHeight - uGradientStart) / max(uGradientEnd - uGradientStart, 0.0001),
      0.0,
      1.0
    );

    vec3 color;
    if (uHasMid > 0.5) {
      if (h < 0.5) {
        color = mix(uBottomColor, uMidColor, h * 2.0);
      } else {
        color = mix(uMidColor, uTopColor, (h - 0.5) * 2.0);
      }
    } else {
      color = mix(uBottomColor, uTopColor, h);
    }

    if (uHorizonGlowIntensity > 0.0) {
      float elevation = skyDirection.y;
      float vertical = exp(
        -max(elevation, 0.0) / max(uHorizonGlowHeight, 0.0001)
      );
      vertical *= smoothstep(-0.22, 0.02, elevation);
      vec2 flatDirection = vec2(skyDirection.x, skyDirection.z);
      float flatLength = length(flatDirection);
      float bearing = flatLength > 0.0001
        ? dot(flatDirection / flatLength, uHorizonGlowBearing) * 0.5 + 0.5
        : 0.5;
      float lateral = pow(
        clamp(bearing, 0.0, 1.0),
        mix(14.0, 1.0, clamp(uHorizonGlowSpread, 0.0, 1.0))
      );
      color += uHorizonGlowColor
        * vertical
        * lateral
        * uHorizonGlowIntensity;
    }

    if (uSunEnabled > 0.5) {
      float sunAngle = acos(clamp(
        dot(skyDirection, normalize(uSunDirection)),
        -1.0,
        1.0
      ));
      float sunRadius = max(uSunAngularRadius, 0.00001);
      float diskDistance = sunAngle / sunRadius;
      float disk = 1.0 - smoothstep(0.82, 1.0, diskDistance);
      float haloRadius = max(uSunGlowScale, 1.001);
      float halo = 1.0 - smoothstep(1.0, haloRadius, diskDistance);
      halo = pow(max(halo, 0.0), 2.2) * (1.0 - disk);
      color += uSunColor * halo * uSunGlowOpacity;
      color = mix(color, uSunColor, disk * uSunOpacity);
    }

    if (uMoonEnabled > 0.5) {
      vec3 moonDirection = normalize(uMoonDirection);
      float moonFrontHemisphere = step(
        0.0,
        dot(skyDirection, moonDirection)
      );
      vec3 referenceUp = abs(moonDirection.y) > 0.98
        ? vec3(1.0, 0.0, 0.0)
        : vec3(0.0, 1.0, 0.0);
      vec3 moonRight = normalize(cross(referenceUp, moonDirection));
      vec3 moonUp = normalize(cross(moonDirection, moonRight));
      float angularScale = max(sin(uMoonAngularRadius), 0.00001);
      vec2 moonPlane = vec2(
        dot(skyDirection, moonRight),
        dot(skyDirection, moonUp)
      ) / angularScale;
      float radialDistance = length(moonPlane);
      vec2 moonUv = moonPlane * vec2(0.5, -0.5) + 0.5;

      vec4 moonSample = texture2D(uMoonTexture, moonUv);
      float diskEdge = 1.0 - smoothstep(0.965, 1.0, radialDistance);
      float diskAlpha = moonSample.a
        * diskEdge
        * uMoonOpacity
        * moonFrontHemisphere;
      float elevation = clamp(moonDirection.y, 0.0, 1.0);
      float atmospherePath = smoothstep(0.0, 0.42, elevation);
      float transmittance = mix(0.82, 1.0, atmospherePath);
      vec3 horizonTint = mix(
        vec3(0.94, 0.97, 1.0),
        vec3(1.0, 0.67, 0.42),
        uMoonHorizonWarmth
      );
      vec3 atmosphericTint = mix(
        horizonTint,
        vec3(0.92, 0.96, 1.0),
        atmospherePath
      );
      vec3 moonSurface = pow(max(moonSample.rgb, vec3(0.0)), vec3(0.72));
      moonSurface = mix(moonSurface, vec3(1.0), uMoonSurfaceLift);
      vec3 moonColor = moonSurface * atmosphericTint * transmittance;

      float haloRadius = max(uMoonGlowScale, 1.001);
      float halo = 1.0 - smoothstep(1.0, haloRadius, radialDistance);
      halo *= (1.0 - diskEdge) * moonFrontHemisphere;
      color += atmosphericTint * halo * uMoonGlowOpacity * transmittance;
      color = mix(color, moonColor, clamp(diskAlpha, 0.0, 1.0));
    }

    gl_FragColor = vec4(color, 1.0);
  }
`;

export const COSMIC_PLATFORM_VERTEX_SHADER = /* glsl */ `
  varying vec3 vPosition;
  varying vec3 vNormal;
  varying vec2 vUv;
  void main() {
    vPosition = position;
    vNormal = normalize(normalMatrix * normal);
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const COSMIC_PLATFORM_FRAGMENT_SHADER = /* glsl */ `
  uniform vec3 uBaseColor;
  uniform vec3 uEmissiveColor;
  uniform float uEmissiveIntensity;
  uniform float uEdgeGlowWidth;
  uniform float uRadius;
  uniform float uHeight;
  uniform float uMetallic;
  uniform float uRoughness;
  uniform float uPulse;
  uniform float uGridDensity;
  uniform float uGridIntensity;

  varying vec3 vPosition;
  varying vec3 vNormal;
  varying vec2 vUv;

  float hexGrid(vec2 p, float scale) {
    vec2 q = vec2(p.x * 2.0 * 0.5773503, p.y + p.x * 0.5773503);
    vec2 pi = floor(q);
    vec2 pf = fract(q);
    float v = mod(pi.x + pi.y, 3.0);
    float ca = step(1.0, v);
    float cb = step(2.0, v);
    vec2 ma = step(pf.xy, pf.yx);
    float e = dot(ma, 1.0 - pf.yx + ca * (pf.x + pf.y - 1.0) + cb * (pf.yx - 2.0 * pf.xy));
    float lineWidth = 0.06;
    return 1.0 - smoothstep(0.0, lineWidth, abs(e - 0.5) * 2.0);
  }

  void main() {
    float distFromCenter = length(vPosition.xz) / uRadius;
    float edgeFactor = smoothstep(1.0 - uEdgeGlowWidth, 1.0, distFromCenter);
    float topFace = step(0.49, vNormal.y);
    float sideFace = 1.0 - abs(vNormal.y);
    float pulse = 1.0 + sin(uPulse) * 0.15;
    float glow = (edgeFactor * topFace + sideFace * 0.6) * uEmissiveIntensity * pulse;
    float grid = 0.0;
    if (uGridDensity > 0.0 && topFace > 0.5) {
      grid = hexGrid(vPosition.xz * uGridDensity, uGridDensity);
      grid *= uGridIntensity * pulse;
      grid *= (1.0 - smoothstep(0.85, 1.0, distFromCenter));
    }
    vec3 base = uBaseColor * (0.3 + uMetallic * 0.7);
    vec3 emissive = uEmissiveColor * (glow + grid);
    gl_FragColor = vec4(base + emissive, 1.0);
  }
`;

export const COSMIC_EARTH_VERTEX_SHADER = /* glsl */ `
  varying vec3 vNormal;
  varying vec2 vUv;
  varying vec3 vViewDir;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vUv = uv;
    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
    vViewDir = normalize(-mvPos.xyz);
    gl_Position = projectionMatrix * mvPos;
  }
`;

export const COSMIC_EARTH_FRAGMENT_SHADER = /* glsl */ `
  uniform sampler2D uEarthMap;
  uniform vec3 uRimColor;
  uniform float uRimIntensity;
  varying vec3 vNormal;
  varying vec2 vUv;
  varying vec3 vViewDir;
  void main() {
    vec4 texColor = texture2D(uEarthMap, vUv);
    float fresnel = 1.0 - dot(vNormal, vViewDir);
    fresnel = pow(fresnel, 3.0);
    vec3 rim = uRimColor * fresnel * uRimIntensity;
    gl_FragColor = vec4(texColor.rgb + rim, 1.0);
  }
`;

export const COSMIC_EARTH_GLOW_VERTEX_SHADER = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vViewDir;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
    vViewDir = normalize(-mvPos.xyz);
    gl_Position = projectionMatrix * mvPos;
  }
`;

export const COSMIC_EARTH_GLOW_FRAGMENT_SHADER = /* glsl */ `
  uniform vec3 uRimColor;
  uniform float uRimIntensity;
  varying vec3 vNormal;
  varying vec3 vViewDir;
  void main() {
    float fresnel = 1.0 - dot(vNormal, vViewDir);
    fresnel = pow(fresnel, 2.0);
    float alpha = fresnel * uRimIntensity;
    gl_FragColor = vec4(uRimColor, alpha);
  }
`;

export const COSMIC_NEBULA_VERTEX_SHADER = /* glsl */ `
  varying vec3 vWorldPosition;
  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPos.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

export const COSMIC_NEBULA_FRAGMENT_SHADER = /* glsl */ `
  uniform vec3 uColor1;
  uniform vec3 uColor2;
  uniform float uOpacity;
  uniform float uScale;
  uniform float uTime;
  varying vec3 vWorldPosition;

  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

  float snoise(vec3 v) {
    const vec2 C = vec2(1.0/6.0, 1.0/3.0);
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
    i = mod289(i);
    vec4 p = permute(permute(permute(
      i.z + vec4(0.0, i1.z, i2.z, 1.0))
      + i.y + vec4(0.0, i1.y, i2.y, 1.0))
      + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n_ = 0.142857142857;
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
    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
  }

  void main() {
    vec3 dir = normalize(vWorldPosition);
    vec3 samplePos = dir * uScale + vec3(uTime * 0.1, 0.0, uTime * 0.05);
    float n1 = snoise(samplePos * 1.5) * 0.5 + 0.5;
    float n2 = snoise(samplePos * 3.0 + 100.0) * 0.5 + 0.5;
    float combined = n1 * 0.7 + n2 * 0.3;
    combined = pow(combined, 1.5);
    vec3 color = mix(uColor1, uColor2, n2);
    float alpha = combined * uOpacity;
    float horizonFade = smoothstep(-0.1, 0.3, dir.y);
    alpha *= horizonFade;
    gl_FragColor = vec4(color, alpha);
  }
`;

export const COSMIC_STARFIELD_VERTEX_SHADER = /* glsl */ `
  attribute float aSize;
  attribute float aPhase;
  attribute float aBrightness;
  uniform float uTime;
  uniform float uTwinkleSpeed;
  uniform float uIntensity;
  varying float vBrightness;
  varying float vTwinkle;
  void main() {
    vBrightness = aBrightness * uIntensity;
    vTwinkle = 0.6 + 0.4 * sin(uTime * uTwinkleSpeed + aPhase);
    mat4 rotationalView = mat4(mat3(viewMatrix));
    vec4 mvPos = rotationalView * vec4(position, 1.0);
    gl_PointSize = aSize * vTwinkle * (600.0 / -mvPos.z);
    gl_Position = projectionMatrix * mvPos;
  }
`;

export const COSMIC_STARFIELD_FRAGMENT_SHADER = /* glsl */ `
  const vec3 CORE_COLOR = vec3(1.0, 0.97, 0.90);
  const vec3 HALO_COLOR = vec3(0.75, 0.85, 1.0);
  varying float vBrightness;
  varying float vTwinkle;
  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float dist = length(uv);
    float core = 1.0 - smoothstep(0.0, 0.15, dist);
    float halo = 1.0 - smoothstep(0.1, 0.5, dist);
    halo = pow(halo, 2.5);
    if (halo < 0.01) discard;
    vec3 color = mix(HALO_COLOR, CORE_COLOR, core);
    float alpha = (core + halo * 0.6) * vBrightness * vTwinkle;
    gl_FragColor = vec4(color, clamp(alpha, 0.0, 1.0));
  }
`;

export const COSMIC_ENERGY_VERTEX_SHADER = /* glsl */ `
  attribute float aSize;
  attribute float aAlpha;
  attribute float aColorIndex;
  varying float vAlpha;
  varying float vColorIndex;
  void main() {
    vAlpha = aAlpha;
    vColorIndex = aColorIndex;
    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * (1000.0 / -mvPos.z);
    gl_Position = projectionMatrix * mvPos;
  }
`;

export const COSMIC_ENERGY_FRAGMENT_SHADER = /* glsl */ `
  uniform vec3 uColors[4];
  varying float vAlpha;
  varying float vColorIndex;
  void main() {
    float dist = length(gl_PointCoord - 0.5);
    float glow = 1.0 - smoothstep(0.0, 0.5, dist);
    if (glow < 0.01) discard;
    int idx = int(floor(vColorIndex));
    vec3 color = uColors[min(idx, 3)];
    gl_FragColor = vec4(color, glow * vAlpha);
  }
`;

export const COSMIC_METEOR_VERTEX_SHADER = /* glsl */ `
  uniform vec2 uHead;
  uniform vec2 uDirection;
  uniform vec2 uNormal;
  uniform float uTrailLength;
  uniform float uTrailWidth;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    float behindHead = (position.x - 0.5) * uTrailLength;
    vec2 clipPosition = uHead
      + uDirection * behindHead
      + uNormal * position.y * uTrailWidth;
    gl_Position = vec4(clipPosition, 0.9999, 1.0);
  }
`;

export const COSMIC_METEOR_FRAGMENT_SHADER = /* glsl */ `
  uniform vec3 uColor;
  uniform float uBrightness;
  uniform float uOpacity;
  uniform float uTrailLength;
  uniform float uTrailWidth;
  varying vec2 vUv;
  void main() {
    float across = abs(vUv.y - 0.5) * 2.0;
    float halo = exp(-across * across * 7.0);
    float core = exp(-across * across * 105.0);
    float taper = pow(smoothstep(0.0, 1.0, vUv.x), 1.7);
    float tail = taper * (core * 0.88 + halo * 0.12);
    float lengthToWidth = uTrailLength / max(uTrailWidth, 0.0001);
    vec2 fromHead = vec2(
      (vUv.x - 0.965) * lengthToWidth,
      (vUv.y - 0.5) * 2.0
    );
    float headGlow = exp(-dot(fromHead, fromHead) * 2.6);
    float headCore = exp(-dot(fromHead, fromHead) * 22.0);
    float light = tail + headGlow * 0.5 + headCore * 1.25;
    float alpha = min(light, 1.0) * uOpacity;
    if (alpha < 0.002) discard;
    gl_FragColor = vec4(uColor * uBrightness * light, alpha);
  }
`;

export const COSMIC_GOD_RAY_VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const COSMIC_GOD_RAY_FRAGMENT_SHADER = /* glsl */ `
  uniform float uTime;
  uniform vec3 uColor;
  uniform float uIntensity;
  uniform float uCount;
  varying vec2 vUv;
  float hash(float n) { return fract(sin(n) * 43758.5453); }
  void main() {
    float beams = 0.0;
    for (float i = 0.0; i < 8.0; i++) {
      if (i >= uCount) break;
      float offset = hash(i * 127.1) * 0.8 + 0.1;
      float width = 0.02 + hash(i * 311.7) * 0.03;
      float drift = sin(uTime * 0.5 + i * 2.1) * 0.03;
      float beam = smoothstep(width, 0.0, abs(vUv.x - offset - drift));
      beam *= (0.6 + hash(i * 197.3) * 0.4);
      beams += beam;
    }
    float vFade = smoothstep(0.0, 0.25, vUv.y) * smoothstep(1.0, 0.4, vUv.y);
    float noise = fract(sin(dot(vUv * 40.0 + uTime * 0.1, vec2(12.9898, 78.233))) * 43758.5453);
    beams *= (0.85 + noise * 0.15);
    float alpha = beams * vFade * uIntensity;
    gl_FragColor = vec4(uColor * 1.5, alpha);
  }
`;
