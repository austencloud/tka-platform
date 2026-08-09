import {
  AdditiveBlending,
  DoubleSide,
  NormalBlending,
  ShaderMaterial,
} from "three";

const vertexShader = /* glsl */ `
  attribute vec3 bodyColor;
  attribute vec3 edgeColor;
  attribute float alpha;
  attribute float ribbonEdge;
  attribute float progress;
  attribute float emissive;

  varying vec3 vBodyColor;
  varying vec3 vEdgeColor;
  varying vec3 vViewNormal;
  varying vec3 vViewDirection;
  varying float vAlpha;
  varying float vRibbonEdge;
  varying float vProgress;
  varying float vEmissive;

  void main() {
    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
    vBodyColor = bodyColor;
    vEdgeColor = edgeColor;
    vViewNormal = normalize(normalMatrix * normal);
    vViewDirection = normalize(-viewPosition.xyz);
    vAlpha = alpha;
    vRibbonEdge = ribbonEdge;
    vProgress = progress;
    vEmissive = emissive;
    gl_Position = projectionMatrix * viewPosition;
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uGlintPass;

  varying vec3 vBodyColor;
  varying vec3 vEdgeColor;
  varying vec3 vViewNormal;
  varying vec3 vViewDirection;
  varying float vAlpha;
  varying float vRibbonEdge;
  varying float vProgress;
  varying float vEmissive;

  void main() {
    float across = abs(vRibbonEdge);
    float selvedge = smoothstep(0.68, 0.98, across);
    float facing = abs(dot(normalize(vViewNormal), normalize(vViewDirection)));
    float grazingSheen = pow(1.0 - facing, 2.2);
    float longitudinalThreads = 0.94 + 0.06 * sin(vProgress * 48.0 + across * 9.0);
    vec3 fabricColor = mix(vBodyColor, vEdgeColor, selvedge);

    if (uGlintPass > 0.5) {
      float glint = selvedge * 0.72 + grazingSheen * 0.34;
      vec3 glintColor = mix(vEdgeColor, vec3(1.0), 0.32);
      float glintAlpha = vAlpha * glint * (0.22 + vEmissive * 0.24);
      if (glintAlpha < 0.002) discard;
      gl_FragColor = vec4(glintColor * (1.0 + vEmissive * 0.8), glintAlpha);
      return;
    }

    float satinSheen = 0.82 + grazingSheen * 0.38 + facing * 0.12;
    vec3 finalColor = fabricColor * longitudinalThreads * satinSheen;
    finalColor *= 1.0 + vEmissive * 0.52;
    float finalAlpha = vAlpha * (0.58 + facing * 0.24 + selvedge * 0.16);
    if (finalAlpha < 0.002) discard;
    gl_FragColor = vec4(finalColor, finalAlpha);
  }
`;

export function createSilkRibbonMaterial3D(glint: boolean): ShaderMaterial {
  const material = new ShaderMaterial({
    uniforms: {
      uGlintPass: { value: glint ? 1 : 0 },
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    blending: glint ? AdditiveBlending : NormalBlending,
  });
  material.forceSinglePass = true;
  return material;
}
