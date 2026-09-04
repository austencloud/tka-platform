/**
 * Gap 13. A callback shot is the same scene again with one thing changed.
 *
 * Before this, saying "same as the opening, but from behind" meant retyping
 * the whole scene: location, cast, sequences, blocking, and the camera, with
 * every copy free to drift from the original. `extends` names an EARLIER scene
 * in the same film and the child is deep-merged over it, so the diff on the
 * page is exactly the diff the director spoke.
 *
 * This runs at the input boundary, before validation, for two reasons. The
 * merged scene is what the schema should judge, so an inherited field is held
 * to the same rules as a stated one. And `title` can then be genuinely
 * optional on a child: by the time `sceneSchema` sees it, the parent's title
 * is already there.
 *
 * Merge rules, chosen so a director can both change and remove:
 *
 * - plain objects merge key by key, so a child restating `camera.position`
 *   keeps the parent's `camera.subject`;
 * - arrays replace wholesale, because half-overwriting an ordered list of
 *   moves or performers has no reading anyone would predict;
 * - an explicit `null` on the child deletes the parent's key. `null` is not a
 *   legal value anywhere in the grammar, so it is free to mean "drop this".
 *
 * `id` is always the child's own. Chains are allowed and cycles are
 * impossible: a scene may only extend one that already resolved above it.
 *
 * `seedAs` (gap 14) is validated here too. It obeys the same earlier-scene
 * rule and reads best beside the rule it copies, even though the resolver is
 * what finally consumes it.
 */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function deepMerge(
  parent: Record<string, unknown>,
  child: Record<string, unknown>
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...parent };
  for (const [key, value] of Object.entries(child)) {
    if (value === undefined) continue;
    if (value === null) {
      delete merged[key];
      continue;
    }
    const existing = merged[key];
    merged[key] =
      isRecord(existing) && isRecord(value) ? deepMerge(existing, value) : value;
  }
  return merged;
}

function sceneLabel(id: unknown, index: number): string {
  return typeof id === "string" && id.length > 0
    ? `"${id}"`
    : `at index ${index}`;
}

/**
 * The index of the earlier scene `reference` names, or a rejection that says
 * which scene spoke, which scene it named, and why that name does not work.
 */
function earlierSceneIndex(
  reference: unknown,
  verb: string,
  index: number,
  ids: readonly (string | undefined)[]
): number {
  const self = sceneLabel(ids[index], index);
  if (typeof reference !== "string" || reference.length === 0) {
    throw new Error(
      `Film director scene ${self} ${verb} a scene id, which is a non-empty string.`
    );
  }
  if (reference === ids[index]) {
    throw new Error(
      `Film director scene ${self} ${verb} itself. Name an earlier scene.`
    );
  }
  const found = ids.indexOf(reference);
  if (found < 0) {
    throw new Error(
      `Film director scene ${self} ${verb} "${reference}", which is not a scene in this film.`
    );
  }
  if (found > index) {
    throw new Error(
      `Film director scene ${self} ${verb} "${reference}", which comes later in the film. Name an earlier scene.`
    );
  }
  return found;
}

export function expandSceneInheritance(
  scenes: readonly unknown[]
): unknown[] {
  const ids = scenes.map((scene) =>
    isRecord(scene) && typeof scene.id === "string" ? scene.id : undefined
  );
  const expanded: unknown[] = [];

  scenes.forEach((scene, index) => {
    if (!isRecord(scene)) {
      expanded.push(scene);
      return;
    }

    let next: Record<string, unknown> = { ...scene };
    if (scene.extends !== undefined) {
      const parentIndex = earlierSceneIndex(
        scene.extends,
        "extends",
        index,
        ids
      );
      const parent = expanded[parentIndex];
      // The parent went through this same pass, so a chain is already flat by
      // the time the grandchild reads it.
      next = deepMerge(isRecord(parent) ? parent : {}, scene);
      next.id = scene.id;
      next.extends = scene.extends;
    }

    if (next.seedAs !== undefined) {
      earlierSceneIndex(next.seedAs, "seeds as", index, ids);
    }
    expanded.push(next);
  });

  return expanded;
}
