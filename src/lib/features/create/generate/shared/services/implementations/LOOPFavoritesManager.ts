/**
 * LOOPFavoritesManager - Manages user's favorite LOOP presets
 *
 * Persists favorites to localStorage for quick access across sessions.
 */

const STORAGE_KEY = "tka-loop-favorites";

/**
 * Manager for LOOP preset favorites
 * Uses localStorage for persistence
 */
export class LOOPFavoritesManager {
  /**
   * Get all favorite preset IDs
   */
  public getFavorites(): string[] {
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

  /**
   * Check if a preset is favorited
   */
  public isFavorite(presetId: string): boolean {
    return this.getFavorites().includes(presetId);
  }

  /**
   * Add a preset to favorites
   */
  public addFavorite(presetId: string): void {
    if (typeof window === "undefined") return;

    const favorites = this.getFavorites();
    if (!favorites.includes(presetId)) {
      favorites.push(presetId);
      this.saveFavorites(favorites);
    }
  }

  /**
   * Remove a preset from favorites
   */
  public removeFavorite(presetId: string): void {
    if (typeof window === "undefined") return;

    const favorites = this.getFavorites();
    const index = favorites.indexOf(presetId);
    if (index !== -1) {
      favorites.splice(index, 1);
      this.saveFavorites(favorites);
    }
  }

  /**
   * Toggle a preset's favorite status
   */
  public toggleFavorite(presetId: string): boolean {
    if (this.isFavorite(presetId)) {
      this.removeFavorite(presetId);
      return false;
    } else {
      this.addFavorite(presetId);
      return true;
    }
  }

  /**
   * Save favorites to localStorage
   */
  private saveFavorites(favorites: string[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
    } catch {
      // localStorage might be full or unavailable
      console.warn("Failed to save LOOP favorites to localStorage");
    }
  }
}

// Singleton instance
export const loopFavoritesManager = new LOOPFavoritesManager();
