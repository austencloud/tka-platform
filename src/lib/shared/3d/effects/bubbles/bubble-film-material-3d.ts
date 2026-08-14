import { DoubleSide, NormalBlending, ShaderMaterial, Vector4 } from "three";

const vertexShader = /* glsl */ `
  attribute vec3 aCenter;
  attribute vec3 aScale;
  attribute vec3 aColor;
  attribute float aAlpha;
  attribute vec3 aFilm;
  attribute vec4 aDynamics;
  attribute vec3 aRupture;

  uniform float uTime;

  varying vec3 vColor;
  varying vec3 vViewDirection;
  varying vec3 vNormalReciprocal;
  varying vec2 vSurfacePosition;
  varying float vAlpha;
  varying float vFilmSeed;
  varying float vFilmStrength;
  varying float vFilmLife;
  varying float vScreenRadius;
  varying vec2 vDeformationDirection;
  varying vec3 vDeformationScales;
  varying vec3 vRupture;

  void main() {
    vec3 safeScale = max(aScale, vec3(0.0001));
    vec3 parentScale = vec3(
      length(modelViewMatrix[0].xyz),
      length(modelViewMatrix[1].xyz),
      length(modelViewMatrix[2].xyz)
    );
    vec3 viewScale = safeScale * max(parentScale, vec3(0.0001));
    vec2 surfacePosition = position.xy;
    vec3 viewMotion = mat3(modelViewMatrix) * aDynamics.xyz;
    vec2 projectedMotion = viewMotion.xy;
    float projectedMotionLength = length(projectedMotion);
    vec2 deformationDirection = projectedMotionLength > 0.0001
      ? projectedMotion / projectedMotionLength
      : vec2(cos(aFilm.x * 6.2831853), sin(aFilm.x * 6.2831853));
    float deformation = clamp(aDynamics.w, -0.035, 0.18);
    float majorScale = 1.0 + deformation;
    float crossScale = inversesqrt(majorScale);

    #ifdef BUBBLE_FRAGMENT
      float spin = aFilm.x * 6.2831853 + uTime * (2.2 + aFilm.x * 1.8);
      float spinSin = sin(spin);
      float spinCos = cos(spin);
      surfacePosition = mat2(spinCos, -spinSin, spinSin, spinCos) * surfacePosition;
    #else
      vec2 minorDirection = vec2(-deformationDirection.y, deformationDirection.x);
      surfacePosition =
        deformationDirection * position.x * majorScale +
        minorDirection * position.y * crossScale;
    #endif

    vec4 centerView = modelViewMatrix * vec4(aCenter, 1.0);
    vec4 viewPosition = centerView;
    viewPosition.xy += surfacePosition * viewScale.xy;

    vColor = aColor;
    vViewDirection = normalize(-viewPosition.xyz);
    vNormalReciprocal = 1.0 / viewScale;
    vSurfacePosition = position.xy;
    vAlpha = aAlpha;
    vFilmSeed = aFilm.x;
    vFilmStrength = aFilm.y;
    vFilmLife = aFilm.z;
    vDeformationDirection = deformationDirection;
    vDeformationScales = vec3(majorScale, crossScale, crossScale);
    vRupture = aRupture;
    vScreenRadius = abs(
      projectionMatrix[0][0] * viewScale.x / max(-centerView.z, 0.001)
    ) * 0.5;
    gl_Position = projectionMatrix * viewPosition;
  }
`;

