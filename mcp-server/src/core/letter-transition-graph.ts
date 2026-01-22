/**
 * Letter Transition Graph for MCP Server
 *
 * Manages valid letter transitions based on position groups.
 * Uses BFS to find shortest bridge paths between letters that can't directly follow.
 *
 * Ported from: src/lib/features/create/spell/services/implementations/LetterTransitionGraph.ts
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Find the project root by walking up from current file location
 * looking for the static/data directory
 */
function findProjectRoot(): string {
  let currentDir = __dirname;

  // Walk up the directory tree looking for the static folder
  for (let i = 0; i < 10; i++) {
    const staticPath = path.join(currentDir, "static", "data", "learn", "letter-mappings.json");
    if (fs.existsSync(staticPath)) {
      return currentDir;
    }
    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) break; // Reached filesystem root
    currentDir = parentDir;
  }

  // Fallback: assume we're in mcp-server/dist/src/core or mcp-server/src/core
  // and project root is 4 or 3 levels up
  return path.resolve(__dirname, "../../../../");
}

// Position groups - letters grouped by start/end position type
type PositionGroup = "alpha" | "beta" | "gamma";

// Letter mappings data structure
interface LetterMappingData {
  startPosition: string;
  endPosition: string;
  blueMotion: string;
  redMotion: string;
}

interface LetterMappingsJson {
  letters: Record<string, LetterMappingData>;
  categories: Record<string, string[]>;
}

interface LetterPositionInfo {
  letter: string;
  startPositionGroup: PositionGroup;
  endPositionGroup: PositionGroup;
}

/**
 * Manages letter transitions and bridge path finding
 */
export class LetterTransitionGraph {
  private letterPositions: Map<string, LetterPositionInfo> = new Map();
  private lettersByStartGroup: Map<PositionGroup, string[]> = new Map();
  private lettersByEndGroup: Map<PositionGroup, string[]> = new Map();
  private initialized = false;

  constructor() {
    // Initialize maps for each position group
    const groups: PositionGroup[] = ["alpha", "beta", "gamma"];
    for (const group of groups) {
      this.lettersByStartGroup.set(group, []);
      this.lettersByEndGroup.set(group, []);
    }
  }

  /**
   * Initialize the graph by loading letter mappings from static JSON
   */
  initialize(): void {
    if (this.initialized) return;

    try {
      // Load letter mappings from static JSON
      const projectRoot = findProjectRoot();
      const mappingsPath = path.join(projectRoot, "static", "data", "learn", "letter-mappings.json");
      const rawData = fs.readFileSync(mappingsPath, "utf-8");
      const data: LetterMappingsJson = JSON.parse(rawData);

      this.buildGraph(data);
      this.initialized = true;
    } catch (error) {
      console.error("[MCP] Failed to initialize LetterTransitionGraph:", error);
      throw error;
    }
  }

  private buildGraph(data: LetterMappingsJson): void {
    // Process each letter
    for (const [letterStr, mapping] of Object.entries(data.letters)) {
      const startGroup = this.positionToGroup(mapping.startPosition);
      const endGroup = this.positionToGroup(mapping.endPosition);

      if (!startGroup || !endGroup) continue;

      const positionInfo: LetterPositionInfo = {
        letter: letterStr,
        startPositionGroup: startGroup,
        endPositionGroup: endGroup,
      };

      this.letterPositions.set(letterStr, positionInfo);
      this.lettersByStartGroup.get(startGroup)?.push(letterStr);
      this.lettersByEndGroup.get(endGroup)?.push(letterStr);
    }
  }

  /**
   * Convert position string (e.g., "alpha1", "beta3") to position group
   */
  private positionToGroup(position: string): PositionGroup | null {
    if (position.startsWith("alpha")) return "alpha";
    if (position.startsWith("beta")) return "beta";
    if (position.startsWith("gamma")) return "gamma";
    return null;
  }

  /**
   * Check if letterB can directly follow letterA based on position groups
   */
  canFollow(letterA: string, letterB: string): boolean {
    const infoA = this.letterPositions.get(letterA);
    const infoB = this.letterPositions.get(letterB);

    if (!infoA || !infoB) return false;

    return infoA.endPositionGroup === infoB.startPositionGroup;
  }

  /**
   * Get all letters that can follow after letterA
   */
  getValidSuccessors(letter: string): string[] {
    const info = this.letterPositions.get(letter);
    if (!info) return [];

    return this.lettersByStartGroup.get(info.endPositionGroup) || [];
  }

