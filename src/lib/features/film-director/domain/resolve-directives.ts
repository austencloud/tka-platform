import {
  normalizeDirective,
  type DirectiveValue,
  type NormalizedDirective,
} from "./directives";
import { seededShuffle } from "./directive-random";

export interface CastAxisInput<T extends string | number> {
  axis: string;
  sceneId: string;
  performerIds: readonly string[];
  values: readonly DirectiveValue<T>[];
  catalog: readonly T[] | null;
  random: () => number;
}

export function resolveCastAxis<T extends string | number>(
  input: CastAxisInput<T>
): T[] {
  const { axis, sceneId, performerIds, values, catalog, random } = input;
  const where = `Scene "${sceneId}", axis "${axis}"`;
  const normalized = values.map((value) => normalizeDirective(value));
  const resolved = new Array<T | undefined>(values.length);
  const taken = new Set<T>();

  normalized.forEach((directive, index) => {
    if (directive.kind !== "literal") return;
    assertInCatalog(directive.literal, catalog, where);
    resolved[index] = directive.literal;
    taken.add(directive.literal);
  });

  const deck = catalog ? seededShuffle(catalog, random) : null;
  let cursor = 0;
  const draw = (pool: readonly T[], exclude: ReadonlySet<T>): T | undefined => {
    const poolSet = new Set(pool);
    if (deck && pool === catalog) {
      for (let step = 0; step < deck.length; step += 1) {
        const candidate = deck[(cursor + step) % deck.length]!;
        if (!exclude.has(candidate)) {
          cursor = (cursor + step + 1) % deck.length;
          return candidate;
        }
      }
      return undefined;
    }
    return seededShuffle([...poolSet], random).find(
      (candidate) => !exclude.has(candidate)
    );
  };

  const distinctCount = normalized.filter(
    (candidate) => candidate.kind === "pick" && candidate.distinct
  ).length;

  normalized.forEach((directive, index) => {
    if (directive.kind !== "pick") return;
    const pool = resolvePool(directive, catalog, where);
    const exclude = new Set<T>(directive.exclude);
    for (const value of exclude) assertInCatalog(value, catalog, where);
    for (const value of pool) assertInCatalog(value, catalog, where);
    if (directive.distinct) for (const value of taken) exclude.add(value);

    const candidates = pool.filter((value) => !exclude.has(value));
    if (candidates.length === 0) {
      if (directive.distinct) {
        const staticExclude = new Set<T>(directive.exclude);
        const postExclusionPool = pool.filter(
          (value) => !staticExclude.has(value)
        );
        const excludedFromPool = pool.filter((value) =>
          staticExclude.has(value)
        );
        const poolClause =
          excludedFromPool.length > 0
            ? `${postExclusionPool.length} (${postExclusionPool.join(", ")}) after excluding ${excludedFromPool.join(", ")}`
            : `${postExclusionPool.length} (${postExclusionPool.join(", ")})`;
        throw new Error(
          `${where}: distinct values were requested for ${distinctCount} performers but the allowed pool has only ${poolClause}.`
        );
      }
      throw new Error(
        `${where}: the directive for "${performerIds[index]}" excludes every allowed value.`
      );
    }
    const pick =
      pool === catalog
        ? draw(pool, exclude)
        : seededShuffle(candidates, random)[0];
    if (pick === undefined) {
      throw new Error(
        `${where}: internal error — no value drawn despite non-empty candidates.`
      );
    }
    resolved[index] = pick;
    if (directive.distinct) taken.add(pick);
  });

  resolveSameAs(normalized, resolved, performerIds, where);
  return resolved as T[];
}

function resolvePool<T extends string | number>(
  directive: Extract<NormalizedDirective<T>, { kind: "pick" }>,
  catalog: readonly T[] | null,
  where: string
): readonly T[] {
  if (directive.pool) return directive.pool;
  if (!catalog) {
    throw new Error(
      `${where}: this axis has no finite catalog — provide "from" with explicit values.`
    );
  }
  return catalog;
}

function assertInCatalog<T extends string | number>(
  value: T,
  catalog: readonly T[] | null,
  where: string
): void {
  if (catalog && !catalog.includes(value)) {
    throw new Error(
      `${where}: "${String(value)}" is not in the deployed catalog for this axis.`
    );
  }
}

function resolveSameAs<T extends string | number>(
  normalized: readonly NormalizedDirective<T>[],
  resolved: (T | undefined)[],
  performerIds: readonly string[],
  where: string
): void {
  const pending = normalized
    .map((directive, index) => ({ directive, index }))
    .filter(
      (
        entry
      ): entry is {
        directive: Extract<NormalizedDirective<T>, { kind: "sameAs" }>;
        index: number;
      } => entry.directive.kind === "sameAs"
    );

  let remaining = pending.length;
  while (remaining > 0) {
    let progressed = false;
    for (const entry of pending) {
      if (resolved[entry.index] !== undefined) continue;
      const source = entry.directive.sameAs;
      const sourceIndex = performerIds.indexOf(source);
      if (sourceIndex === -1) {
        throw new Error(
          `${where}: sameAs references "${source}", which is not in this cast.`
        );
      }
      const value = resolved[sourceIndex];
      if (value === undefined) continue;
      resolved[entry.index] = value;
      remaining -= 1;
      progressed = true;
    }
    if (!progressed) {
      const stuck = pending
        .filter((entry) => resolved[entry.index] === undefined)
        .map((entry) => performerIds[entry.index])
        .join(", ");
      throw new Error(`${where}: sameAs forms a cycle involving ${stuck}.`);
    }
  }
}
