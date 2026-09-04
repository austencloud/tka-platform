import {
  ACESFilmicToneMapping,
  PerspectiveCamera,
  SRGBColorSpace,
  WebGLRenderer,
} from "three";
import type {
  WorkerCameraSnapshot,
  WorkerEnvironmentKey,
  WorkerRendererBootMetrics,
  WorkerRendererInMessage,
  WorkerRendererOutMessage,
  WorkerViewport,
} from "../domain/worker-renderer-protocol";
import { clampWorkerViewport } from "../domain/worker-renderer-protocol";
import { createOceanPrototypeWorld } from "../worlds/ocean-prototype-world";
import { createRainbowPrototypeWorld } from "../worlds/rainbow-prototype-world";
import type {
  WorkerEnvironmentWorld,
  WorkerWorldFactory,
} from "../worlds/worker-environment-world";

const scope = self as unknown as DedicatedWorkerGlobalScope;

const WORLD_FACTORIES: Readonly<
  Record<WorkerEnvironmentKey, WorkerWorldFactory>
> = {
  ocean: createOceanPrototypeWorld,
  rainbow: createRainbowPrototypeWorld,
};

let requestId = 0;
let environment: WorkerEnvironmentKey | null = null;
let renderer: WebGLRenderer | null = null;
let camera: PerspectiveCamera | null = null;
let world: WorkerEnvironmentWorld | null = null;
let animationFrame = 0;
let frameCount = 0;
let previousFrameAt = 0;
let visible = true;
let disposed = false;

function post(message: WorkerRendererOutMessage): void {
  scope.postMessage(message);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function applyViewport(viewportInput: WorkerViewport): void {
  if (!renderer || !camera) return;
  const viewport = clampWorkerViewport(viewportInput);
  renderer.setPixelRatio(viewport.dpr);
  renderer.setSize(viewport.width, viewport.height, false);
  camera.aspect = viewport.width / viewport.height;
  camera.updateProjectionMatrix();
}

function applyCamera(snapshot: WorkerCameraSnapshot): void {
  if (!camera) return;
  camera.position.fromArray(snapshot.position);
  camera.fov = snapshot.fov;
  camera.lookAt(...snapshot.target);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
}

function rendererMemory(): Pick<
  WorkerRendererBootMetrics,
  "geometries" | "textures" | "programs"
> {
  const info = renderer?.info;
  const programs = (info as typeof info & { programs?: unknown[] })?.programs;
  return {
    geometries: info?.memory.geometries ?? 0,
    textures: info?.memory.textures ?? 0,
    programs: programs?.length ?? 0,
  };
}

function renderFrame(now: number): void {
  if (disposed || !renderer || !camera || !world) return;
  const deltaMs = previousFrameAt === 0 ? 0 : now - previousFrameAt;
  previousFrameAt = now;
  if (visible) {
    world.update(Math.min(deltaMs / 1000, 0.1), now / 1000);
    renderer.render(world.scene, camera);
    frameCount += 1;
    post({
      type: "frame",
      requestId,
      environment: world.environment,
      frame: frameCount,
      renderedAt: now,
      deltaMs,
    });
  }
  animationFrame = scope.requestAnimationFrame(renderFrame);
}

async function nextWorkerFrame(): Promise<number> {
  return new Promise((resolve) => {
    animationFrame = scope.requestAnimationFrame(resolve);
  });
}

async function initialize(
  message: Extract<WorkerRendererInMessage, { type: "initialize" }>
): Promise<void> {
  requestId = message.requestId;
  environment = message.environment;
  disposed = false;
  const acceptedAt = performance.now();
  post({
    type: "booting",
    requestId,
    environment,
    acceptedAt,
  });

  message.canvas.addEventListener("webglcontextlost", (event) => {
    event.preventDefault();
    post({ type: "context-lost", requestId, environment });
  });

  renderer = new WebGLRenderer({
    canvas: message.canvas,
    antialias: true,
    alpha: false,
    powerPreference: "high-performance",
  });
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.shadowMap.enabled = true;

  camera = new PerspectiveCamera(message.camera.fov, 1, 0.05, 500);
  applyViewport(message.viewport);
  applyCamera(message.camera);

  const factory = WORLD_FACTORIES[environment];
  world = await factory({
    renderer,
    camera,
    requestId,
    reportProgress(phase, fraction) {
      post({
        type: "progress",
        requestId,
        phase,
        fraction: Math.max(0, Math.min(1, fraction)),
      });
    },
  });
  if (disposed) return;
  const worldReadyAt = performance.now();

  post({ type: "progress", requestId, phase: "compile", fraction: 0 });
  await renderer.compileAsync(world.scene, camera);
  if (disposed) return;
  const compiledAt = performance.now();
  post({ type: "progress", requestId, phase: "compile", fraction: 1 });

  world.update(0, compiledAt / 1000);
  renderer.render(world.scene, camera);
  const presentedAt = await nextWorkerFrame();
  if (disposed || !renderer || !world) return;
  world.update(
    Math.min((presentedAt - compiledAt) / 1000, 0.1),
    presentedAt / 1000
  );
  renderer.render(world.scene, camera);
  const firstFrameAt = performance.now();
  frameCount = 1;
  previousFrameAt = firstFrameAt;

  post({ type: "progress", requestId, phase: "first-frame", fraction: 1 });
  post({
    type: "first-frame",
    requestId,
    environment: world.environment,
    metrics: {
      acceptedAt,
      worldReadyAt,
      compiledAt,
      firstFrameAt,
      worldMs: worldReadyAt - acceptedAt,
      compileMs: compiledAt - worldReadyAt,
      firstFrameMs: firstFrameAt - acceptedAt,
      ...rendererMemory(),
    },
  });
  animationFrame = scope.requestAnimationFrame(renderFrame);
}

function dispose(): void {
  if (disposed) return;
  disposed = true;
  if (animationFrame) scope.cancelAnimationFrame(animationFrame);
  animationFrame = 0;
  world?.dispose();
  world = null;
  renderer?.renderLists.dispose();
  renderer?.dispose();
  renderer?.forceContextLoss();
  renderer = null;
  camera = null;
  post({ type: "disposed", requestId });
  scope.close();
}

scope.onmessage = (event: MessageEvent<WorkerRendererInMessage>) => {
  const message = event.data;
  if (message.type !== "initialize" && message.requestId !== requestId) return;

  switch (message.type) {
    case "initialize":
      void initialize(message).catch((error) => {
        post({
          type: "error",
          requestId: message.requestId,
          environment: message.environment,
          message: errorMessage(error),
          stack: error instanceof Error ? error.stack : undefined,
        });
      });
      break;
    case "resize":
      applyViewport(message.viewport);
      break;
    case "camera":
      applyCamera(message.camera);
      break;
    case "visibility":
      visible = message.visible;
      previousFrameAt = performance.now();
      break;
    case "dispose":
      dispose();
      break;
  }
};
