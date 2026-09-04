/** Sections whose meaning and controls are shared by 2D Animation and Tunnel. */
export const SHARED_ANIMATOR_INSPECTOR_SECTIONS = [
  "effects",
  "props",
  "motion",
  "display",
] as const;

export type SharedAnimatorInspectorSection =
  (typeof SHARED_ANIMATOR_INSPECTOR_SECTIONS)[number];

function isSharedSection(
  section: string
): section is SharedAnimatorInspectorSection {
  return (SHARED_ANIMATOR_INSPECTOR_SECTIONS as readonly string[]).includes(
    section
  );
}

function normalizeSection(section: string): SharedAnimatorInspectorSection {
  if (section === "effort" || section === "playback") return "motion";
  return isSharedSection(section) ? section : "effects";
}

/**
 * Owns the inspector destination across the persistent 2D and Tunnel layers.
 *
 * A mode-only page (Tunnel Formation/Speed or 2D Export) remains selected when
 * returning to that mode. While it is unavailable, the other mode opens the
 * last page both modes share rather than inventing an unrelated destination.
 */
export function createViewerAnimatorInspectorState(initialSection: string) {
  let activeSection = $state(initialSection);
  let lastSharedSection = $state(normalizeSection(initialSection));

  function select(section: string): void {
    activeSection = section;
    if (isSharedSection(section)) lastSharedSection = section;
  }

  function resolve(availableSections: readonly string[]): string | null {
    if (availableSections.includes(activeSection)) return activeSection;
    if (availableSections.includes(lastSharedSection)) return lastSharedSection;
    if (availableSections.includes("effects")) return "effects";
    return availableSections[0] ?? null;
  }

  return {
    get activeSection() {
      return activeSection;
    },
    get lastSharedSection() {
      return lastSharedSection;
    },
    select,
    resolve,
  };
}

export type ViewerAnimatorInspectorState = ReturnType<
  typeof createViewerAnimatorInspectorState
>;
