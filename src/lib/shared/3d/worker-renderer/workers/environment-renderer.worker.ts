import {
  ACESFilmicToneMapping,
  PerspectiveCamera,
  SRGBColorSpace,
  Vector3,
  Vector4,
  WebGLRenderer,
} from "three";
import type {
  WorkerCameraSnapshot,
  WorkerEnvironmentKey,
  WorkerRendererBootMetrics,
  WorkerRendererInMessage,
  WorkerRendererOutMessage,
  WorkerPerformerSnapshot,
  WorkerSceneEffectsSnapshot,
  WorkerViewport,
} from "../domain/worker-renderer-protocol";
import { clampWorkerViewport } from "../domain/worker-renderer-protocol";
import { createOceanPrototypeWorld } from "../worlds/ocean-prototype-world";
import { createRainbowPrototypeWorld } from "../worlds/rainbow-prototype-world";
import { createVoidPrototypeWorld } from "../worlds/void-prototype-world";
import { createWinterPrototypeWorld } from "../worlds/winter-prototype-world";
import { createCelestialPrototypeWorld } from "../worlds/celestial-prototype-world";
import { createCosmicPrototypeWorld } from "../worlds/cosmic-prototype-world";
import { createForestPrototypeWorld } from "../worlds/forest-prototype-world";
import { createBlossomPrototypeWorld } from "../worlds/blossom-prototype-world";
import { createAutumnPrototypeWorld } from "../worlds/autumn-prototype-world";
import { createEmberPrototypeWorld } from "../worlds/ember-prototype-world";
import type {
  WorkerEnvironmentWorld,
  WorkerWorldFactory,
} from "../worlds/worker-environment-world";
import { WorkerPerformerStage } from "../worlds/worker-performer";
import {
  primeWorkerRenderer,
  warmWorkerRenderer,
} from "../services/worker-renderer-warmup";
import {
  createViewerBaseLightingGroup,
  resolveViewerBaseLighting,
} from "../../rendering/viewer-lighting-rig";
import { ScenePostProcessingPipeline } from "../../effects/post-processing/scene-post-processing-pipeline";
import { SceneEffectsManager3D } from "../../effects/scene-effects/scene-effects-manager-3d";
import { WorkerImperativeEffects3D } from "../effects/worker-imperative-effects-3d";
import type {
  SceneEffectRigFrame3D,
  SceneEffectTipSource3D,
} from "../../effects/scene-effects/scene-effect-source-3d";

const scope = self as unknown as DedicatedWorkerGlobalScope;

const WORLD_FACTORIES: Readonly<
  Record<WorkerEnvironmentKey, WorkerWorldFactory>
> = {
  ocean: createOceanPrototypeWorld,
  rainbow: createRainbowPrototypeWorld,
  void: createVoidPrototypeWorld,
  winter: createWinterPrototypeWorld,
  celestial: createCelestialPrototypeWorld,
  cosmic: createCosmicPrototypeWorld,
  forest: createForestPrototypeWorld,
  blossom: createBlossomPrototypeWorld,
  autumn: createAutumnPrototypeWorld,
  ember: createEmberPrototypeWorld,
};

let requestId = 0;
let environment: WorkerEnvironmentKey | null = null;
let renderer: WebGLRenderer | null = null;
let camera: PerspectiveCamera | null = null;
let world: WorkerEnvironmentWorld | null = null;
let performerStage: WorkerPerformerStage | null = null;
let postProcessing: ScenePostProcessingPipeline | null = null;
let sceneEffectsManager: SceneEffectsManager3D | null = null;
let sceneEffectsRegistration: { dispose(): void } | null = null;
let imperativeEffects: WorkerImperativeEffects3D | null = null;
const sceneEffectsFrame: SceneEffectRigFrame3D = {
  playing: false,
  sources: [],
};
let performerSnapshots: readonly WorkerPerformerSnapshot[] = [];
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
  postProcessing?.resize(viewport.width, viewport.height);
}

function createPostProcessingPipeline(
  activeEnvironment: WorkerEnvironmentKey
): ScenePostProcessingPipeline | null {
  if (!renderer || !camera || !world) return null;
  const isOcean = activeEnvironment === "ocean";
  return new ScenePostProcessingPipeline({
    renderer,
    scene: world.scene,
    camera,
    config: {
      enabled: true,
      isOcean,
      tierBloom: true,
      enableShadows: true,
      bloomResolutionScale: 1,
      bloomLevels: 8,
      tierBloomResolutionScale: 1,
      tierBloomLevels: 8,
      enableBloom: true,
      enableChromaticAberration: true,
      oceanBloom: true,
      oceanWaterTint: true,
      oceanWaterTintStrength: 0.8,
      oceanUnderwaterDistortion: false,
    },
  });
}

