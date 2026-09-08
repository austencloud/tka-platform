/**
 * What a per-step list has in force at a given step.
 *
 * `stepPlanes` needs nothing like this: the runtime owns a per-step setter
 * (`setStepHandPlane`), so the whole list is handed over once when the scene is
 * applied. Effect and effort have no per-step setter — `setEffect` and
 * `setEffort` set the whole performer — so the film has to decide, every frame,
 * which entry is current and write only when the answer changes.
 *
 * A list is a series of changes, not a series of moments: an entry stays in
 * force until the next one supersedes it, and before the first entry the
 * performer carries whatever the scene gave them.
 */
export interface DirectorStepChange<T> {
  step: number;
  value: T;
}

export function resolveStepChange<T>(
  entries: readonly DirectorStepChange<T>[],
  step: number,
  base: T
): T {
  if (!Number.isFinite(step)) return base;
  const current = Math.floor(step);
  let chosen: DirectorStepChange<T> | null = null;
  for (const entry of entries) {
    if (entry.step > current) continue;
    if (chosen === null || entry.step > chosen.step) chosen = entry;
  }
  return chosen === null ? base : chosen.value;
}

/**
 * Gap 17. A prop length is a number the runtime can land between, so its list
 * is read as a ramp rather than a series of switches. Each entry says how it
 * arrives: `cut` snaps at its step, `linear` (the default) slides there from
 * the previous entry across the counts between them.
 *
 * Before the first entry the prop keeps `base`, and a `linear` first entry
 * still ramps from `base`, because a director who says "grow to 200 by count 8"
 * means the growing to be visible.
 */
export interface DirectorStepRamp {
  step: number;
  value: number;
  ease: "cut" | "linear";
}

export function resolveStepRamp(
  entries: readonly DirectorStepRamp[],
  step: number,
  base: number
): number {
  if (!Number.isFinite(step) || entries.length === 0) return base;
  const ordered = [...entries].sort((a, b) => a.step - b.step);

  let previousStep = 0;
  let previousValue = base;
  for (const entry of ordered) {
    if (step >= entry.step) {
      previousStep = entry.step;
      previousValue = entry.value;
      continue;
    }
    if (entry.ease === "cut") return previousValue;
    const span = entry.step - previousStep;
    if (span <= 0) return entry.value;
    const travelled = Math.min(1, Math.max(0, (step - previousStep) / span));
    return previousValue + (entry.value - previousValue) * travelled;
  }
  return previousValue;
}
