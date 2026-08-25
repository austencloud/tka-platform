function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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

    if (!("scene" in unit)) return { ...unit };
    const { scene, ...normalizedUnit } = unit;
    return { ...normalizedUnit, location: scene };
  });

  delete normalized.shots;
  return normalized;
}
