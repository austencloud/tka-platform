import {
  DEFAULT_VIEWER_CUSTOM_COLORS,
  resolveViewerCustomColorPair,
  viewerCustomColorPairsEqual,
  type ViewerCustomColorPair,
} from "../domain/viewer-custom-colors";

export const VIEWER_CUSTOM_COLORS_STORAGE_KEY = "tka_viewer_custom_colors";
export const STAGED_VIEWER_CUSTOM_COLORS_STORAGE_KEY =
  "tka_staged_viewer_custom_colors";

const TUNNEL_VIEW_STORAGE_KEY = "tka_tunnel_view_state";
const MANDALA_VIEW_STORAGE_KEY = "tka_mandala_view_state";
const PREFERENCE_VERSION = 1;
const LEGACY_MANDALA_DEFAULTS: ViewerCustomColorPair = {
  left: "#4fc3f7",
  right: "#ef5350",
};

type ReadStorage = Pick<Storage, "getItem">;
type WriteStorage = Pick<Storage, "setItem">;
type ConsumeStorage = Pick<Storage, "getItem" | "removeItem">;

function parseJson(storage: ReadStorage, key: string): unknown {
  try {
    const raw = storage.getItem(key);
    return raw ? (JSON.parse(raw) as unknown) : null;
  } catch {
    return null;
  }
}

function parsedPair(value: unknown): ViewerCustomColorPair | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as { left?: unknown; right?: unknown };
  if (typeof candidate.left !== "string" || typeof candidate.right !== "string") {
    return null;
  }
  return resolveViewerCustomColorPair(candidate);
}

function canonicalPair(storage: ReadStorage): ViewerCustomColorPair | null {
  const value = parseJson(storage, VIEWER_CUSTOM_COLORS_STORAGE_KEY);
  if (!value || typeof value !== "object") return null;
  const record = value as { version?: unknown; colors?: unknown };
  return record.version === PREFERENCE_VERSION
    ? parsedPair(record.colors)
    : null;
}

function legacyTunnelPair(storage: ReadStorage): ViewerCustomColorPair | null {
  const value = parseJson(storage, TUNNEL_VIEW_STORAGE_KEY);
  if (!value || typeof value !== "object") return null;
  const colors = (value as { colors?: unknown }).colors;
  if (!colors || typeof colors !== "object") return null;
  return parsedPair((colors as { custom?: unknown }).custom);
}

function legacyMandalaPair(storage: ReadStorage): ViewerCustomColorPair | null {
  const value = parseJson(storage, MANDALA_VIEW_STORAGE_KEY);
  if (!value || typeof value !== "object") return null;
  const view = value as { customLeft?: unknown; customRight?: unknown };
  return parsedPair({ left: view.customLeft, right: view.customRight });
}

function chooseLegacyPair(
  tunnel: ViewerCustomColorPair | null,
  mandala: ViewerCustomColorPair | null
): ViewerCustomColorPair {
  const tunnelAuthored =
    tunnel &&
    !viewerCustomColorPairsEqual(tunnel, DEFAULT_VIEWER_CUSTOM_COLORS);
  const mandalaAuthored =
    mandala && !viewerCustomColorPairsEqual(mandala, LEGACY_MANDALA_DEFAULTS);

  if (tunnelAuthored && !mandalaAuthored) return tunnel;
  if (mandalaAuthored && !tunnelAuthored) return mandala;
  if (tunnelAuthored && mandalaAuthored) return tunnel;
  return tunnel ?? mandala ?? { ...DEFAULT_VIEWER_CUSTOM_COLORS };
}

export function saveViewerCustomColorPreference(
  colors: ViewerCustomColorPair,
  storage: WriteStorage | null = typeof localStorage === "undefined"
    ? null
    : localStorage
): void {
  if (!storage) return;
  try {
    storage.setItem(
      VIEWER_CUSTOM_COLORS_STORAGE_KEY,
      JSON.stringify({
        version: PREFERENCE_VERSION,
        colors: resolveViewerCustomColorPair(colors),
      })
    );
  } catch {
    // The live state still works when browser storage is unavailable.
  }
}

export function loadViewerCustomColorPreference(
  storage: (ReadStorage & WriteStorage) | null = typeof localStorage ===
  "undefined"
    ? null
    : localStorage,
  persistMigration = true
): ViewerCustomColorPair {
  if (!storage) return { ...DEFAULT_VIEWER_CUSTOM_COLORS };
  const canonical = canonicalPair(storage);
  if (canonical) return canonical;

  const migrated = chooseLegacyPair(
    legacyTunnelPair(storage),
    legacyMandalaPair(storage)
  );
  if (persistMigration) saveViewerCustomColorPreference(migrated, storage);
  return migrated;
}

export function ensureViewerCustomColorPreference(
  storage: (ReadStorage & WriteStorage) | null = typeof localStorage ===
  "undefined"
    ? null
    : localStorage
): ViewerCustomColorPair {
  return loadViewerCustomColorPreference(storage, true);
}

export function stageViewerCustomColors(
  colors: ViewerCustomColorPair,
  storage: WriteStorage | null = typeof sessionStorage === "undefined"
    ? null
    : sessionStorage
): void {
  if (!storage) return;
  try {
    storage.setItem(
      STAGED_VIEWER_CUSTOM_COLORS_STORAGE_KEY,
      JSON.stringify(resolveViewerCustomColorPair(colors))
    );
  } catch {
    // The saved tunnel can still open; only the one-use handoff is unavailable.
  }
}

export function consumeStagedViewerCustomColors(
  storage: ConsumeStorage | null = typeof sessionStorage === "undefined"
    ? null
    : sessionStorage
): ViewerCustomColorPair | null {
  if (!storage) return null;
  try {
    const colors = parsedPair(
      parseJson(storage, STAGED_VIEWER_CUSTOM_COLORS_STORAGE_KEY)
    );
    storage.removeItem(STAGED_VIEWER_CUSTOM_COLORS_STORAGE_KEY);
    return colors;
  } catch {
    return null;
  }
}
