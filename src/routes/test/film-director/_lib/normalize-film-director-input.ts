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

function migrateLegacyPerformanceCharacters(
  performance: unknown,
  sceneIndex: number
): unknown {
  if (!isRecord(performance)) return performance;
  const migrated = { ...performance };
  if (Array.isArray(performance.performers)) {
    migrated.performers = performance.performers.map((performer, index) =>
      migrateLegacyCharacterField(
        performer,
        `Film director scene ${sceneIndex + 1}, performer ${index + 1}`
      )
    );
  }
  if (isRecord(performance.cast)) {
    const cast = { ...performance.cast };
    if (cast.defaults !== undefined) {
      cast.defaults = migrateLegacyCharacterField(
        cast.defaults,
        `Film director scene ${sceneIndex + 1}, cast defaults`
      );
    }
    if (Array.isArray(cast.performers)) {
      cast.performers = cast.performers.map((performer, index) =>
        migrateLegacyCharacterField(
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

    // Versions 1-3 authored the visible model as `avatarId`. Version 4 makes
    // `characterId` canonical; the old spelling is accepted only at this
    // migration boundary, never inside the resolver or output model.
    if (raw.version !== 4 && "performance" in normalizedUnit) {
      normalizedUnit.performance = migrateLegacyPerformanceCharacters(
        normalizedUnit.performance,
        index
      );
    }
    return normalizedUnit;
  });

  delete normalized.shots;
  return normalized;
}
