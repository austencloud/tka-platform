/**
 * Word Sequence Generator Implementation
 *
 * Converts typed words into valid TKA sequences with bridge letters.
 */

import { Letter } from "$lib/shared/foundation/domain/models/Letter";
import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
import type { ILetterQueryHandler } from "$lib/shared/foundation/services/contracts/data/data-contracts";
import type { IBeatConverter } from "$lib/features/create/generate/shared/services/contracts/IBeatConverter";
import type { IOrientationCalculator } from "$lib/shared/pictograph/prop/services/contracts/IOrientationCalculator";
import type { ISequenceExtender } from "$lib/features/create/shared/services/contracts/ISequenceExtender";
import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
import type { BeatData } from "$lib/features/create/shared/domain/models/BeatData";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { IWordSequenceGenerator } from "../contracts/IWordSequenceGenerator";
import type { ILetterTransitionGraph } from "../contracts/ILetterTransitionGraph";
import type {
  SpellGenerationOptions,
  SpellResult,
  LetterSource,
  CircularizationOption,
} from "../../domain/models/spell-models";
import {
  GREEK_LETTER_ALIASES,
  MAX_WORD_LENGTH,
} from "../../domain/constants/spell-constants";
import { DifficultyLevel } from "$lib/features/create/generate/shared/domain/models/generate-models";
import { LOOPType } from "$lib/features/create/generate/circular/domain/models/circular-models";
import { recalculateAllOrientations } from "$lib/features/create/shared/services/implementations/sequence-transforms/orientation-propagation";

export class WordSequenceGenerator implements IWordSequenceGenerator {
  constructor(
    private transitionGraph: ILetterTransitionGraph,
    private letterQueryHandler: ILetterQueryHandler,
    private beatConverter: IBeatConverter,
    private orientationCalculator: IOrientationCalculator,
    private sequenceExtender: ISequenceExtender
  ) {}

