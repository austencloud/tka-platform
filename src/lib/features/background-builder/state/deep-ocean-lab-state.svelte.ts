import type {
  FishMarineLife,
  FishMood,
  OceanBackgroundOrchestrator,
  OceanLayers,
  QualityLevel,
} from "@austencloud/backgrounds";
import type { CoralSceneRenderer } from "../services/CoralSceneRenderer";

export interface OceanLabDeps {
  getBackgroundSystem: () => OceanBackgroundOrchestrator;
  coralRenderer: CoralSceneRenderer;
}

export function createOceanLabState() {
  let canvas: HTMLCanvasElement | null = $state(null);
  let isLoading = $state(true);
  let backgroundSystem: OceanBackgroundOrchestrator | null = $state(null);
  let animationFrame: number | null = $state(null);
  let lastFrameTime = 0;

  let quality: QualityLevel = $state("high");
  let showCoral = $state(true);
  let coralCount = $state(0);

  let layers = $state<OceanLayers>({
    gradient: true,
    lightRays: true,
    caustics: true,
    particles: true,
    bubbles: true,
    fish: true,
    jellyfish: true,
  });

  let stats = $state({ fish: 0, jellyfish: 0, bubbles: 0, particles: 0 });
  let lastStatsUpdate = 0;

  let fishList: FishMarineLife[] = $state([]);
  let selectedFishIndex = $state(0);
  let showOverlay = $state(true);

  let activeMoodTrigger = $state<FishMood | null>(null);
  let activeWobbleTrigger = $state<string | null>(null);
  let activeRareTrigger = $state<string | null>(null);

  const selectedFish = $derived(fishList[selectedFishIndex] ?? null);

  const statusCounters = $derived([
    { icon: "fa-fish", value: stats.fish, label: "Fish" },
    { icon: "fa-disease", value: stats.jellyfish, label: "Jellyfish" },
    { icon: "fa-circle", value: stats.bubbles, label: "Bubbles" },
    ...(showCoral ? [{ icon: "fa-seedling", value: coralCount, label: "Coral" }] : []),
  ]);

  const statusChips = $derived(() => {
    if (!selectedFish) return [];
    return [
      { label: selectedFish.behavior, color: getBehaviorChipColor(selectedFish.behavior) },
      { label: selectedFish.mood ?? "calm", color: getMoodChipColor(selectedFish.mood ?? "calm") },
    ];
  });

  const huntStats = $derived(() => {
    const fishAnimator = backgroundSystem?.getFishAnimator?.();
    if (!fishAnimator) return { activeHunts: 0, totalHunts: 0, successfulCatches: 0, escapes: 0 };
    const huntingHandler = fishAnimator.getHuntingHandler?.();
    if (!huntingHandler) return { activeHunts: 0, totalHunts: 0, successfulCatches: 0, escapes: 0 };
    return huntingHandler.getStats();
  });

  function getBehaviorChipColor(behavior: string): "cyan" | "orange" | "red" | "purple" | "gray" {
    switch (behavior) {
      case "cruising": return "cyan";
      case "turning": return "orange";
      case "darting": return "red";
      case "schooling": return "purple";
      default: return "gray";
    }
  }

  function getMoodChipColor(mood: string): "cyan" | "blue" | "green" | "orange" | "red" | "purple" | "gray" {
    switch (mood) {
      case "calm": return "cyan";
      case "curious": return "purple";
      case "alert": return "orange";
      case "playful": return "green";
      case "hungry": return "red";
      case "tired": return "gray";
      case "social": return "purple";
      default: return "gray";
    }
  }

  function updateFishList() {
    if (!backgroundSystem) return;
    fishList = backgroundSystem.getFish?.() ?? [];
  }

  function updateStats(currentTime: number) {
    if (!backgroundSystem) return;
    if (currentTime - lastStatsUpdate > 500) {
      stats = backgroundSystem.getStats();
      updateFishList();
      lastStatsUpdate = currentTime;
    }
  }

  function selectNextFish() {
    if (fishList.length === 0) return;
    selectedFishIndex = (selectedFishIndex + 1) % fishList.length;
  }

  function selectPrevFish() {
    if (fishList.length === 0) return;
    selectedFishIndex = (selectedFishIndex - 1 + fishList.length) % fishList.length;
  }

  function toggleLayer(layer: keyof OceanLayers) {
    layers[layer] = !layers[layer];
    if (backgroundSystem) {
      backgroundSystem.setLayerVisibility(layers);
    }
  }

  function enableAllLayers() {
    layers = {
      gradient: true,
      lightRays: true,
      caustics: true,
      particles: true,
      bubbles: true,
      fish: true,
      jellyfish: true,
    };
    if (backgroundSystem) {
      backgroundSystem.setLayerVisibility(layers);
    }
  }

  function setQualityLevel(q: QualityLevel) {
    quality = q;
  }

  function stopAnimation() {
    if (animationFrame !== null) {
      cancelAnimationFrame(animationFrame);
      animationFrame = null;
    }
  }

  return {
    get canvas() { return canvas; },
    set canvas(v: HTMLCanvasElement | null) { canvas = v; },
    get isLoading() { return isLoading; },
    set isLoading(v: boolean) { isLoading = v; },
    get backgroundSystem() { return backgroundSystem; },
    set backgroundSystem(v: OceanBackgroundOrchestrator | null) { backgroundSystem = v; },
    get animationFrame() { return animationFrame; },
    set animationFrame(v: number | null) { animationFrame = v; },
    get lastFrameTime() { return lastFrameTime; },
    set lastFrameTime(v: number) { lastFrameTime = v; },
    get quality() { return quality; },
    get showCoral() { return showCoral; },
    set showCoral(v: boolean) { showCoral = v; },
    get coralCount() { return coralCount; },
    set coralCount(v: number) { coralCount = v; },
    get layers() { return layers; },
    get stats() { return stats; },
    set stats(v: typeof stats) { stats = v; },
    get fishList() { return fishList; },
    get selectedFishIndex() { return selectedFishIndex; },
    get showOverlay() { return showOverlay; },
    set showOverlay(v: boolean) { showOverlay = v; },
    get activeMoodTrigger() { return activeMoodTrigger; },
    set activeMoodTrigger(v: FishMood | null) { activeMoodTrigger = v; },
    get activeWobbleTrigger() { return activeWobbleTrigger; },
    set activeWobbleTrigger(v: string | null) { activeWobbleTrigger = v; },
    get activeRareTrigger() { return activeRareTrigger; },
    set activeRareTrigger(v: string | null) { activeRareTrigger = v; },
    get selectedFish() { return selectedFish; },
    get statusCounters() { return statusCounters; },
    get statusChips() { return statusChips; },
    get huntStats() { return huntStats; },
    updateFishList,
    updateStats,
    selectNextFish,
    selectPrevFish,
    toggleLayer,
    enableAllLayers,
    setQualityLevel,
    stopAnimation,
    getBehaviorChipColor,
    getMoodChipColor,
  };
}

export type OceanLabState = ReturnType<typeof createOceanLabState>;
