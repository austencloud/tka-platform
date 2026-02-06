/**
 * Codex Models
 *
 * Interface definitions for the codex system.
 */

import { MotionType } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import type { LetterCategory } from "../types/codex-types";

export interface CodexLetterMapping {
  startPosition: string;
  endPosition: string;
  blueMotionType: MotionType;
  redMotionType: MotionType;
}

export interface CodexLetter {
  letter: string;
  mapping: CodexLetterMapping;
  category: LetterCategory;
  row: number;
  position: number;
}

export interface CodexLetterRow {
  index: number;
  category: LetterCategory;
  letters: string[];
}

export interface CodexConfig {
  version: string;
  letters: Record<string, CodexLetterMapping>;
  rows: CodexLetterRow[];
  categories: Record<LetterCategory, string[]>;
}

// Factory functions
export function createLetterMapping(
  data: Partial<CodexLetterMapping>
): CodexLetterMapping {
  return {
    startPosition: data.startPosition ?? "",
    endPosition: data.endPosition ?? "",
    blueMotionType: data.blueMotionType ?? MotionType.STATIC,
    redMotionType: data.redMotionType ?? MotionType.STATIC,
  };
}

export function createCodexLetter(data: Partial<CodexLetter>): CodexLetter {
  return {
    letter: data.letter ?? "",
    mapping: data.mapping ?? createLetterMapping({}),
    category: data.category ?? ("basic" as LetterCategory),
    row: data.row ?? 0,
    position: data.position ?? 0,
  };
}

export function createCodexLetterRow(
  data: Partial<CodexLetterRow>
): CodexLetterRow {
  return {
    index: data.index ?? 0,
    category: data.category ?? ("basic" as LetterCategory),
    letters: data.letters ?? [],
  };
}