  /**
   * Get position group info for a letter
   */
  getLetterPositionInfo(letter: string): LetterPositionInfo | null {
    return this.letterPositions.get(letter) || null;
  }

  /**
   * Get the start position group for a letter
   */
  getStartPositionGroup(letter: string): PositionGroup | null {
    return this.letterPositions.get(letter)?.startPositionGroup || null;
  }

  /**
   * Get the end position group for a letter
   */
  getEndPositionGroup(letter: string): PositionGroup | null {
    return this.letterPositions.get(letter)?.endPositionGroup || null;
  }

  /**
   * Find bridge letters needed to transition from letterA to letterB.
   * Uses BFS to find shortest path.
   *
   * @returns Array of bridge letters (empty if direct transition is possible)
   */
  findBridgeLetters(letterA: string, letterB: string): string[] {
    // If direct transition is possible, no bridge needed
    if (this.canFollow(letterA, letterB)) {
      return [];
    }

    const infoA = this.letterPositions.get(letterA);
    const infoB = this.letterPositions.get(letterB);

    if (!infoA || !infoB) {
      return [];
    }

    // Use BFS to find shortest path from A's end group to B's start group
    const startGroup = infoA.endPositionGroup;
    const targetGroup = infoB.startPositionGroup;

    return this.findShortestBridgePath(startGroup, targetGroup);
  }

  /**
   * BFS to find the shortest sequence of letters to get from one position group to another
   */
  private findShortestBridgePath(
    startGroup: PositionGroup,
    targetGroup: PositionGroup
  ): string[] {
    if (startGroup === targetGroup) {
      return [];
    }

    // BFS queue: [current group, path of letters taken]
    const queue: [PositionGroup, string[]][] = [[startGroup, []]];
    const visited = new Set<PositionGroup>();
    visited.add(startGroup);

    while (queue.length > 0) {
      const item = queue.shift();
      if (!item) break;

      const [currentGroup, path] = item;

      // Get all letters that start at this group
      const lettersFromHere = this.lettersByStartGroup.get(currentGroup) || [];

      for (const letter of lettersFromHere) {
        const info = this.letterPositions.get(letter);
        if (!info) continue;

        const nextGroup = info.endPositionGroup;
        const newPath = [...path, letter];

        // Found the target!
        if (nextGroup === targetGroup) {
          return newPath;
        }

        // Continue BFS if we haven't visited this group
        if (!visited.has(nextGroup)) {
          visited.add(nextGroup);
          queue.push([nextGroup, newPath]);
        }
      }
    }

    // No path found (should not happen in TKA as all groups are connected)
    return [];
  }

  /**
   * Find ALL valid single-letter bridges between two letters.
   * Returns an array of bridge letter options, each being a single letter
   * that can connect letterA's end position to letterB's start position.
   *
   * @returns Array of bridge letters (empty if direct transition is possible or no single-letter bridge exists)
   */
  findAllBridgeOptions(letterA: string, letterB: string): string[] {
    // If direct transition is possible, no bridge needed
    if (this.canFollow(letterA, letterB)) {
      return [];
    }

    const infoA = this.letterPositions.get(letterA);
    const infoB = this.letterPositions.get(letterB);

    if (!infoA || !infoB) {
      return [];
    }

    // Find all single-letter bridges: letters that START at A's end group
    // and END at B's start group
    const startGroup = infoA.endPositionGroup;
    const targetGroup = infoB.startPositionGroup;

    const bridges: string[] = [];
    const lettersFromStartGroup = this.lettersByStartGroup.get(startGroup) || [];

    for (const letter of lettersFromStartGroup) {
      const info = this.letterPositions.get(letter);
      if (info && info.endPositionGroup === targetGroup) {
        bridges.push(letter);
      }
    }

    return bridges;
  }

  /**
   * Check if the graph has been initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }
}

// Singleton instance
let transitionGraphInstance: LetterTransitionGraph | null = null;

/**
 * Get the singleton LetterTransitionGraph instance
 */
export function getLetterTransitionGraph(): LetterTransitionGraph {
  if (!transitionGraphInstance) {
    transitionGraphInstance = new LetterTransitionGraph();
    transitionGraphInstance.initialize();
  }
  return transitionGraphInstance;
}
