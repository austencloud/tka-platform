import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { ViewerNavMode } from "$lib/shared/3d/state/viewer-3d-state.svelte";

export function createCovenHubState() {
  let activeSequence = $state<SequenceData | null>(null);
  let pickerOpen = $state(true);
  let navMode = $state<ViewerNavMode>("orbit");
  let focusedEffect = $state<string | null>(null);

  return {
    get activeSequence() { return activeSequence; },
    get pickerOpen() { return pickerOpen; },
    get navMode() { return navMode; },
    get focusedEffect() { return focusedEffect; },

    setSequence(seq: SequenceData) {
      activeSequence = seq;
      pickerOpen = false;
    },
    openPicker() { pickerOpen = true; },
    closePicker() { pickerOpen = false; },
    setNavMode(mode: ViewerNavMode) { navMode = mode; },
    setFocusedEffect(id: string | null) { focusedEffect = id; },
  };
}
