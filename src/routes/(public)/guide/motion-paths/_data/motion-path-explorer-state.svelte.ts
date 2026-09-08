import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import { createAnimationScope } from "$lib/shared/animation-engine/state/animation-scope.svelte";
import { applySequencePathPreview } from "$lib/shared/sequence-viewer/services/sequence-path-policy";
import type { AnimationPathPolicy } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";
import type { MandalaPathShape } from "$lib/shared/mandala/domain/mandala-types";
import { motionPathExamples } from "./motion-path-examples";

export function createMotionPathExplorerState() {
  const scope = createAnimationScope({ persistence: "ephemeral" });
  scope.visibility.setDarkMode(true);
  scope.visibility.setVisibility("leftPathLines", true);
  scope.visibility.setVisibility("rightPathLines", true);
  let original = $state<SequenceData>(motionPathExamples[2]!);
  let example = $state("mixed");
  let policy = $state<AnimationPathPolicy>({
    pathShape: "arc",
    motionAwarePaths: false,
  });
  let trace = $state<"hands" | "tips">("tips");
  let guides = $state(true);
  let playing = $state(false);
  let liveStep = $state(0);
  const variants = $derived(
    Object.fromEntries(
      (["arc", "linear", "concave", "hybrid"] as const).map((path) => [
        path,
        applySequencePathPreview(original, {
          pathShape: path === "hybrid" ? policy.pathShape : path,
          motionAwarePaths: path === "hybrid",
        })!,
      ])
    ) as Record<MandalaPathShape, SequenceData>
  );
  const selectedPath = $derived<MandalaPathShape>(
    policy.motionAwarePaths ? "hybrid" : policy.pathShape
  );
  // The inline player's load identity includes this variant so authored per-step
  // exceptions cannot keep a previous path alive after choosing another one.
  const sequence = $derived({
    ...variants[selectedPath],
    id: `${original.id}-${selectedPath}`,
  });
  return {
    scope,
    get sequence() {
      return sequence;
    },
    get variants() {
      return variants;
    },
    get example() {
      return example;
    },
    get selectedPath() {
      return selectedPath;
    },
    get trace() {
      return trace;
    },
    set trace(value: "hands" | "tips") {
      trace = value;
    },
    get guides() {
      return guides;
    },
    get playing() {
      return playing;
    },
    set playing(value: boolean) {
      playing = value;
    },
    get liveStep() {
      return liveStep;
    },
    set liveStep(value: number) {
      liveStep = value;
    },
    syncPolicy() {
      policy = scope.visibility.getPathPolicy();
    },
    chooseExample(value: string) {
      const index = ({ pro: 0, anti: 1, mixed: 2 } as Record<string, number>)[
        value
      ];
      if (index === undefined) return;
      original = motionPathExamples[index]!;
      example = value;
      liveStep = 0;
    },
    chooseSequence(value: SequenceData) {
      original = value;
      example = "custom";
      liveStep = 0;
    },
    toggleGuides() {
      guides = !guides;
      scope.visibility.setVisibility("leftPathLines", guides);
      scope.visibility.setVisibility("rightPathLines", guides);
    },
  };
}
