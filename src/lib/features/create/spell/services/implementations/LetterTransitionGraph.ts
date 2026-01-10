/**
 * Letter Transition Graph Implementation
 *
 * Builds and manages a graph of valid letter transitions based on position groups.
 * Uses BFS to find shortest bridge paths between letters that can't directly follow.
 */

import { Letter } from "$lib/shared/foundation/domain/models/Letter";
import { GridPositionGroup } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { ILetterTransitionGraph } from "../contracts/ILetterTransitionGraph";
import type {
  LetterPositionInfo,
  LetterCategory,
} from "../../domain/models/spell-models";

/**
 * Raw letter mapping data from letter-mappings.json
 */
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

export class LetterTransitionGraph implements ILetterTransitionGraph {
  private letterPositions: Map<Letter, LetterPositionInfo> = new Map();
  private lettersByStartGroup: Map<GridPositionGroup, Letter[]> = new Map();
  private lettersByEndGroup: Map<GridPositionGroup, Letter[]> = new Map();
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Load letter mappings from static JSON
      const response = await fetch("/data/learn/letter-mappings.json");
      const data: LetterMappingsJson = await response.json();

      this.buildGraph(data);
      this.initialized = true;
    } catch (error) {
      console.error("Failed to initialize LetterTransitionGraph:", error);
      throw error;
    }
  }

  private buildGraph(data: LetterMappingsJson): void {
    // Initialize maps for each position group
    for (const group of Object.values(GridPositionGroup)) {
      this.lettersByStartGroup.set(group, []);
      this.lettersByEndGroup.set(group, []);
    }

    // Process each letter
    for (const [letterStr, mapping] of Object.entries(data.letters)) {
      const letter = this.stringToLetter(letterStr);
      if (!letter) continue;

      const startGroup = this.positionToGroup(mapping.startPosition);
      const endGroup = this.positionToGroup(mapping.endPosition);

      if (!startGroup || !endGroup) continue;

      const category = this.getCategoryForLetter(letterStr, data.categories);

      const positionInfo: LetterPositionInfo = {
        letter,
        startPositionGroup: startGroup,
        endPositionGroup: endGroup,
        category,
      };

      this.letterPositions.set(letter, positionInfo);
      this.lettersByStartGroup.get(startGroup)?.push(letter);
      this.lettersByEndGroup.get(endGroup)?.push(letter);
    }
  }

  private stringToLetter(str: string): Letter | null {
    // Direct enum value match
    const letterValues = Object.values(Letter) as string[];
    if (letterValues.includes(str)) {
      return str as Letter;
    }
    return null;
  }

  private positionToGroup(position: string): GridPositionGroup | null {
    if (position.startsWith("alpha")) return GridPositionGroup.ALPHA;
    if (position.startsWith("beta")) return GridPositionGroup.BETA;
    if (position.startsWith("gamma")) return GridPositionGroup.GAMMA;
    return null;
  }

  private getCategoryForLetter(
    letterStr: string,
    categories: Record<string, string[]>
  ): LetterCategory {
    for (const [category, letters] of Object.entries(categories)) {
      if (letters.includes(letterStr)) {
        return category as LetterCategory;
      }
    }
    return "dual-shift"; // Default
  }

  canFollow(letterA: Letter, letterB: Letter): boolean {
    const infoA = this.letterPositions.get(letterA);
    const infoB = this.letterPositions.get(letterB);

    if (!infoA || !infoB) return false;

    return infoA.endPositionGroup === infoB.startPositionGroup;
  }

  getValidSuccessors(letter: Letter): Letter[] {
    const info = this.letterPositions.get(letter);
    if (!info) return [];

    return this.lettersByStartGroup.get(info.endPositionGroup) || [];
  }

  getLettersStartingAt(positionGroup: GridPositionGroup): Letter[] {
    return this.lettersByStartGroup.get(positionGroup) || [];
  }

  getLettersEndingAt(positionGroup: GridPositionGroup): Letter[] {
    return this.lettersByEndGroup.get(positionGroup) || [];
  }

  getLetterPositionInfo(letter: Letter): LetterPositionInfo | null {
    return this.letterPositions.get(letter) || null;
  }

  getStartPositionGroup(letter: Letter): GridPositionGroup | null {
    return this.letterPositions.get(letter)?.startPositionGroup || null;
  }

  getEndPositionGroup(letter: Letter): GridPositionGroup | null {
    return this.letterPositions.get(letter)?.endPositionGroup || null;
  }

  findBridgeLetters(letterA: Letter, letterB: Letter): Letter[] {
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
    startGroup: GridPositionGroup,
    targetGroup: GridPositionGroup
  ): Letter[] {
    if (startGroup === targetGroup) {
      return [];
    }

    // BFS queue: [current group, path of letters taken]
    const queue: [GridPositionGroup, Letter[]][] = [[startGroup, []]];
    const visited = new Set<GridPositionGroup>();
    visited.add(startGroup);

    while (queue.length > 0) {
      const [currentGroup, path] = queue.shift()!;

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

  isInitialized(): boolean {
    return this.initialized;
  }
}
