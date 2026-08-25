import type { Formation } from "./stage-types";

/**
 * Which set the editor is working on.
 *
 * Selecting a set on the timeline pins it. With nothing pinned the editor
 * follows the playhead, so scrubbing walks the drill chart, the properties
 * panel and the preset picker through the show together. The chart, the
 * sidebar and the properties panel all ask this so they cannot disagree about
 * which set is on screen.
 *
 * Returns -1 only when there are no formations at all, which the invariants
 * make impossible for a live document.
 */
export function resolveActiveFormationIndex(
  formations: readonly Formation[],
  selectedFormationId: string | null,
  beat: number
): number {
  if (formations.length === 0) return -1;

  if (selectedFormationId) {
    const pinned = formations.findIndex(
      (formation) => formation.id === selectedFormationId
    );
    if (pinned >= 0) return pinned;
  }

  let index = 0;
  for (let i = 0; i < formations.length; i += 1) {
    if (formations[i]!.atBeat <= beat) index = i;
  }
  return index;
}
