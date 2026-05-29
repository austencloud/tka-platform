import type { AnimationEngine } from "$lib/shared/animation-engine/services/animation-engine.svelte";
import type { PerformerManager } from "$lib/shared/3d/state/performer-manager.svelte";
import type { EffortId } from "$lib/shared/effort/domain/effort-types";

export function installPerformerEffortResolver(
  engine: Pick<AnimationEngine, "setPerformerEffortResolver">,
  performerManager: Pick<PerformerManager, "performers">,
): void {
  engine.setPerformerEffortResolver((id: string): EffortId => {
    const p = performerManager.performers.find((p) => p.id === id);
    return p?.effectiveEffortId ?? "linear";
  });
}
