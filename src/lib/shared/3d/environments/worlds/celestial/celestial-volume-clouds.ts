import {
  BoxGeometry,
  Color,
  Data3DTexture,
  GLSL3,
  LinearFilter,
  Mesh,
  RedFormat,
  RepeatWrapping,
  ShaderMaterial,
  Vector3,
} from "three";

/** World-space cloud sea. The surface stays below the islands and camera so
 * ordinary depth testing lets terrain emerge through the moving cloud banks. */
export function createCelestialVolumeClouds(
  worldYOffset: number,
  steps: number
): Mesh {
  const size = 64;
  const data = new Uint8Array(size ** 3);
  let seed = 78451;
  for (let i = 0; i < data.length; i += 1) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    data[i] = seed >>> 24;
  }
  const noise = new Data3DTexture(data, size, size, size);
  noise.format = RedFormat;
  noise.minFilter = noise.magFilter = LinearFilter;
  noise.wrapS = noise.wrapT = noise.wrapR = RepeatWrapping;
  noise.unpackAlignment = 1;
  noise.needsUpdate = true;
  const material = new ShaderMaterial({
    glslVersion: GLSL3,
    transparent: true,
    depthWrite: false,
    uniforms: {
      uNoise: { value: noise },
      uTime: { value: 0 },
      uSteps: { value: steps },
      uBank: { value: 0 },
      uMin: { value: new Vector3(-700, -145 + worldYOffset, -700) },
      uMax: { value: new Vector3(700, -15 + worldYOffset, 700) },
      uLight: { value: new Color("#fff0d6") },
      uShade: { value: new Color("#627fa1") },
    },
    vertexShader: /* glsl */ `
      out vec3 vWorld;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorld = world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp sampler3D;
      uniform sampler3D uNoise;
      uniform float uTime;
      uniform int uSteps;
      uniform float uBank;
      uniform vec3 uMin, uMax, uLight, uShade;
      in vec3 vWorld;
      out vec4 cloudColor;
      #define gl_FragColor cloudColor
      float field(vec3 p) {
        vec3 q = p * 0.035 + vec3(uTime * .003, 0., uTime * .001);
        return texture(uNoise, q / 64.).r * .62
          + texture(uNoise, q * 2.13 / 64.).r * .26
          + texture(uNoise, q * 4.37 / 64.).r * .12;
      }
      float density(vec3 p) {
        float n = field(p);
        if (uBank > .5) {
          vec3 local = (p-(uMin+uMax)*.5)/((uMax-uMin)*.5);
          float envelope = 1.-dot(local,local);
          return smoothstep(.0,.45,envelope+(n-.5)*1.5) * .065;
        }
        float height = (p.y-uMin.y)/(uMax.y-uMin.y);
        // Density tapers through a tall profile: peaks form within the volume,
        // never against the flat top of its bounding box.
        float profile = smoothstep(0.,.22,height) * (1.-smoothstep(.35,1.,height));
        float billow = smoothstep(.30,.64,n * profile);
        float edge = 1.-smoothstep(570.,700.,max(abs(p.x),abs(p.z)));
        return billow * edge * .11;
      }
      void main() {
        vec3 direction = normalize(vWorld - cameraPosition);
        vec3 inv = 1. / direction;
        vec3 a = (uMin - cameraPosition) * inv;
        vec3 b = (uMax - cameraPosition) * inv;
        vec3 nearPoint = min(a,b), farPoint = max(a,b);
        float entry = max(max(nearPoint.x, nearPoint.y),nearPoint.z);
        float leave = min(min(farPoint.x,farPoint.y),farPoint.z);
        if (leave <= max(entry,0.)) discard;
        float length = min(leave - max(entry,0.), 480.);
        float stride = length / float(uSteps);
        // Stable screen-space dithering removes the visible layer boundaries.
        float jitter = fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233))) * 43758.5453);
        float t = max(entry,0.) + stride * jitter;
        vec3 sum = vec3(0.); float transmittance = 1.;
        for (int i=0;i<40;i++) {
          if (i >= uSteps || transmittance < .015) break;
          vec3 p = cameraPosition + direction * t;
          float d = density(p);
          if (d > .001) {
            float sunward = density(p + vec3(-12., 18., 2.));
            float light = clamp(.30 + (d-sunward)*12. + (p.y-uMin.y)/(uMax.y-uMin.y)*.35,.10,1.);
            vec3 color = mix(uShade,uLight,light);
            float alpha = 1. - exp(-d * stride);
            sum += color * alpha * transmittance;
            transmittance *= 1.-alpha;
          }
          t += stride;
        }
        float alpha = 1.-transmittance;
        if (alpha < .005) discard;
        cloudColor = vec4(sum / max(alpha,.001),alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  const mesh = new Mesh(new BoxGeometry(1400, 130, 1400), material);
  mesh.name = "celestial-volume-clouds";
  mesh.position.y = -80;
  mesh.renderOrder = 1;
  mesh.frustumCulled = false;
  // Cumulus beyond the inhabited islands breaks the horizon at several heights.
  // These are bounded volumes too; turning the camera reveals their other sides.
  for (const [x, y, z, width, height, depth] of [
    [-420, 24, -490, 300, 130, 150],
    [-80, 45, -610, 370, 180, 180],
    [390, 20, -530, 290, 140, 160],
    [-530, 10, 100, 250, 150, 180],
    [520, 26, 160, 300, 180, 180],
    [40, 16, 560, 440, 160, 150],
  ] as const) {
    const bankMaterial = material.clone();
    // Uniform cloning would duplicate the CPU density texture for each bank.
    bankMaterial.uniforms.uNoise!.value = noise;
    bankMaterial.uniforms.uBank!.value = 1;
    bankMaterial.uniforms.uSteps!.value = Math.min(steps, 24);
    bankMaterial.uniforms.uMin!.value.set(
      x - width / 2,
      y - height / 2 + worldYOffset,
      z - depth / 2
    );
    bankMaterial.uniforms.uMax!.value.set(
      x + width / 2,
      y + height / 2 + worldYOffset,
      z + depth / 2
    );
    const bank = new Mesh(new BoxGeometry(width, height, depth), bankMaterial);
    bank.name = "celestial-distant-cumulus";
    bank.position.set(x, y - mesh.position.y, z);
    bank.renderOrder = 1;
    mesh.add(bank);
  }
  return mesh;
}
