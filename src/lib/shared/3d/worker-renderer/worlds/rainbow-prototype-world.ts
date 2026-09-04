import {
  AdditiveBlending,
  BackSide,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  FogExp2,
  Group,
  HemisphereLight,
  Mesh,
  MeshPhysicalMaterial,
  PointLight,
  Points,
  BufferGeometry,
  Float32BufferAttribute,
  Scene,
  ShaderMaterial,
  SphereGeometry,
} from "three";
import {
  disposeWorkerWorldTree,
  type WorkerEnvironmentWorld,
  type WorkerWorldContext,
} from "./worker-environment-world";

const RAINBOW_GLSL = /* glsl */ `
  vec3 rainbow(float t) {
    vec3 p = abs(fract(t + vec3(0.0, 0.333333, 0.666667)) * 6.0 - 3.0);
    return clamp(p - 1.0, 0.0, 1.0);
  }
`;

export async function createRainbowPrototypeWorld(
  context: WorkerWorldContext
): Promise<WorkerEnvironmentWorld> {
  context.reportProgress("construct", 0.05);
  const scene = new Scene();
  scene.background = new Color("#070015");
  scene.fog = new FogExp2("#08001a", 0.008);

  const animatedMaterials: ShaderMaterial[] = [];
  const driftingOrbs: Array<{
    group: Group;
    radius: number;
    phase: number;
    height: number;
  }> = [];

  const dome = new Mesh(
    new SphereGeometry(70, 48, 32),
    new ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      vertexShader: /* glsl */ `
        varying vec3 vWorld;
        void main() {
          vec4 world = modelMatrix * vec4(position, 1.0);
          vWorld = world.xyz;
          gl_Position = projectionMatrix * viewMatrix * world;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        varying vec3 vWorld;
        ${RAINBOW_GLSL}
        void main() {
          vec3 direction = normalize(vWorld);
          float horizon = smoothstep(-0.02, 0.15, direction.y);
          float angle = atan(direction.x, direction.z);
          float curtain = pow(max(0.0, sin(angle * 7.0 + direction.y * 18.0 + uTime * 0.3)), 5.0);
          vec3 color = rainbow(angle / 6.283185 + uTime * 0.012);
          gl_FragColor = vec4(color * curtain * 1.6, horizon * curtain * 0.5);
        }
      `,
      side: BackSide,
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
    })
  );
  animatedMaterials.push(dome.material as ShaderMaterial);
  scene.add(dome);

  const groundMaterial = new ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec3 vWorld;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorld = world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      varying vec3 vWorld;
      ${RAINBOW_GLSL}
      void main() {
        float distanceFromCenter = length(vWorld.xz);
        float bands = 0.5 + 0.5 * sin(distanceFromCenter * 2.5 - uTime * 0.5);
        vec3 color = rainbow(atan(vWorld.z, vWorld.x) / 6.283185 + uTime * 0.02);
        float alpha = smoothstep(22.0, 15.0, distanceFromCenter);
        gl_FragColor = vec4(mix(vec3(0.015, 0.002, 0.04), color, bands * 0.35), alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
  });
  animatedMaterials.push(groundMaterial);
  const ground = new Mesh(new CircleGeometry(22, 96), groundMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -1.5;
  scene.add(ground);

  const platform = new Mesh(
    new CylinderGeometry(4.6, 4.6, 0.45, 96, 1, true),
    new MeshPhysicalMaterial({
      color: "#ffffff",
      transmission: 0.65,
      roughness: 0.06,
      transparent: true,
      opacity: 0.52,
    })
  );
  platform.position.y = -1.275;
  scene.add(platform);

  const colors = [
    "#ff1744",
    "#ff9100",
    "#ffea00",
    "#00e676",
    "#2979ff",
    "#651fff",
    "#d500f9",
  ];
  const sharedOrbGeometry = new SphereGeometry(1, 24, 18);
  colors.forEach((color, index) => {
    const angle = (index / colors.length) * Math.PI * 2;
    const group = new Group();
    const orb = new Mesh(
      sharedOrbGeometry,
      new MeshPhysicalMaterial({
        color,
        emissive: color,
        emissiveIntensity: 1.1,
        transmission: 0.45,
        roughness: 0.08,
      })
    );
    orb.scale.setScalar(0.16 + index * 0.01);
    group.add(orb);
    group.add(new PointLight(color, 10, 8, 2));
    scene.add(group);
    driftingOrbs.push({
      group,
      radius: 5.5 + (index % 3),
      phase: angle,
      height: 1.5 + (index % 4) * 0.7,
    });
  });

  const particleCount = 340;
  const particlePositions = new Float32Array(particleCount * 3);
  const particleColors = new Float32Array(particleCount * 3);
  for (let index = 0; index < particleCount; index += 1) {
    particlePositions[index * 3] = (Math.random() - 0.5) * 28;
    particlePositions[index * 3 + 1] = Math.random() * 13 - 1;
    particlePositions[index * 3 + 2] = (Math.random() - 0.5) * 28 - 4;
    const color = new Color(colors[index % colors.length]);
    particleColors[index * 3] = color.r;
    particleColors[index * 3 + 1] = color.g;
    particleColors[index * 3 + 2] = color.b;
  }
  const particleGeometry = new BufferGeometry();
  particleGeometry.setAttribute(
    "position",
    new Float32BufferAttribute(particlePositions, 3)
  );
  particleGeometry.setAttribute(
    "color",
    new Float32BufferAttribute(particleColors, 3)
  );
  const particleMaterial = new ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      uniform float uTime;
      varying vec3 vColor;
      attribute vec3 color;
      void main() {
        vColor = color;
        vec3 p = position;
        p.y += sin(uTime * 0.4 + position.x) * 0.3;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = max(1.5, 18.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vColor;
      void main() {
        vec2 p = gl_PointCoord - 0.5;
        float alpha = smoothstep(0.5, 0.0, length(p));
        gl_FragColor = vec4(vColor * 1.8, alpha);
      }
    `,
    vertexColors: true,
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
  });
  animatedMaterials.push(particleMaterial);
  scene.add(new Points(particleGeometry, particleMaterial));

  scene.add(new HemisphereLight("#5f31a8", "#080314", 1.25));
  const key = new DirectionalLight("#a986ff", 2.4);
  key.position.set(-8, 14, 9);
  scene.add(key);

  context.reportProgress("construct", 1);
  await Promise.resolve();

  return {
    environment: "rainbow",
    scene,
    update(_deltaSeconds, elapsedSeconds) {
      for (const material of animatedMaterials) {
        const time = material.uniforms.uTime;
        if (time) time.value = elapsedSeconds;
      }
      driftingOrbs.forEach((orb, index) => {
        const t = elapsedSeconds * (0.12 + index * 0.018) + orb.phase;
        orb.group.position.set(
          Math.cos(t) * orb.radius,
          orb.height + Math.sin(t * 1.7) * 0.45,
          Math.sin(t) * orb.radius - 2
        );
      });
    },
    dispose() {
      disposeWorkerWorldTree(scene);
      scene.background = null;
      scene.fog = null;
    },
  };
}

export const RAINBOW_PROTOTYPE_CAMERA = {
  position: [0, 4.2, 17] as const,
  target: [0, 1.1, -1] as const,
  fov: 48,
};
