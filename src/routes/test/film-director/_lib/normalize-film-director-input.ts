import { expandSceneInheritance } from "./expand-scene-inheritance";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function migrateLegacyCharacterField(
  value: unknown,
  location: string
): unknown {
  if (!isRecord(value)) return value;
  if ("avatarId" in value && "characterId" in value) {
    throw new Error(
      `${location} cannot contain both legacy "avatarId" and "characterId".`
    );
  }
  if (!("avatarId" in value)) return { ...value };

  const { avatarId, ...rest } = value;
  return { ...rest, characterId: avatarId };
}

function migrateLegacyHandFields(value: unknown, location: string): unknown {
  if (!isRecord(value)) return value;
  const migrated = { ...value };
  for (const [legacy, canonical] of [
    ["bluePlane", "leftPlane"],
    ["redPlane", "rightPlane"],
  ] as const) {
    if (legacy in migrated && canonical in migrated) {
      throw new Error(
        `${location} cannot contain both legacy "${legacy}" and "${canonical}".`
      );
    }
    if (legacy in migrated) {
      migrated[canonical] = migrated[legacy];
      delete migrated[legacy];
    }
  }
  return migrated;
}

function migrateLegacyPerformanceFields(
  performance: unknown,
  sceneIndex: number,
  options: { characters: boolean; hands: boolean }
): unknown {
  if (!isRecord(performance)) return performance;
  const migrate = (value: unknown, location: string): unknown => {
    let migrated = isRecord(value) ? { ...value } : value;
    if (options.characters) {
      migrated = migrateLegacyCharacterField(migrated, location);
    }
    if (options.hands) {
      migrated = migrateLegacyHandFields(migrated, location);
    }
    return migrated;
  };
  const migrated = { ...performance };
  if (Array.isArray(performance.performers)) {
    migrated.performers = performance.performers.map((performer, index) =>
      migrate(
        performer,
        `Film director scene ${sceneIndex + 1}, performer ${index + 1}`
      )
    );
  }
  if (isRecord(performance.cast)) {
    const cast = { ...performance.cast };
    if (cast.defaults !== undefined) {
      cast.defaults = migrate(
        cast.defaults,
        `Film director scene ${sceneIndex + 1}, cast defaults`
      );
    }
    if (Array.isArray(cast.performers)) {
      cast.performers = cast.performers.map((performer, index) =>
        migrate(
          performer,
          `Film director scene ${sceneIndex + 1}, cast performer ${index + 1}`
        )
      );
    }
    migrated.cast = cast;
  }
  return migrated;
}

export function normalizeFilmDirectorInput(raw: unknown): unknown {
  if (!isRecord(raw)) return raw;

  if ("shots" in raw && "scenes" in raw) {
    throw new Error(
      'Film director input cannot contain both "shots" and "scenes".'
    );
  }

  const normalized = { ...raw };
  const version =
    typeof raw.version === "number" ? raw.version : Number.POSITIVE_INFINITY;
  const migrateLegacyCharacters = version <= 3;
  const migrateLegacyHands = version <= 4;
  if (
    migrateLegacyHands &&
    isRecord(normalized.seed) &&
    isRecord(normalized.seed.axes)
  ) {
    normalized.seed = {
      ...normalized.seed,
      axes: migrateLegacyHandFields(
        normalized.seed.axes,
        "Film director seed axes"
      ),
    };
  }
  const units = "scenes" in raw ? raw.scenes : raw.shots;
  if (!Array.isArray(units)) {
    if ("shots" in raw) {
      normalized.scenes = units;
      delete normalized.shots;
    }
    return normalized;
  }

  normalized.scenes = units.map((unit, index) => {
    if (!isRecord(unit)) return unit;
    if ("scene" in unit && "location" in unit) {
      const unitLabel =
        typeof unit.id === "string" ? ` "${unit.id}"` : ` at index ${index}`;
      throw new Error(
        `Film director scene${unitLabel} cannot contain both "scene" and "location".`
      );
    }

    const normalizedUnit =
      "scene" in unit
        ? (() => {
            const { scene, ...withoutScene } = unit;
            return { ...withoutScene, location: scene };
          })()
        : { ...unit };

    // Versions 1-3 used avatarId. Versions 1-4 used color-named hand fields.
    // Both are normalized at this boundary and never reach the resolver.
    if (
      (migrateLegacyCharacters || migrateLegacyHands) &&
      "performance" in normalizedUnit
    ) {
      normalizedUnit.performance = migrateLegacyPerformanceFields(
        normalizedUnit.performance,
        index,
        { characters: migrateLegacyCharacters, hands: migrateLegacyHands }
      );
    }
    return normalizedUnit;
  });

  // Gap 13. Inheritance is the last thing the boundary does, so a child of a
  // legacy-spelled parent inherits the already-migrated fields.
  normalized.scenes = expandSceneInheritance(normalized.scenes as unknown[]);

  delete normalized.shots;
  return normalized;
}
