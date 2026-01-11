/**
 * ISequenceJsonExporter
 *
 * Exports sequences to minimal JSON format for debugging/admin use.
 * Strips placement data fluff, keeps only essential motion data.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";

export interface MinimalMotion {
  type: string;
  dir: string;
  start: string;
  end: string;
  turns: number;
  startOri: string;
  endOri: string;
}

export interface MinimalBeat {
  beat: number;
  letter: string;
  start: string;
  end: string;
  blue: MinimalMotion | null;
  red: MinimalMotion | null;
}

export interface MinimalSequence {
  name: string;
  word: string;
  isCircular: boolean;
  gridMode: string;
  // propType removed - prop type is viewer preference, not sequence data
  startPosition: MinimalBeat | null;
  beats: (MinimalBeat | null)[];
}

export interface ISequenceJsonExporter {
  /**
   * Convert a sequence to minimal JSON representation.
   */
  toMinimalJson(sequence: SequenceData): MinimalSequence;

  /**
   * Convert sequence to JSON string with formatting.
   */
  toJsonString(sequence: SequenceData): string;

  /**
   * Copy sequence JSON to clipboard.
   * @returns true if successful, false otherwise
   */
  copyToClipboard(sequence: SequenceData): Promise<boolean>;
}