  async generateFromWord(
    options: SpellGenerationOptions
  ): Promise<SpellResult> {
    // Validate word
    const validation = this.validateWord(options.word);
    if (!validation.valid) {
      return this.createErrorResult(
        options.word,
        validation.error || "Invalid word"
      );
    }

    // Parse word into letters
    const parseResult = this.parseWord(options.word);
    if (!parseResult) {
      return this.createErrorResult(options.word, "Failed to parse word");
    }

    const { letters } = parseResult;

    // Ensure transition graph is initialized
    if (!this.transitionGraph.isInitialized()) {
      await this.transitionGraph.initialize();
    }

    try {
      // Build expanded letter sequence with bridge letters
      // Always use 1 bridge letter max - any transition can be done with 1 bridge
      const { expandedLetters, letterSources } = this.buildExpandedSequence(
        letters,
        1
      );

      if (expandedLetters.length === 0) {
        return this.createErrorResult(options.word, "No letters to generate");
      }

      const firstLetter = expandedLetters[0]!;

      // Get start position for first letter
      const gridMode = GridMode.DIAMOND; // Default for now
      const startPosition = await this.selectStartPosition(
        firstLetter,
        gridMode
      );

      if (!startPosition) {
        return this.createErrorResult(
          options.word,
          `Could not find start position for letter ${firstLetter}`
        );
      }

      // Generate beats for each letter
      const beats = await this.generateBeats(
        expandedLetters,
        startPosition,
        gridMode
      );

      if (beats.length === 0) {
        return this.createErrorResult(
          options.word,
          "Failed to generate beats for sequence"
        );
      }

      // Build sequence data (non-circular initially)
      let sequence = this.buildSequenceData(
        options.word,
        startPosition,
        beats,
        gridMode,
        false // Initially not circular - LOOP is applied after
      );

      // Recalculate all orientations to ensure chain integrity
      // The CSV data may not have proper orientation continuity,
      // so we propagate orientations from the start position
      sequence = recalculateAllOrientations(
        sequence,
        this.orientationCalculator
      );

      // If a forced bridge letter was specified (for circularization), append it
      if (options.forceBridgeLetter) {
        const bridgeResult = await this.appendForcedBridgeLetter(
          sequence,
          options.forceBridgeLetter,
          gridMode
        );
        if (bridgeResult.success) {
          sequence = bridgeResult.sequence;
          expandedLetters.push(options.forceBridgeLetter);
          letterSources.push({
            letter: options.forceBridgeLetter,
            isOriginal: false,
            beatIndex: expandedLetters.length,
          });
        } else {
          return this.createErrorResult(
            options.word,
            bridgeResult.error || "Failed to add bridge letter"
          );
        }
      }

      // Build expanded word string
      const expandedWord = expandedLetters.join("");

      // Store spell metadata in sequence for persistence
      sequence = {
        ...sequence,
        metadata: {
          ...sequence.metadata,
          spellData: {
            originalWord: options.word,
            expandedWord,
            letterSources,
          },
        },
      };

      // Analyze what LOOP types are available for this sequence
      const loopAnalysis = this.sequenceExtender.analyzeSequence(sequence);

      // If sequence is directly loopable and user has selected a LOOP type, apply it
      if (
        options.preferences.makeCircular &&
        options.preferences.selectedLOOPType &&
        loopAnalysis.canExtend
      ) {
        // Check if the selected LOOP type is available
        const isLOOPAvailable = loopAnalysis.availableLOOPOptions.some(
          (opt) => opt.loopType === options.preferences.selectedLOOPType
        );

        if (isLOOPAvailable) {
          // Apply the LOOP transformation
          sequence = await this.sequenceExtender.extendSequence(sequence, {
            loopType: options.preferences.selectedLOOPType,
          });

          // Update metadata to reflect the LOOP was applied
          sequence = {
            ...sequence,
            metadata: {
              ...sequence.metadata,
              spellData: {
                originalWord: options.word,
                expandedWord,
                letterSources,
                appliedLOOPType: options.preferences.selectedLOOPType,
              },
            },
          };
        }
      }

      // If position groups don't match, compute circularization options
      // These show what bridge letters could be added to enable position-dependent LOOPs
      // Note: REWOUND is always available (it's position-independent), but we still
      // want to show circularization options for users who want other LOOP types
      let circularizationOptions: CircularizationOption[] | undefined;
      let directLoopUnavailableReason: string | undefined;

      if (options.preferences.makeCircular) {
        const startPosGroup = this.positionToGroup(
          startPosition.startPosition || startPosition.endPosition || ""
        );
        const endBeat = beats[beats.length - 1];
        const endPosGroup = endBeat
          ? this.positionToGroup(endBeat.endPosition || "")
          : null;

        // Check if position groups don't match - this means position-dependent LOOPs
        // (STRICT_ROTATED, STRICT_MIRRORED, etc.) won't work without bridge letters
        if (startPosGroup && endPosGroup && startPosGroup !== endPosGroup) {
          directLoopUnavailableReason = `Sequence ends at ${endPosGroup}, needs to reach ${startPosGroup} for position-dependent LOOPs`;

          // Compute circularization options to show what bridge letters enable which LOOPs
          circularizationOptions = await this.computeCircularizationOptions(
            sequence,
            startPosition,
            endBeat,
            gridMode
          );
        }
      }

      return {
        sequence,
        originalWord: options.word,
        expandedWord,
        letterSources,
        success: true,
        loopAnalysis,
        circularizationOptions,
        directLoopUnavailableReason,
      };
    } catch (error) {
      return this.createErrorResult(
        options.word,
        `Generation failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  parseWord(word: string): { letters: Letter[]; error?: string } | null {
    const letters: Letter[] = [];
    let i = 0;

    while (i < word.length) {
      // Try to match Greek letter aliases (longest match first)
      let matched = false;

      // Sort aliases by length descending to match longest first
      const sortedAliases = [...GREEK_LETTER_ALIASES].sort(
        (a, b) => b.alias.length - a.alias.length
      );

      for (const { alias, letter } of sortedAliases) {
        const remaining = word.slice(i).toLowerCase();
        if (remaining.startsWith(alias.toLowerCase())) {
          letters.push(letter);
          i += alias.length;
          matched = true;
          break;
        }
      }

      if (!matched) {
        // Try single character match
        const char = word.charAt(i);
        if (!char) {
          i++;
          continue;
        }
        const upperChar = char.toUpperCase();

        // Check if it's a direct Letter enum value
        const letterValues = Object.values(Letter) as string[];
        if (letterValues.includes(upperChar)) {
          letters.push(upperChar as Letter);
          i++;
        } else if (letterValues.includes(char)) {
          // Greek symbols like Σ, Δ, etc.
          letters.push(char as Letter);
          i++;
        } else {
          // Skip spaces and unknown characters for now
          if (char === " " || char === "-") {
            i++;
          } else {
            return { letters: [], error: `Unknown character: ${char}` };
          }
        }
      }
    }

    return { letters };
  }

  validateWord(word: string): { valid: boolean; error?: string } {
    if (!word || word.trim().length === 0) {
      return { valid: false, error: "Word cannot be empty" };
    }

    if (word.length > MAX_WORD_LENGTH * 3) {
      // Allow for Greek aliases which are longer
      return {
        valid: false,
        error: `Word is too long (max ${MAX_WORD_LENGTH} letters)`,
      };
    }

    const parseResult = this.parseWord(word);
    if (!parseResult || parseResult.error) {
      return {
        valid: false,
        error: parseResult?.error || "Invalid characters",
      };
    }

    if (parseResult.letters.length === 0) {
      return { valid: false, error: "No valid letters found" };
    }

    if (parseResult.letters.length > MAX_WORD_LENGTH) {
      return {
        valid: false,
        error: `Word has too many letters (max ${MAX_WORD_LENGTH}, got ${parseResult.letters.length})`,
      };
    }

    return { valid: true };
  }

  /**
   * Build the expanded letter sequence with bridge letters inserted
   */
  private buildExpandedSequence(
    originalLetters: Letter[],
    maxBridgeLetters: number
  ): { expandedLetters: Letter[]; letterSources: LetterSource[] } {
    const expandedLetters: Letter[] = [];
    const letterSources: LetterSource[] = [];

    for (let i = 0; i < originalLetters.length; i++) {
      const letter = originalLetters[i];
      if (!letter) continue;

      if (i === 0) {
        // First letter - just add it
        expandedLetters.push(letter);
        letterSources.push({
          letter,
          isOriginal: true,
          beatIndex: expandedLetters.length,
        });
      } else {
        // Check if we need bridge letters
        const prevLetter = expandedLetters[expandedLetters.length - 1];
        if (!prevLetter) continue;

        const bridgeLetters = this.transitionGraph.findBridgeLetters(
          prevLetter,
          letter
        );

        // Add bridge letters (up to max)
        const bridgesToAdd = bridgeLetters.slice(0, maxBridgeLetters);
        for (const bridge of bridgesToAdd) {
          expandedLetters.push(bridge);
          letterSources.push({
            letter: bridge,
            isOriginal: false,
            beatIndex: expandedLetters.length,
          });
        }

        // Add the original letter
        expandedLetters.push(letter);
        letterSources.push({
          letter,
          isOriginal: true,
          beatIndex: expandedLetters.length,
        });
      }
    }

    return { expandedLetters, letterSources };
  }

  /**
   * Select a start position that works for the first letter
   */
  private async selectStartPosition(
    firstLetter: Letter,
    gridMode: GridMode
  ): Promise<PictographData | null> {
    const startGroup = this.transitionGraph.getStartPositionGroup(firstLetter);
    if (!startGroup) return null;

    // Get all pictograph variations
    const allPictographs =
      await this.letterQueryHandler.getAllPictographVariations(gridMode);

    // Find a static start position that ends at the required group
    // Start positions are pictographs where startPosition === endPosition
    const startPositions = allPictographs.filter((p) => {
      const endPos = this.getEndPosition(p);
      const endGroup = this.positionToGroup(endPos);
      return endGroup === startGroup && this.isStartPositionPictograph(p);
    });

    if (startPositions.length > 0) {
      // Return random start position
      const randomIndex = Math.floor(Math.random() * startPositions.length);
      return startPositions[randomIndex] ?? null;
    }

    // Fallback: return any pictograph that ends at the right group
    const fallback = allPictographs.find((p) => {
      const endPos = this.getEndPosition(p);
      return this.positionToGroup(endPos) === startGroup;
    });

    return fallback ?? null;
  }

  /**
   * Generate beats for the expanded letter sequence.
   * Throws an error if a valid pictograph cannot be found for any letter.
   */
  private async generateBeats(
    letters: Letter[],
    startPosition: PictographData,
    gridMode: GridMode
  ): Promise<BeatData[]> {
    const beats: BeatData[] = [];
    let lastPictograph = startPosition;

    for (let i = 0; i < letters.length; i++) {
      const letter = letters[i];
      if (!letter) continue;

      // Get pictograph for this letter that properly chains from the last one
      const pictograph = await this.findPictographForLetter(
        letter,
        lastPictograph,
        gridMode
      );

      if (!pictograph) {
        // No valid pictograph found - this means the transition graph
        // didn't correctly identify needed bridge letters, or no valid
        // pictograph variation exists for this transition
        throw new Error(
          `Cannot chain letter "${letter}" from position "${lastPictograph.endPosition}". ` +
            `No pictograph variation for "${letter}" starts at this position.`
        );
      }

      // Convert to beat
      const beat = this.beatConverter.convertToBeat(
        pictograph,
        i + 1,
        gridMode
      );
      beats.push(beat);
      lastPictograph = pictograph;
    }

    return beats;
  }

  /**
   * Find a pictograph for a letter that can follow the last pictograph.
   * Ensures position continuity (startPosition === lastPictograph.endPosition).
   * Orientations are recalculated afterward by recalculateAllOrientations().
   */
  private async findPictographForLetter(
    letter: Letter,
    lastPictograph: PictographData,
    gridMode: GridMode
  ): Promise<PictographData | null> {
    // Get ALL pictograph variations
    const allPictographs =
      await this.letterQueryHandler.getAllPictographVariations(gridMode);

    // Filter to variations for this letter
    const letterVariations = allPictographs.filter((p) => p.letter === letter);

    if (letterVariations.length === 0) {
      console.warn(`No pictograph variations found for letter ${letter}`);
      return null;
    }

    // Get the end position from the last pictograph
    const requiredStartPosition = lastPictograph.endPosition;

    // Filter by position continuity
    const positionMatches = letterVariations.filter(
      (p) => p.startPosition === requiredStartPosition
    );

    if (positionMatches.length === 0) {
      console.warn(
        `No pictograph for letter ${letter} starts at position ${requiredStartPosition}`
      );
      // Return null - this means we need a bridge letter
      return null;
    }

    // Return a random match from valid candidates for variety
    const randomIndex = Math.floor(Math.random() * positionMatches.length);
    return positionMatches[randomIndex] ?? null;
  }

  /**
   * Build the final SequenceData object
   */
  private buildSequenceData(
    name: string,
    startPosition: PictographData,
    beats: BeatData[],
    gridMode: GridMode,
    isCircular: boolean = false
  ): SequenceData {
    const startPositionData = this.beatConverter.convertToStartPosition(
      startPosition,
      gridMode
    );

    return {
      id: crypto.randomUUID(),
      name,
      word: beats.map((b) => b.letter || "").join(""),
      beats,
      startPosition: startPositionData, // Primary field for orientation propagation
      startingPositionBeat: startPositionData, // Legacy field for backward compatibility
      gridMode,
      // propType removed - prop type is viewer preference, not sequence data
      difficultyLevel: DifficultyLevel.INTERMEDIATE,
      isCircular,
      isFavorite: false,
      thumbnails: [],
      tags: isCircular
        ? ["generated", "spell", "loop"]
        : ["generated", "spell"],
      metadata: {
        createdAt: new Date().toISOString(),
        source: "spell",
      },
    };
  }

  private createErrorResult(word: string, error: string): SpellResult {
    return {
      sequence: null as unknown as SequenceData,
      originalWord: word,
      expandedWord: "",
      letterSources: [],
      success: false,
      error,
    };
  }

  private getEndPosition(pictograph: PictographData): string {
    return pictograph.endPosition || "";
  }

  private positionToGroup(position: string): string | null {
    if (!position) return null;
    if (position.startsWith("alpha")) return "alpha";
    if (position.startsWith("beta")) return "beta";
    if (position.startsWith("gamma")) return "gamma";
    return null;
  }

  private isStartPositionPictograph(pictograph: PictographData): boolean {
    return pictograph.startPosition === pictograph.endPosition;
  }

  /**
   * Compute circularization options for a non-loopable sequence.
   * When a sequence ends at a different position group than it starts,
   * we need bridge letters to return to the start group. Different bridge
   * letters will end at different specific positions, enabling different LOOPs.
   */
  private async computeCircularizationOptions(
    sequence: SequenceData,
    startPosition: PictographData,
    endBeat: BeatData | undefined,
    gridMode: GridMode
  ): Promise<CircularizationOption[]> {
    if (!endBeat) return [];

    const startPos = startPosition.startPosition || startPosition.endPosition;
    const endPos = endBeat.endPosition;
    if (!startPos || !endPos) return [];

    const startGroup = this.positionToGroup(startPos);
    const endGroup = this.positionToGroup(endPos);
    if (!startGroup || !endGroup || startGroup === endGroup) return [];

    const options: CircularizationOption[] = [];
    const allPictographs =
      await this.letterQueryHandler.getAllPictographVariations(gridMode);

    // Find ALL pictograph variations that:
    // 1. Start at the sequence's end position (endPos)
    // 2. End at a position in the start group (startGroup)
    // This gives us all possible bridge letters (X, W-, X-, etc.)
    const bridgeCandidates = allPictographs.filter((p) => {
      if (p.startPosition !== endPos) return false;
      const pEndGroup = this.positionToGroup(p.endPosition || "");
      return pEndGroup === startGroup;
    });

    if (bridgeCandidates.length === 0) return [];

    // Group candidates by letter and ending position to avoid duplicates
    // Key: "letter|endPosition" -> PictographData
    const uniqueBridges = new Map<string, PictographData>();
    for (const variation of bridgeCandidates) {
      const key = `${variation.letter}|${variation.endPosition}`;
      if (!uniqueBridges.has(key)) {
        uniqueBridges.set(key, variation);
      }
    }

    // For each unique bridge variation, check available LOOPs
    for (const [_key, variation] of uniqueBridges) {
      const bridgeLetter = variation.letter as Letter;
      const bridgeEndPos = variation.endPosition || "";

      // Create a temporary beat for the bridge letter
      const bridgeBeat: BeatData = {
        ...variation,
        isBeat: true,
        beatNumber: sequence.beats.length + 1,
        duration: 1,
        blueReversal: false,
        redReversal: false,
        isBlank: false,
      };

      // Create a temporary sequence with the bridge letter to analyze
      const tempSequence: SequenceData = {
        ...sequence,
        beats: [...sequence.beats, bridgeBeat],
      };

      // Analyze what LOOPs are available for this extended sequence
      // Filter out REWOUND since it's always available and shown separately
      const analysis = this.sequenceExtender.analyzeSequence(tempSequence);
      const positionDependentLOOPs = analysis.availableLOOPOptions.filter(
        (opt) => opt.loopType !== LOOPType.REWOUND
      );

      if (positionDependentLOOPs.length > 0) {
        options.push({
          bridgeLetters: [bridgeLetter],
          endPosition: bridgeEndPos,
          availableLOOPs: positionDependentLOOPs,
          description: `Add "${bridgeLetter}" to end at ${bridgeEndPos}`,
        });
      }
    }

    return options;
  }

  /**
   * Get a representative letter that starts at a given position group.
   * Used to find bridge paths.
   */
  private getFirstLetterInGroup(group: string): Letter {
    // These are known letters that start at each position group
    const groupStarters: Record<string, Letter> = {
      alpha: Letter.A,
      beta: Letter.B,
      gamma: Letter.G,
    };
    return groupStarters[group] || Letter.A;
  }

  /**
   * Append a forced bridge letter to the sequence.
   * This is used when user selects a circularization option that requires a specific bridge letter.
   */
  private async appendForcedBridgeLetter(
    sequence: SequenceData,
    bridgeLetter: Letter,
    gridMode: GridMode
  ): Promise<{ success: boolean; sequence: SequenceData; error?: string }> {
    const lastBeat = sequence.beats[sequence.beats.length - 1];
    if (!lastBeat) {
      return { success: false, sequence, error: "No beats in sequence" };
    }

    // Get all pictographs for the bridge letter
    const allPictographs =
      await this.letterQueryHandler.getAllPictographVariations(gridMode);

    // Find a pictograph variation that starts at the last beat's end position
    const bridgeVariations = allPictographs.filter(
      (p) =>
        p.letter === bridgeLetter && p.startPosition === lastBeat.endPosition
    );

    if (bridgeVariations.length === 0) {
      return {
        success: false,
        sequence,
        error: `No variation of "${bridgeLetter}" starts at position "${lastBeat.endPosition}"`,
      };
    }

    // Pick a random variation for variety
    const randomIndex = Math.floor(Math.random() * bridgeVariations.length);
    const bridgeVariation = bridgeVariations[randomIndex];
    if (!bridgeVariation) {
      return {
        success: false,
        sequence,
        error: "Failed to select bridge variation",
      };
    }

    // Convert to beat and append
    const bridgeBeat = this.beatConverter.convertToBeat(
      bridgeVariation,
      sequence.beats.length + 1,
      gridMode
    );

    const newSequence: SequenceData = {
      ...sequence,
      beats: [...sequence.beats, bridgeBeat],
    };

    // Recalculate orientations for the new sequence
    const recalculatedSequence = recalculateAllOrientations(
      newSequence,
      this.orientationCalculator
    );

    return { success: true, sequence: recalculatedSequence };
  }
}