const fragmentShader = /* glsl */ `
  precision highp float;

  uniform float uTime;
  uniform sampler2D uSceneColor;
  uniform sampler2D uSceneDepth;
  uniform vec4 uViewport;
  uniform float uSceneColorReady;
  uniform float uSceneDepthReady;
  uniform float uSceneColorIsSrgb;
  uniform float uCameraNear;
  uniform float uCameraFar;
  uniform float uOpticalQuality;

  varying vec3 vColor;
  varying vec3 vViewDirection;
  varying vec3 vNormalReciprocal;
  varying vec2 vSurfacePosition;
  varying float vAlpha;
  varying float vFilmSeed;
  varying float vFilmStrength;
  varying float vFilmLife;
  varying float vScreenRadius;
  varying vec2 vDeformationDirection;
  varying vec3 vDeformationScales;
  varying vec3 vRupture;

  vec3 srgbToLinear(vec3 value) {
    vec3 low = value / 12.92;
    vec3 high = pow((value + 0.055) / 1.055, vec3(2.4));
    vec3 lowMask = 1.0 - step(vec3(0.04045), value);
    return mix(high, low, lowMask);
  }

  vec3 sampleSceneColor(vec2 uv) {
    vec3 color = texture2D(uSceneColor, clamp(uv, 0.001, 0.999)).rgb;
    return mix(color, srgbToLinear(color), uSceneColorIsSrgb);
  }

  float viewZFromPerspectiveDepth(float depth) {
    return (uCameraNear * uCameraFar) /
      ((uCameraFar - uCameraNear) * depth - uCameraFar);
  }

  void main() {
    vec3 viewDirection = normalize(vViewDirection);
    vec3 normal;
    float ruptureHole = 0.0;
    float ruptureRim = 0.0;

    #ifdef BUBBLE_SHELL
      float radialDistance = dot(vSurfacePosition, vSurfacePosition);
      if (radialDistance > 1.0) discard;
      float surfaceDepth = sqrt(max(1.0 - radialDistance, 0.0));
      vec2 majorDirection = normalize(vDeformationDirection);
      vec2 minorDirection = vec2(-majorDirection.y, majorDirection.x);
      vec2 normalPlane =
        majorDirection * (vSurfacePosition.x / vDeformationScales.x) +
        minorDirection * (vSurfacePosition.y / vDeformationScales.y);
      normal = normalize(vec3(
        normalPlane,
        surfaceDepth / vDeformationScales.z
      ) * vNormalReciprocal);

      float ruptureDistance = distance(vSurfacePosition, vRupture.xy);
      float ruptureRadius = 0.018 + vRupture.z * 2.18;
      float ruptureEnabled = step(0.0001, vRupture.z);
      ruptureHole = ruptureEnabled * (
        1.0 - smoothstep(
          ruptureRadius - 0.035,
          ruptureRadius + 0.022,
          ruptureDistance
        )
      );
      ruptureRim = ruptureEnabled * (
        smoothstep(ruptureRadius - 0.075, ruptureRadius - 0.018, ruptureDistance) -
        smoothstep(ruptureRadius + 0.012, ruptureRadius + 0.085, ruptureDistance)
      );
      if (ruptureHole > 0.995) discard;
    #else
      normal = vec3(0.0, 0.0, 1.0);
    #endif

    float facing = clamp(abs(dot(normal, viewDirection)), 0.0, 1.0);
    float grazing = pow(1.0 - facing, 2.15);
    float fresnel = 0.02 + 0.98 * pow(1.0 - facing, 5.0);

    float filmRotation =
      vFilmSeed * 6.2831853 + uTime * (0.045 + vFilmSeed * 0.025);
    float filmSin = sin(filmRotation);
    float filmCos = cos(filmRotation);
    vec2 filmPosition = mat2(
      filmCos,
      -filmSin,
      filmSin,
      filmCos
    ) * vSurfacePosition;
    filmPosition.y -= uTime * 0.035 + vFilmLife * 0.16;

    // The broad field drains with gravity while coherent eddies carry local
    // thickness sideways. Near the end of life, a clear zone advances down
    // from the top before the local rupture opens.
    float flowA = sin(
      filmPosition.x * 4.7 +
      filmPosition.y * 2.6 +
      vFilmSeed * 6.2831853 +
      uTime * 0.28
    );
    float flowB = sin(
      -filmPosition.x * 2.1 +
      filmPosition.y * 5.3 +
      vFilmSeed * 11.7 -
      uTime * 0.19
    );
    float eddy = 0.5 + flowA * 0.25 + flowB * 0.25;
    float gravityDrainage = exp(clamp(
      -0.72 * (vSurfacePosition.y + 0.24) * (0.35 + vFilmLife * 0.65),
      -1.15,
      0.72
    ));
    float preRupture = smoothstep(0.72, 1.0, vFilmLife);
    float drainFront = mix(1.08, -0.22, preRupture);
    float drainedTop = smoothstep(
      drainFront - 0.08,
      drainFront + 0.08,
      vSurfacePosition.y
    );
    float drainedEdge =
      (1.0 - smoothstep(0.0, 0.095, abs(vSurfacePosition.y - drainFront))) *
      preRupture;
    float thicknessMix = clamp(
      (0.09 + eddy * 0.56 + gravityDrainage * 0.22) *
        mix(1.0, 0.34, drainedTop) +
        ruptureRim * 0.18,
      0.0,
      1.0
    );
    float thicknessNm = mix(180.0, 720.0, thicknessMix);

    // Three wavelength samples use the physical thin-film optical path. The
    // palette still art-directs the result, but view angle and film thickness
    // now decide which colors reinforce instead of a generic RGB spinner.
    float filmIor = 1.34;
    float sinThetaSquared = max(0.0, 1.0 - facing * facing);
    float cosFilm = sqrt(max(0.0, 1.0 - sinThetaSquared / (filmIor * filmIor)));
    vec3 wavelengthsNm = vec3(650.0, 510.0, 475.0);
    vec3 opticalPhase =
      12.5663706 * filmIor * thicknessNm * cosFilm / wavelengthsNm;
    vec3 interference = 0.5 - 0.5 * cos(opticalPhase);
    float interferenceFloor = min(
      interference.r,
      min(interference.g, interference.b)
    );
    vec3 separatedSpectrum = clamp(
      (interference - interferenceFloor * 0.48) * 1.28,
      0.0,
      1.0
    );
    vec3 filmColor = mix(
      vColor,
      separatedSpectrum,
      0.48 + vFilmStrength * 0.42
    );

    vec3 keyDirection = normalize(vec3(-0.48, 0.62, 0.62));
    vec3 bounceDirection = normalize(vec3(0.42, -0.5, 0.76));
    float keyReflection = pow(
      max(dot(reflect(-keyDirection, normal), viewDirection), 0.0),
      84.0
    );
    float bounceReflection = pow(
      max(dot(reflect(-bounceDirection, normal), viewDirection), 0.0),
      20.0
    );

    #ifdef BUBBLE_SHELL
      vec2 screenUv = (gl_FragCoord.xy - uViewport.xy) / uViewport.zw;
      float distortionScale = vScreenRadius * (
        0.038 + grazing * 0.032
      ) * (0.8 + vFilmStrength * 0.2) * mix(0.62, 1.0, uOpticalQuality);
      vec2 distortion = normal.xy * distortionScale;
      float dispersion =
        (0.055 + vFilmStrength * 0.025) * uOpticalQuality;
      vec3 centerScene = sampleSceneColor(screenUv);
      vec3 refractedScene = vec3(
        sampleSceneColor(screenUv - distortion * (1.0 + dispersion)).r,
        sampleSceneColor(screenUv - distortion).g,
        sampleSceneColor(screenUv - distortion * (1.0 - dispersion)).b
      );

      float depthAwareRefraction = 1.0;
      if (uSceneDepthReady > 0.5) {
        float centerDepth = texture2D(uSceneDepth, screenUv).x;
        float displacedDepth = texture2D(
          uSceneDepth,
          clamp(screenUv - distortion, 0.001, 0.999)
        ).x;
        float bubbleViewZ = viewZFromPerspectiveDepth(gl_FragCoord.z);
        float centerViewZ = viewZFromPerspectiveDepth(centerDepth);
        float displacedViewZ = viewZFromPerspectiveDepth(displacedDepth);
        float contactDistance = max(0.0, bubbleViewZ - centerViewZ);
        float foregroundDistance = max(0.0, displacedViewZ - bubbleViewZ);
        float contactFade = smoothstep(0.018, 0.22, contactDistance);
        float foregroundProtection = 1.0 - smoothstep(
          0.012,
          0.18,
          foregroundDistance
        );
        depthAwareRefraction = mix(
          1.0,
          contactFade * foregroundProtection,
          uSceneDepthReady
        );
      }
      refractedScene = mix(centerScene, refractedScene, depthAwareRefraction);
      vec3 sceneColor = mix(vColor * 0.12, refractedScene, uSceneColorReady);
      filmColor = mix(
        filmColor,
        centerScene * (0.82 + grazing * 0.28),
        grazing * 0.1 * uSceneColorReady * uOpticalQuality
      );
      float reflectionMix = clamp(
        fresnel * (0.72 + vFilmStrength * 0.16) + grazing * 0.18,
        0.0,
        0.94
      );
      vec3 surfaceColor = mix(sceneColor, filmColor * 1.16, reflectionMix);
      surfaceColor += vec3(1.0) * keyReflection * 1.05;
      surfaceColor += mix(vColor, vec3(1.0), 0.42) * bounceReflection * 0.19;
      surfaceColor *= 1.0 - drainedTop * 0.07;
      surfaceColor += filmColor * drainedEdge * 0.16;
      surfaceColor += mix(filmColor, vec3(1.0), 0.68) * ruptureRim * 1.08;

      float refractionCoverage =
        uSceneColorReady *
        (0.075 + grazing * 0.045) *
        mix(0.72, 1.0, depthAwareRefraction);
      float filmCoverage =
        refractionCoverage +
        grazing * (0.48 + vFilmStrength * 0.11) +
        fresnel * 0.24 +
        keyReflection * 0.88 +
        bounceReflection * 0.12 +
        drainedEdge * 0.18 +
        ruptureRim * 0.92;
      filmCoverage *= 1.0 - drainedTop * 0.3;
      float alpha = vAlpha * clamp(filmCoverage, 0.0, 0.9);
      if (alpha < 0.004) discard;
      gl_FragColor = vec4(surfaceColor, alpha);
    #else
      float shardEdge = smoothstep(1.0, 0.18, abs(vSurfacePosition.y));
      vec3 surfaceColor = mix(vColor, filmColor, 0.72) * (0.72 + grazing * 0.5);
      surfaceColor += vec3(1.0) * keyReflection * 0.58;
      float alpha = vAlpha * shardEdge * (0.32 + fresnel * 0.5);
      if (alpha < 0.004) discard;
      gl_FragColor = vec4(surfaceColor, alpha);
    #endif

    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export function createBubbleFilmMaterial3D(
  surface: "shell" | "fragment" = "shell"
): ShaderMaterial {
  const material = new ShaderMaterial({
    defines: {
      [surface === "shell" ? "BUBBLE_SHELL" : "BUBBLE_FRAGMENT"]: "",
    },
    uniforms: {
      uTime: { value: 0 },
      uSceneColor: { value: null },
      uSceneDepth: { value: null },
      uViewport: { value: new Vector4(0, 0, 1, 1) },
      uSceneColorReady: { value: 0 },
      uSceneDepthReady: { value: 0 },
      uSceneColorIsSrgb: { value: 0 },
      uCameraNear: { value: 0.1 },
      uCameraFar: { value: 1000 },
      uOpticalQuality: { value: 1 },
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
  // The shell is an analytic camera-facing surface, so a second back-face
  // pass would only redraw the same film and double its opacity.
  material.forceSinglePass = true;
  return material;
}
