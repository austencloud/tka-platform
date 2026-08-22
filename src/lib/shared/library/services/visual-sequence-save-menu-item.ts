import type { ContextMenuItem } from "$lib/shared/components/context-menu/context-menu-types";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { VisualSequenceSaveIntent } from "$lib/shared/library/services/contracts/IVisualSequenceSaveCoordinator";

export function buildVisualSequenceSaveMenuItem(
  sequence: SequenceData,
  intent: VisualSequenceSaveIntent = {},
  onSaveToLibrary?: () => void | Promise<void>
): ContextMenuItem {
  return {
    id: "save-to-library",
    label: "Save to Library",
    icon: "fa-bookmark",
    disabled: !sequence.steps?.length,
    async action() {
      if (onSaveToLibrary) {
        await onSaveToLibrary();
        return;
      }
      const { getVisualSequenceSaveCoordinator } =
        await import("$lib/shared/library/get-visual-sequence-save-coordinator");
      const coordinator = await getVisualSequenceSaveCoordinator();
      await coordinator.save(sequence, intent);
    },
  };
}
