import {
  ShaderMaterial,
  Color,
  DoubleSide,
  AdditiveBlending,
} from "three";

const vertexShader = /* glsl */ `
  attribute float alpha;
  attribute vec3 instanceColor;

  varying float vAlpha;
  varying vec3 vColor;

  void main() {
    vAlpha = alpha;
    vColor = instanceColor;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uOpacity;
  uniform vec3 uBaseColor;
  uniform float uEmissiveStrength;

  varying float vAlpha;
  varying vec3 vColor;

  void main() {
    // Use instance color if provided (rainbow mode), otherwise base color
    vec3 color = length(vColor) > 0.01 ? vColor : uBaseColor;

    // Add emissive glow — brighter at high alpha (near tip)
    vec3 emissive = color * uEmissiveStrength * vAlpha;
    vec3 finalColor = color + emissive;

    float finalAlpha = vAlpha * uOpacity;
    if (finalAlpha < 0.001) discard;

    gl_FragColor = vec4(finalColor, finalAlpha);
  }
`;

export interface TrailMaterialOptions {
  color: string;
  opacity: number;
  emissiveStrength?: number;
  rainbow?: boolean;
}

export function createTrailMaterial(options: TrailMaterialOptions): ShaderMaterial {
  const baseColor = new Color(options.color === "rainbow" ? "#ffffff" : options.color);

  return new ShaderMaterial({
    uniforms: {
      uBaseColor: { value: baseColor },
      uOpacity: { value: options.opacity },
      uEmissiveStrength: { value: options.emissiveStrength ?? 0.5 },
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    blending: AdditiveBlending,
  });
}
