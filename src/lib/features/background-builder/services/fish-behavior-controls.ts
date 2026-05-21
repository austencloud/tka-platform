import type {
  FishMarineLife,
  FishMood,
  OceanBackgroundOrchestrator,
} from "@austencloud/backgrounds";

export type ColorPreset = "default" | "cyan" | "blue" | "lime" | "amber" | "rose" | "emerald" | "red" | "gray";

export const moodOptions: { mood: FishMood; label: string; icon: string; color: ColorPreset }[] = [
  { mood: "calm", label: "Calm", icon: "water", color: "cyan" },
  { mood: "curious", label: "Curious", icon: "search", color: "default" },
  { mood: "alert", label: "Alert", icon: "exclamation", color: "amber" },
  { mood: "playful", label: "Playful", icon: "star", color: "emerald" },
  { mood: "tired", label: "Tired", icon: "bed", color: "gray" },
  { mood: "social", label: "Social", icon: "users", color: "rose" },
];

export const wobbleOptions: { type: NonNullable<FishMarineLife["wobbleType"]>; label: string; icon: string; color: ColorPreset }[] = [
  { type: "curious_tilt", label: "Curious", icon: "search", color: "blue" },
  { type: "startled_dart", label: "Startle", icon: "bolt", color: "amber" },
  { type: "playful_wiggle", label: "Wiggle", icon: "star", color: "emerald" },
  { type: "tired_drift", label: "Drift", icon: "bed", color: "gray" },
];

export const rareBehaviorOptions: { type: string; label: string; icon: string; color: ColorPreset }[] = [
  { type: "barrel_roll", label: "Roll", icon: "sync", color: "cyan" },
  { type: "freeze", label: "Freeze", icon: "snowflake", color: "blue" },
  { type: "double_take", label: "Look", icon: "eye", color: "amber" },
  { type: "happy_flip", label: "Flip", icon: "arrow-up", color: "emerald" },
  { type: "sync_swim", label: "Sync", icon: "link", color: "rose" },
];

export function getMoodColor(mood: FishMood): string {
  switch (mood) {
    case "calm": return "#22d3ee";
    case "curious": return "#a855f7";
    case "alert": return "#f59e0b";
    case "playful": return "#22c55e";
    case "hungry": return "#ef4444";
    case "tired": return "#6b7280";
    case "social": return "#ec4899";
    default: return "#ffffff";
  }
}

export function triggerMood(
  backgroundSystem: OceanBackgroundOrchestrator | null,
  selectedFishIndex: number,
  mood: FishMood,
): boolean {
  const actualFish = backgroundSystem?.getFish?.();
  if (!actualFish || actualFish.length === 0) return false;

  const f = actualFish[selectedFishIndex];
  if (!f) return false;

  f.mood = mood;
  f.moodTimer = 0;
  (f as unknown as Record<string, unknown>)._manualMoodSetAt = performance.now();
  return true;
}

export function triggerWobble(
  backgroundSystem: OceanBackgroundOrchestrator | null,
  selectedFishIndex: number,
  wobbleType: FishMarineLife["wobbleType"],
): boolean {
  const actualFish = backgroundSystem?.getFish?.();
  if (!actualFish || actualFish.length === 0) return false;

  const f = actualFish[selectedFishIndex];
  if (!f) return false;

  f.wobbleType = wobbleType;
  f.wobbleTimer = 1.2;
  f.wobbleIntensity = 1;
  return true;
}

export function triggerRareBehavior(
  backgroundSystem: OceanBackgroundOrchestrator | null,
  selectedFishIndex: number,
  type: string,
): boolean {
  const actualFish = backgroundSystem?.getFish?.();
  if (!actualFish || actualFish.length === 0) return false;

  const f = actualFish[selectedFishIndex];
  if (!f) return false;

  let partner: FishMarineLife | undefined;
  if (type === "sync_swim") {
    partner = actualFish.find((_other, idx) => idx !== selectedFishIndex);
  }

  const wobbleType = type as FishMarineLife["wobbleType"];
  f.wobbleType = wobbleType;
  f.wobbleTimer = type === "barrel_roll" ? 0.8 : type === "freeze" ? 0.6 : 0.5;
  f.wobbleIntensity = 1;

  if (partner && type === "sync_swim") {
    partner.wobbleType = "sync_pulse";
    partner.wobbleTimer = 0.4;
    partner.wobbleIntensity = 0.8;
  }

  return true;
}

export function forceHuntOnSelected(
  backgroundSystem: OceanBackgroundOrchestrator | null,
  selectedFishIndex: number,
): void {
  const actualFish = backgroundSystem?.getFish?.();
  if (!actualFish || actualFish.length < 2) return;

  const fishAnimator = backgroundSystem?.getFishAnimator?.();
  if (!fishAnimator) return;

  const huntingHandler = fishAnimator.getHuntingHandler?.();
  if (!huntingHandler) return;

  const selected = actualFish[selectedFishIndex];
  if (!selected) return;

  if (huntingHandler.isPredator(selected)) {
    const prey = actualFish.find((f) => huntingHandler.isPrey(f) && f !== selected);
    if (prey) {
      huntingHandler.forceHunt(selected, prey, performance.now() / 1000);
    }
  } else if (huntingHandler.isPrey(selected)) {
    const predator = actualFish.find((f) => huntingHandler.isPredator(f) && f !== selected);
    if (predator) {
      huntingHandler.forceHunt(predator, selected, performance.now() / 1000);
    }
  }
}

export function spawnFish(
  backgroundSystem: OceanBackgroundOrchestrator | null,
  canvas: HTMLCanvasElement | null,
): void {
  if (!backgroundSystem || !canvas) return;
  const dimensions = { width: canvas.width, height: canvas.height };
  const fishAnimator = backgroundSystem.getFishAnimator();
  const newFish = fishAnimator.createFish(dimensions, true, true);
  backgroundSystem.getFish().push(newFish);
}

export function spawnJellyfish(
  backgroundSystem: OceanBackgroundOrchestrator | null,
  canvas: HTMLCanvasElement | null,
): void {
  if (!backgroundSystem || !canvas) return;
  const dimensions = { width: canvas.width, height: canvas.height };
  const jellyfishAnimator = backgroundSystem.getJellyfishAnimator();
  const newJellyfish = jellyfishAnimator.createJellyfish(dimensions);
  backgroundSystem.getJellyfish().push(newJellyfish);
}
