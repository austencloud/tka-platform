/**
 * CommandPalette Implementation
 *
 * Manages the command palette (Cmd+K) functionality.
 * Provides command registration, fuzzy search, and execution.
 *
 * Domain: Keyboard Shortcuts - Command Palette
 */

import type { CommandPaletteItem } from "../domain/types/keyboard-types";

export class CommandPalette {
  private commands: Map<string, CommandPaletteItem> = new Map();
  private recentCommandIds: string[] = [];
  private readonly MAX_RECENT = 10;

  registerCommand(command: CommandPaletteItem): void {
    this.commands.set(command.id, command);
  }

  unregisterCommand(id: string): void {
    this.commands.delete(id);
    this.recentCommandIds = this.recentCommandIds.filter(
      (cmdId) => cmdId !== id
    );
  }

  getAllCommands(): CommandPaletteItem[] {
    return Array.from(this.commands.values());
  }

  getAvailableCommands(): CommandPaletteItem[] {
    return this.getAllCommands().filter((cmd) => cmd.available);
  }

  search(query: string): CommandPaletteItem[] {
    if (!query.trim()) {
      // Return recent commands if no query
      return this.getRecentCommands();
    }

    const normalizedQuery = query.toLowerCase().trim();
    const results: CommandPaletteItem[] = [];

    for (const command of this.commands.values()) {
      // Only search available commands
      if (!command.available) continue;

      // Calculate relevance score
      const score = this.calculateRelevance(command, normalizedQuery);

      if (score > 0) {
        results.push({ ...command, score });
      }
    }

    // Sort by score (highest first)
    return results.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  }

  async executeCommand(id: string): Promise<void> {
    const command = this.commands.get(id);

    if (!command) {
      throw new Error(`Command with ID "${id}" not found`);
    }

    if (!command.available) {
      throw new Error(`Command "${id}" is not available in current context`);
    }

    // Track usage
    this.trackUsage(id);

    // Execute the command
    await command.action();
  }

  getRecentCommands(limit: number = this.MAX_RECENT): CommandPaletteItem[] {
    const recent: CommandPaletteItem[] = [];

    for (const id of this.recentCommandIds.slice(0, limit)) {
      const command = this.commands.get(id);
      if (command?.available) {
        recent.push(command);
      }
    }

    return recent;
  }

  trackUsage(id: string): void {
    // Remove if already in recent
    this.recentCommandIds = this.recentCommandIds.filter(
      (cmdId) => cmdId !== id
    );

    // Add to front
    this.recentCommandIds.unshift(id);

    // Keep only MAX_RECENT items
    if (this.recentCommandIds.length > this.MAX_RECENT) {
      this.recentCommandIds = this.recentCommandIds.slice(0, this.MAX_RECENT);
    }
  }

  /**
   * Calculate relevance score for fuzzy search
   * Higher score = better match
   */
  private calculateRelevance(
    command: CommandPaletteItem,
    query: string
  ): number {
    let score = 0;

    // Exact label match (highest priority)
    if (command.label.toLowerCase() === query) {
      score += 1000;
    }

    // Label starts with query
    if (command.label.toLowerCase().startsWith(query)) {
      score += 500;
    }

    // Label contains query
    if (command.label.toLowerCase().includes(query)) {
      score += 100;
    }

    // Description contains query
    if (command.description?.toLowerCase().includes(query)) {
      score += 50;
    }

    // Keywords match
    for (const keyword of command.keywords) {
      if (keyword.toLowerCase() === query) {
        score += 200;
      } else if (keyword.toLowerCase().startsWith(query)) {
        score += 100;
      } else if (keyword.toLowerCase().includes(query)) {
        score += 50;
      }
    }

    // Fuzzy match bonus (characters in order)
    if (this.fuzzyMatch(command.label.toLowerCase(), query)) {
      score += 25;
    }

    return score;
  }

  /**
   * Check if query characters appear in order in the target string
   * Example: "crt" matches "Create"
   */
  private fuzzyMatch(target: string, query: string): boolean {
    let queryIndex = 0;

    for (const char of target) {
      if (char === query[queryIndex]) {
        queryIndex++;
        if (queryIndex === query.length) {
          return true;
        }
      }
    }

    return queryIndex === query.length;
  }
}
