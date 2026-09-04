import {
  AnimationMixer,
  Group,
  LoopRepeat,
  type AnimationClip,
  type Object3D,
} from "three";
import { seatedAudienceLoader } from "@austencloud/scene-3d";
import {
  SEATED_AUDIENCE_ANIMATION_URLS,
  SEATED_AUDIENCE_CHARACTER_URLS,
} from "../../../config/seated-audience-assets";

interface PreparedAudienceFigure {
  scene: Object3D;
  clip: AnimationClip | null;
}

export interface CosmicAudienceLoader {
  preloadAll(
    modelUrls: readonly string[],
    animationUrls: readonly string[]
  ): Promise<void>;
  prepareFigure(
    modelUrl: string,
    animationUrl: string
  ): Promise<PreparedAudienceFigure>;
}

export interface CosmicAudience {
  object: Group;
  update(deltaSeconds: number): void;
  setGroundY(groundY: number): void;
  dispose(): void;
}

export interface CosmicAudienceOptions {
  count: number;
  arcRadius: number;
  arcSpread: number;
  groundY: number;
  loader?: CosmicAudienceLoader;
  onPreloaded?: () => void;
}

const RETRY_DELAY_MS = 750;
const MAX_PRELOAD_ATTEMPTS = 2;

async function preloadWithRetry(loader: CosmicAudienceLoader): Promise<void> {
  let lastError: unknown = new Error("Audience preload failed");
  for (let attempt = 1; attempt <= MAX_PRELOAD_ATTEMPTS; attempt += 1) {
    try {
      await loader.preloadAll(
        SEATED_AUDIENCE_CHARACTER_URLS,
        SEATED_AUDIENCE_ANIMATION_URLS
      );
      return;
    } catch (error) {
      lastError = error;
      if (attempt < MAX_PRELOAD_ATTEMPTS) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      }
    }
  }
  throw lastError;
}

/** The exact nine-seat production audience, without a Svelte dependency. */
export async function createCosmicAudience(
  options: CosmicAudienceOptions
): Promise<CosmicAudience> {
  const loader = options.loader ?? seatedAudienceLoader;
  await preloadWithRetry(loader);
  options.onPreloaded?.();

  const object = new Group();
  object.name = "CosmicSeatedAudience";
  object.position.y = options.groundY;
  const mixers: AnimationMixer[] = [];

  // SeatedFigure3D mounts every seat in the same Svelte turn, so all cached
  // figure preparations begin together. Keep that lifecycle here as well.
  const preparedFigures = await Promise.all(
    Array.from({ length: options.count }, async (_, index) => {
      const modelUrl =
        SEATED_AUDIENCE_CHARACTER_URLS[
          index % SEATED_AUDIENCE_CHARACTER_URLS.length
        ]!;
      const animationUrl =
        SEATED_AUDIENCE_ANIMATION_URLS[
          index % SEATED_AUDIENCE_ANIMATION_URLS.length
        ]!;
      try {
        return await loader.prepareFigure(modelUrl, animationUrl);
      } catch (error) {
        console.error(`[SeatedFigure3D] prepareFigure failed:`, error);
        return null;
      }
    })
  );

  for (let index = 0; index < options.count; index += 1) {
    const t = options.count === 1 ? 0.5 : index / (options.count - 1);
    const angle = (t - 0.5) * options.arcSpread;
    const prepared = preparedFigures[index];
    if (!prepared) continue;
    const seat = new Group();
    seat.name = `CosmicAudienceSeat-${index}`;
    seat.position.set(
      Math.sin(angle) * options.arcRadius,
      0,
      Math.cos(angle) * options.arcRadius
    );
    seat.rotation.y = Math.PI + angle;
    seat.scale.setScalar(0.92 + ((index * 37) % 10) * 0.016);
    seat.add(prepared.scene);
    object.add(seat);

    if (prepared.clip) {
      const mixer = new AnimationMixer(prepared.scene);
      mixer.clipAction(prepared.clip).setLoop(LoopRepeat, Infinity).play();
      const timeOffset = (index * 0.47) % 2.3;
      if (timeOffset > 0) mixer.update(timeOffset);
      mixers.push(mixer);
    }
  }

  return {
    object,
    update(deltaSeconds) {
      for (const mixer of mixers) mixer.update(deltaSeconds);
    },
    setGroundY(groundY) {
      object.position.y = groundY;
    },
    dispose() {
      for (const mixer of mixers) mixer.stopAllAction();
      object.clear();
    },
  };
}
