/**
 * ICommandPalette Contract
 *
 * Manages the command palette (Cmd+K) functionality.
 * Provides command registration, search, and execution.
 *
 * Domain: Keyboard Shortcuts - Command Palette
 */

import type { CommandPaletteItem } from "../../domain/types/keyboard-types";

export interface ICommandPalette {
  /**
   * Register a command in the palette
   * @param command Command to register
   */
  registerCommand(command: CommandPaletteItem): void;

  /**
   * Unregister a command
   * @param id Command ID
   */
  unregisterCommand(id: string): void;

  /**
   * Get all commands
   */
  getAllCommands(): CommandPaletteItem[];

  /**
   * Get available commands (context-aware)
   */
  getAvailableCommands(): CommandPaletteItem[];

  /**
   * Search commands by query
   * @param query Search query
   * @returns Sorted results by relevance
   */
  search(query: string): CommandPaletteItem[];

  /**
   * Execute a command by ID
   * @param id Command ID
   */
  executeCommand(id: string): Promise<void>;

  /**
   * Get recently used commands
   * @param limit Maximum number of commands to return
   */
  getRecentCommands(limit?: number): CommandPaletteItem[];

  /**
   * Track command usage (for recency)
   * @param id Command ID
   */
  trackUsage(id: string): void;
}
