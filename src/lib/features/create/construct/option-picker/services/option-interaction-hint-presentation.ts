import type { OptionInteractionHintPresentation } from "../state/option-interaction-hint-state.svelte";

export const ROOMY_OPTION_PICKER_WIDTH = 1536;

export function selectOptionInteractionHintPresentation({
  isSideBySide,
  pickerWidth,
}: {
  isSideBySide: boolean;
  pickerWidth: number;
}): OptionInteractionHintPresentation {
  return isSideBySide && pickerWidth >= ROOMY_OPTION_PICKER_WIDTH
    ? "anchored"
    : "workspace-banner";
}
