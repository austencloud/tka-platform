/**
 * LOOPFavoritesManager — Manages user's favorite LOOP presets.
 *
 * Persists favorites to localStorage for quick access across sessions.
 */

const STORAGE_KEY = "tka-loop-favorites";

export function getFavorites(): string[] {
  if (typeof window === "undefined") return [];

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function isFavorite(presetId: string): boolean {
  return getFavorites().includes(presetId);
}

export function addFavorite(presetId: string): void {
  if (typeof window === "undefined") return;

  const favorites = getFavorites();
  if (!favorites.includes(presetId)) {
    favorites.push(presetId);
    saveFavorites(favorites);
  }
}

export function removeFavorite(presetId: string): void {
  if (typeof window === "undefined") return;

  const favorites = getFavorites();
  const index = favorites.indexOf(presetId);
  if (index !== -1) {
    favorites.splice(index, 1);
    saveFavorites(favorites);
  }
}

export function toggleFavorite(presetId: string): boolean {
  if (isFavorite(presetId)) {
    removeFavorite(presetId);
    return false;
  } else {
    addFavorite(presetId);
    return true;
  }
}

function saveFavorites(favorites: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
  } catch {
    // localStorage might be full or unavailable
    console.warn("Failed to save LOOP favorites to localStorage");
  }
}

/**
 * Drop-in replacement for the old singleton — keeps all call-sites working
 * without changes.
 */
export const loopFavoritesManager = {
  getFavorites,
  isFavorite,
  addFavorite,
  removeFavorite,
  toggleFavorite,
};