function renderCurrentFrame(deltaSeconds: number): void {
  if (!renderer || !camera || !world) return;
  imperativeEffects?.update(deltaSeconds, camera);
  sceneEffectsManager?.update(deltaSeconds);
  if (postProcessing)
    postProcessing.render(deltaSeconds, { forceBaseRender: true });
  else renderer.render(world.scene, camera);
}

function applyEffects(snapshot: WorkerSceneEffectsSnapshot): void {
  sceneEffectsFrame.playing = snapshot.playing;
  sceneEffectsFrame.sources = Array.from(
    snapshot.sources
  ) as SceneEffectTipSource3D[];
  if (sceneEffectsFrame.sources.length === 0) sceneEffectsManager?.clear();
  if (camera) imperativeEffects?.apply(snapshot.imperative ?? [], camera);
}

function applyCamera(snapshot: WorkerCameraSnapshot): void {
  if (!camera) return;
  camera.position.fromArray(snapshot.position);
  camera.fov = snapshot.fov;
  if (snapshot.up) camera.up.fromArray(snapshot.up);
  else camera.up.set(0, 1, 0);
  if (snapshot.quaternion) camera.quaternion.fromArray(snapshot.quaternion);
  else camera.lookAt(...snapshot.target);
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
    performerStage?.update(Math.min(deltaMs / 1000, 0.1));
    renderCurrentFrame(deltaMs / 1000);
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

  post({ type: "progress", requestId, phase: "renderer", fraction: 0 });

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
  const rendererReadyAt = performance.now();
  post({ type: "progress", requestId, phase: "renderer", fraction: 1 });

  const factory = WORLD_FACTORIES[environment];
  performerSnapshots = message.performers;
  world = await factory({
    renderer,
    camera,
    performers: performerSnapshots,
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
  if (world.useViewerBaseLighting !== false) {
    world.scene.add(
      createViewerBaseLightingGroup(
        resolveViewerBaseLighting(true, environment === "ocean")
      )
    );
  }
  sceneEffectsManager = new SceneEffectsManager3D();
  sceneEffectsManager.initialize(world.scene, renderer);
  sceneEffectsRegistration = sceneEffectsManager.registerRig(sceneEffectsFrame);
  imperativeEffects = new WorkerImperativeEffects3D(
    world.scene,
    sceneEffectsManager.getDynamicLightManager()
  );
  const environmentReadyAt = performance.now();
  post({ type: "progress", requestId, phase: "performer", fraction: 0 });
  performerStage = new WorkerPerformerStage(world.scene);
  await performerStage.setSnapshots(performerSnapshots);
  if (disposed) return;
  const performerReadyAt = performance.now();
  const worldReadyAt = performerReadyAt;
  post({ type: "progress", requestId, phase: "performer", fraction: 1 });
  applyEffects(message.effects ?? { playing: false, sources: [] });
  postProcessing = createPostProcessingPipeline(environment);

  post({ type: "progress", requestId, phase: "compile", fraction: 0 });
  const compileTargets = await warmWorkerRenderer(
    { renderer, scene: world.scene, camera },
    {
      onProgress(fraction) {
        post({ type: "progress", requestId, phase: "compile", fraction });
      },
      async yieldBetween() {
        await nextWorkerFrame();
      },
      shouldStop: () => disposed,
    }
  );
  if (disposed) return;
  const compiledAt = performance.now();
  const memoryAfterCompile = rendererMemory();

  post({ type: "progress", requestId, phase: "prime", fraction: 0 });
  const primeTargets = await primeWorkerRenderer(
    { renderer, scene: world.scene, camera },
    {
      onProgress(fraction) {
        post({ type: "progress", requestId, phase: "prime", fraction });
      },
      async yieldBetween() {
        await nextWorkerFrame();
      },
      shouldStop: () => disposed,
    }
  );
  if (disposed) return;
  const primedAt = performance.now();
  const memoryAfterPrime = rendererMemory();

  post({ type: "progress", requestId, phase: "finalize", fraction: 0 });
  await renderer.compileAsync(world.scene, camera);
  if (disposed) return;
  const finalizedAt = performance.now();
  const memoryAfterFinalize = rendererMemory();
  post({ type: "progress", requestId, phase: "finalize", fraction: 1 });

  post({ type: "progress", requestId, phase: "preflight", fraction: 0 });
  const previousViewport = renderer.getViewport(new Vector4());
  renderer.setViewport(0, 0, 1, 1);
  try {
    world.update(0, finalizedAt / 1000);
    performerStage.update(0);
    renderCurrentFrame(0);
  } finally {
    renderer.setViewport(previousViewport);
  }
  const preflightedAt = performance.now();
  const memoryAfterPreflight = rendererMemory();
  post({ type: "progress", requestId, phase: "preflight", fraction: 1 });

  post({ type: "progress", requestId, phase: "first-frame", fraction: 0 });
  const firstRenderStartedAt = performance.now();
  world.update(0, compiledAt / 1000);
  performerStage.update(0);
  renderCurrentFrame(0);
  const firstRenderCompletedAt = performance.now();
  const memoryAfterFirstRender = rendererMemory();
  await nextWorkerFrame();
  const presentedAt = performance.now();
  if (disposed || !renderer || !world) return;
  world.update(
    Math.min((presentedAt - compiledAt) / 1000, 0.1),
    presentedAt / 1000
  );
  performerStage.update(Math.min((presentedAt - compiledAt) / 1000, 0.1));
  renderCurrentFrame(Math.min((presentedAt - compiledAt) / 1000, 0.1));
  const firstFrameAt = performance.now();
  frameCount = 1;
  previousFrameAt = firstFrameAt;
  const performerDiagnostics = performerStage.getDiagnostics();
  const projectedCenter = performerDiagnostics.boundsCenter
    ? new Vector3(...performerDiagnostics.boundsCenter)
        .project(camera)
        .toArray()
    : null;

  post({ type: "progress", requestId, phase: "first-frame", fraction: 1 });
  post({
    type: "first-frame",
    requestId,
    environment: world.environment,
    metrics: {
      acceptedAt,
      rendererReadyAt,
      environmentReadyAt,
      performerReadyAt,
      worldReadyAt,
      compiledAt,
      primedAt,
      finalizedAt,
      preflightedAt,
      firstFrameAt,
      rendererMs: rendererReadyAt - acceptedAt,
      environmentMs: environmentReadyAt - rendererReadyAt,
      performerMs: performerReadyAt - environmentReadyAt,
      worldMs: worldReadyAt - acceptedAt,
      compileMs: compiledAt - worldReadyAt,
      primeMs: primedAt - compiledAt,
      primeTargets,
      finalizeCompileMs: finalizedAt - primedAt,
      preflightMs: preflightedAt - finalizedAt,
      firstRenderMs: firstRenderCompletedAt - firstRenderStartedAt,
      presentationWaitMs: presentedAt - firstRenderCompletedAt,
      confirmationRenderMs: firstFrameAt - presentedAt,
      firstFrameWaitMs: firstFrameAt - preflightedAt,
      firstFrameMs: firstFrameAt - acceptedAt,
      compileTargets,
      memoryAfterCompile,
      memoryAfterPrime,
      memoryAfterFinalize,
      memoryAfterPreflight,
      memoryAfterFirstRender,
      performers: {
        ...performerDiagnostics,
        projectedCenter,
      },
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
  performerStage?.dispose();
  performerStage = null;
  imperativeEffects?.dispose();
  imperativeEffects = null;
  sceneEffectsRegistration?.dispose();
  sceneEffectsRegistration = null;
  sceneEffectsManager?.dispose();
  sceneEffectsManager = null;
  sceneEffectsFrame.playing = false;
  sceneEffectsFrame.sources = [];
  postProcessing?.dispose();
  postProcessing = null;
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
    case "performers":
      performerSnapshots = message.performers;
      world?.setPerformers?.(performerSnapshots);
      void performerStage?.setSnapshots(performerSnapshots).catch((error) => {
        post({
          type: "error",
          requestId,
          environment,
          message: errorMessage(error),
          stack: error instanceof Error ? error.stack : undefined,
        });
      });
      break;
    case "effects":
      applyEffects(message.effects);
      break;
    case "pointer": {
      if (!world || !environment) break;
      if (message.action === "leave") {
        world.pointerLeave?.();
        post({
          type: "interaction",
          requestId,
          environment,
          hover: false,
          chime: null,
        });
        break;
      }
      const hover = world.pointerMove?.(message.ndcX, message.ndcY) ?? false;
      const chime =
        message.action === "down"
          ? (world.pointerDown?.(message.ndcX, message.ndcY) ?? null)
          : null;
      post({
        type: "interaction",
        requestId,
        environment,
        hover,
        chime,
      });
      break;
    }
    case "visibility":
      visible = message.visible;
      previousFrameAt = performance.now();
      break;
    case "dispose":
      dispose();
      break;
  }
};
