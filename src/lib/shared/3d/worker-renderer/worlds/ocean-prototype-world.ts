import {
  AmbientLight,
  Color,
  DirectionalLight,
  DoubleSide,
  FogExp2,
  Group,
  Mesh,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
} from "three";
import {
  GLTFLoader,
  type GLTF,
} from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import {
  disposeWorkerWorldTree,
  type WorkerEnvironmentWorld,
  type WorkerWorldContext,
} from "./worker-environment-world";

const OCEAN_WORLD_Y_OFFSET = -1.95;

function absoluteAssetUrl(path: string): string {
  return new URL(path, globalThis.location.href).href;
}

function loadGltf(
  loader: GLTFLoader,
  url: string,
  onProgress: (loaded: number, total: number) => void
): Promise<GLTF> {
  return new Promise((resolve, reject) => {
    loader.load(
      absoluteAssetUrl(url),
      resolve,
      (event) => onProgress(event.loaded, event.total),
      reject
    );
  });
}

export async function createOceanPrototypeWorld(
  context: WorkerWorldContext
): Promise<WorkerEnvironmentWorld> {
  const scene = new Scene();
  const waterColor = new Color("#071f34");
  scene.background = waterColor;
  scene.fog = new FogExp2(waterColor, 0.026);

  const world = new Group();
  world.position.y = OCEAN_WORLD_Y_OFFSET;
  scene.add(world);

  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);

  const loaded = [0, 0];
  const totals = [0, 0];
  const report = (index: number, value: number, total: number) => {
    loaded[index] = value;
    totals[index] = total;
    const knownTotal = totals[0] + totals[1];
    const fraction = knownTotal > 0 ? (loaded[0] + loaded[1]) / knownTotal : 0;
    context.reportProgress("assets", Math.min(0.95, fraction));
  };

  const [seabed, flora] = await Promise.all([
    loadGltf(loader, "/models/ocean/ocean-environment.glb", (value, total) =>
      report(0, value, total)
    ),
    loadGltf(loader, "/models/ocean/ocean_flora_scene.glb", (value, total) =>
      report(1, value, total)
    ),
  ]);
  context.reportProgress("assets", 1);

  seabed.scene.traverse((object) => {
    const mesh = object as Mesh;
    if (!mesh.isMesh) return;
    mesh.receiveShadow = true;
    mesh.castShadow = false;
  });
  flora.scene.traverse((object) => {
    const mesh = object as Mesh;
    if (!mesh.isMesh) return;
    mesh.receiveShadow = true;
    mesh.castShadow = true;
  });
  world.add(seabed.scene, flora.scene);

  const waterMaterial = new ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uColor: { value: new Color("#0a5272") } },
    vertexShader: /* glsl */ `
      uniform float uTime;
      varying vec3 vWorld;
      void main() {
        vec3 p = position;
        p.z += sin(position.x * 0.12 + uTime * 0.35) * 0.18;
        p.z += cos(position.y * 0.09 - uTime * 0.22) * 0.12;
        vec4 world = modelMatrix * vec4(p, 1.0);
        vWorld = world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      varying vec3 vWorld;
      void main() {
        float shimmer = 0.72 + 0.28 * sin(vWorld.x * 0.25 + vWorld.z * 0.18);
        gl_FragColor = vec4(uColor * shimmer, 0.34);
      }
    `,
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
  });
  const water = new Mesh(new PlaneGeometry(70, 70, 48, 48), waterMaterial);
  water.rotation.x = -Math.PI / 2;
  water.position.y = 19.7;
  water.renderOrder = 10;
  world.add(water);

  scene.add(new AmbientLight("#35799c", 0.8));
  const key = new DirectionalLight("#a3dbf0", 3.2);
  key.position.set(-7, 13, 8);
  key.castShadow = true;
  scene.add(key);
  const rim = new DirectionalLight("#1b8fb5", 2.1);
  rim.position.set(10, 8, -12);
  scene.add(rim);

  context.reportProgress("construct", 1);
  return {
    environment: "ocean",
    scene,
    update(_deltaSeconds, elapsedSeconds) {
      waterMaterial.uniforms.uTime!.value = elapsedSeconds;
    },
    dispose() {
      disposeWorkerWorldTree(scene);
      scene.background = null;
      scene.fog = null;
    },
  };
}

export const OCEAN_PROTOTYPE_CAMERA = {
  position: [0, 4.5, 19] as const,
  target: [0, 1.6, -2] as const,
  fov: 46,
};
