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
  startLoc: string;
  endLoc: string;
  turns: number;
  startOri: string;
  endOri: string;
}

export interface MinimalStep {
  step: number;
  letter: string;
  startPos: string;
  endPos: string;
  blue: MinimalMotion | null;
  red: MinimalMotion | null;
}

export interface SequenceKey {
  startPos: string;
  endPos: string;
  startLoc: string;
  endLoc: string;
  startOri: string;
  endOri: string;
  type: string;
  dir: string;
  turns: string;
}

export interface MinimalSequence {
  key: SequenceKey;
  name: string;
  word: string;
  isCircular: boolean;
  gridMode: string;
  startPosition: MinimalStep | null;
  steps: (MinimalStep | null)[];
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
