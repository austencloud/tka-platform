/**
 * QuickAccessPersister - LocalStorage-backed quick access user management
 *
 * Manages the list of users that admins have bookmarked for quick preview access.
 * Uses localStorage for persistence across sessions.
 */

import type { QuickAccessUser } from "./types";

const STORAGE_KEY = "tka-quick-access-users";

export class QuickAccessPersister {
  private cache: QuickAccessUser[] | null = null;

  load(): QuickAccessUser[] {
    if (this.cache !== null) {
      return this.cache;
    }

    if (typeof localStorage === "undefined") {
      this.cache = [];
      return this.cache;
    }

    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      const parsed: QuickAccessUser[] = saved ? JSON.parse(saved) : [];
      this.cache = parsed;
      return parsed;
    } catch {
      const empty: QuickAccessUser[] = [];
      this.cache = empty;
      return empty;
    }
  }

  save(users: QuickAccessUser[]): void {
    this.cache = users;

    if (typeof localStorage === "undefined") {
      return;
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
  }

  add(user: QuickAccessUser): QuickAccessUser[] {
    const users = this.load();

    // Don't add duplicates
    if (users.some((u) => u.uid === user.uid)) {
      return users;
    }

    const updated = [...users, user];
    this.save(updated);
    return updated;
  }

  remove(uid: string): QuickAccessUser[] {
    const users = this.load();
    const updated = users.filter((u) => u.uid !== uid);
    this.save(updated);
    return updated;
  }

  has(uid: string): boolean {
    const users = this.load();
    return users.some((u) => u.uid === uid);
  }
}
