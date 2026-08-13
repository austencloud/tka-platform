import { DoubleSide, NormalBlending, ShaderMaterial } from "three";

const vertexShader = /* glsl */ `
  attribute vec3 aCenter;
  attribute vec3 aScale;
  attribute vec3 aColor;
  attribute float aAlpha;
  attribute vec2 aFilm;

  varying vec3 vColor;
  varying vec3 vViewNormal;
  varying vec3 vViewDirection;
  varying float vAlpha;
  varying float vFilmSeed;
  varying float vFilmStrength;

  void main() {
    vec3 safeScale = max(aScale, vec3(0.0001));
    vec3 localPosition = position * safeScale;
    vec3 localNormal = normalize(normal / safeScale);
    vec4 viewPosition = modelViewMatrix * vec4(aCenter + localPosition, 1.0);

    vColor = aColor;
    vViewNormal = normalize(normalMatrix * localNormal);
    vViewDirection = normalize(-viewPosition.xyz);
    vAlpha = aAlpha;
    vFilmSeed = aFilm.x;
    vFilmStrength = aFilm.y;
    gl_Position = projectionMatrix * viewPosition;
  }
`;

const fragmentShader = /* glsl */ `
  precision highp float;

  uniform float uTime;

  varying vec3 vColor;
  varying vec3 vViewNormal;
  varying vec3 vViewDirection;
  varying float vAlpha;
  varying float vFilmSeed;
  varying float vFilmStrength;

  void main() {
    vec3 normal = normalize(vViewNormal);
    if (!gl_FrontFacing) normal = -normal;
    vec3 viewDirection = normalize(vViewDirection);
    float facing = clamp(abs(dot(normal, viewDirection)), 0.0, 1.0);

    // A soap film is almost absent head-on and reflective at the edge. This
    // grazing response is the main silhouette; color supports it rather than
    // replacing it with an opaque outline.
    float fresnel = pow(1.0 - facing, 2.35);

    // Three phase-shifted channels approximate the visible interference sweep.
    // Seed and time move the bands slowly so neighboring bubbles never share a
    // single rainbow ring.
    float opticalPath =
      (1.0 - facing) * (8.0 + vFilmSeed * 5.0) +
      vFilmSeed * 6.2831853 +
      uTime * (0.18 + vFilmSeed * 0.08);
    vec3 interference = 0.5 + 0.5 * cos(
      opticalPath + vec3(0.0, 2.0943951, 4.1887902)
    );
    // Pull the spectrum away from middle gray before compositing it. Small
    // bubbles otherwise lose their phase separation to alpha blending and
    // read as silver dots instead of soap film.
    float spectrumFloor = min(interference.r, min(interference.g, interference.b));
    vec3 separatedSpectrum = clamp(
      (interference - vec3(spectrumFloor * 0.72)) * 1.42,
      0.0,
      1.0
    );
    vec3 seedSpectrum = 0.55 + 0.45 * cos(
      vFilmSeed * 6.2831853 + vec3(0.0, 2.0943951, 4.1887902)
    );
    vec3 filmSpectrum = mix(seedSpectrum, separatedSpectrum, 0.58 + fresnel * 0.2);
    float filmMinimum = min(filmSpectrum.r, min(filmSpectrum.g, filmSpectrum.b));
    float filmMaximum = max(filmSpectrum.r, max(filmSpectrum.g, filmSpectrum.b));
    vec3 normalizedSpectrum = (filmSpectrum - vec3(filmMinimum)) /
      max(filmMaximum - filmMinimum, 0.001);
    filmSpectrum = mix(filmSpectrum, normalizedSpectrum, 0.74);
    interference = mix(vColor, filmSpectrum, 0.72 + vFilmStrength * 0.24);

    // A tight key reflection plus a broad opposing bounce breaks the perfect
    // procedural symmetry and gives the clear center something to describe.
    vec3 keyDirection = normalize(vec3(-0.48, 0.62, 0.62));
    vec3 bounceDirection = normalize(vec3(0.42, -0.5, 0.76));
    float keyReflection = pow(
      max(dot(reflect(-keyDirection, normal), viewDirection), 0.0),
      72.0
    );
    float bounceReflection = pow(
      max(dot(reflect(-bounceDirection, normal), viewDirection), 0.0),
      18.0
    );

    vec3 spectralFilm = mix(vColor, interference, 0.42 + fresnel * 0.5);
    vec3 surfaceColor = mix(vColor, spectralFilm, 0.64 + vFilmStrength * 0.24);
    surfaceColor = mix(
      surfaceColor,
      interference * (1.5 + vFilmStrength * 0.65),
      fresnel * (0.62 + vFilmStrength * 0.18)
    );
    surfaceColor += vec3(1.0) * keyReflection * 1.15;
    surfaceColor += mix(vColor, vec3(1.0), 0.38) * bounceReflection * 0.22;

    float centerFilm = 0.018 + (1.0 - facing) * 0.035;
    float filmCoverage =
      centerFilm +
      fresnel * (0.68 + vFilmStrength * 0.1) +
      keyReflection * 0.92 +
      bounceReflection * 0.16;
    float alpha = vAlpha * clamp(filmCoverage, 0.0, 0.92);
    if (alpha < 0.004) discard;

    gl_FragColor = vec4(surfaceColor, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export function createBubbleFilmMaterial3D(
  surface: "shell" | "fragment" = "shell"
): ShaderMaterial {
  const material = new ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    side: DoubleSide,
    blending: NormalBlending,
    toneMapped: true,
  });
  // Curved shells need Three's front/back transparent passes. Flat film
  // slivers have the same visible surface on both sides and stay single-pass.
  material.forceSinglePass = surface === "fragment";
  return material;
}
