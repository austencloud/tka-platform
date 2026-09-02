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
