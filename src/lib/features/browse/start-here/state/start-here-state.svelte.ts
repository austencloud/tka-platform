export type StartHereStep =
  | "decide"
  | "base-families"
  | "base-cards"
  | "loop-types"
  | "loop-cards"
  | "browse-all";

export type StartHereTrack = "base" | "loop";

/**
 * Step machine for the gallery "Start here" onboarding surface.
 *
 * Flow:
 *   decide ──chooseBase──▶ base-families ──selectFamily──▶ base-cards
 *          └─chooseLoop──▶ loop-types     ──selectLoopType─▶ loop-cards
 * `back()` walks one step toward `decide`, clearing the selection it leaves.
 */
export function createStartHereState() {
  let step = $state<StartHereStep>("decide");
  let track = $state<StartHereTrack | null>(null);
  let familyId = $state<string | null>(null);
  let loopType = $state<string | null>(null);

  function chooseBase() {
    track = "base";
    step = "base-families";
  }
  function chooseLoop() {
    track = "loop";
    step = "loop-types";
  }
  function selectFamily(id: string) {
    familyId = id;
    step = "base-cards";
  }
  function selectLoopType(type: string) {
    loopType = type;
    step = "loop-cards";
  }
  function browseAll() {
    step = "browse-all";
  }
  function back() {
    switch (step) {
      case "base-cards":
        familyId = null;
        step = "base-families";
        break;
      case "loop-cards":
        loopType = null;
        step = "loop-types";
        break;
      case "base-families":
      case "loop-types":
      case "browse-all":
        track = null;
        step = "decide";
        break;
      case "decide":
        break;
    }
  }

  return {
    get step() { return step; },
    get track() { return track; },
    get familyId() { return familyId; },
    get loopType() { return loopType; },
    chooseBase,
    chooseLoop,
    selectFamily,
    selectLoopType,
    browseAll,
    back,
  };
}
