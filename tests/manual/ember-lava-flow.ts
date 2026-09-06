import {
  Scene,
  PerspectiveCamera,
  WebGLRenderer,
  ACESFilmicToneMapping,
  SRGBColorSpace,
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  createLoadedEmberEnvironmentWorld,
  attachEmberEnvironmentWorld,
} from "../../src/lib/shared/3d/environments/worlds/ember/ember-environment-world";
const scene = new Scene();
const camera = new PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 2000);
const params = new URLSearchParams(location.search);
const point = (value: string): [number, number, number] =>
  value.split(",").map(Number) as [number, number, number];
camera.position.set(...point(params.get("cam") ?? "-24.766,0.688,-3.410"));
const renderer = new WebGLRenderer({
  antialias: true,
  preserveDrawingBuffer: true,
});
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.outputColorSpace = SRGBColorSpace;
renderer.toneMapping = ACESFilmicToneMapping;
renderer.toneMappingExposure = 1;
renderer.shadowMap.enabled = true;
document.body.prepend(renderer.domElement);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(...point(params.get("look") ?? "0,0.688,0"));
controls.update();
const root = new URL("../../", import.meta.url).pathname;
const world = await createLoadedEmberEnvironmentWorld({
  renderer,
  groundY: -1.5,
  reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
  resolveAssetUrl: (path) =>
    path === "/models/ember/ember-production-slice.glb"
      ? root.replace(/\/$/, "") + "/static" + path
      : path,
});
attachEmberEnvironmentWorld(scene, world);
await renderer.compileAsync(scene, camera);
let paused = false,
  time = 0,
  last = performance.now();
const pause = document.querySelector<HTMLButtonElement>("#pause")!;
const status = document.querySelector<HTMLOutputElement>("#status")!;
const backdrop = document.querySelector<HTMLButtonElement>("#backdrop")!;
const distant: import("three").Object3D[] = [];
world.root.traverse((node) => {
  if (node.userData.ember_backdrop === true) distant.push(node);
});
backdrop.hidden = distant.length === 0;
let showBackdrop = true;
const submitTimes: number[] = [];
const frameTimes: number[] = [];
const median = (values: number[]) =>
  [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)] ?? 0;
backdrop.onclick = () => {
  showBackdrop = !showBackdrop;
  for (const node of distant) node.visible = showBackdrop;
  backdrop.textContent = showBackdrop ? "Hide valley" : "Show valley";
  submitTimes.length = 0;
  frameTimes.length = 0;
};
pause.onclick = () => {
  paused = !paused;
  pause.textContent = paused ? "Resume flow" : "Pause flow";
};
renderer.setAnimationLoop((now) => {
  const frameTime = now - last;
  const start = performance.now();
  const delta = Math.min((now - last) / 1000, 1 / 15);
  last = now;
  if (!paused) {
    time += delta;
    world.update(delta, time, camera);
  }
  renderer.render(scene, camera);
  submitTimes.push(performance.now() - start);
  frameTimes.push(frameTime);
  if (submitTimes.length > 120) {
    submitTimes.shift();
    frameTimes.shift();
  }
  status.textContent = `Ready · ${time.toFixed(2)} s · ${renderer.info.render.calls} draws · ${renderer.info.render.triangles} triangles · CPU submit ${median(submitTimes).toFixed(2)} ms · frame ${median(frameTimes).toFixed(2)} ms · ${submitTimes.length} samples`;
});
addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
