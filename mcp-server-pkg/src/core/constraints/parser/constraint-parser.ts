/**
 * Constraint Parser
 *
 * Parses natural language constraint specifications into typed constraint objects.
 * Handles synonym expansion, pattern matching, and conflict detection.
 */

import type { IConstraint, ConstraintSet } from "../types.js";
import { CONSTRAINT_PATTERNS, findMatchingPatterns, type ConstraintPattern } from "./patterns.js";
import { SYNONYMS } from "./synonyms.js";

/**
 * Result of parsing a constraint string.
 */
export interface ParseResult {
  /** Successfully parsed constraints */
  constraints: IConstraint[];

  /** Tokens that couldn't be parsed */
  unrecognized: string[];

  /** Parser confidence (0-1) based on how much was recognized */
  confidence: number;

  /** Normalized form of the input */
  normalized: string;

  /** Any detected conflicts or warnings */
  warnings: string[];
}

/**
 * Parse a natural language constraint string into constraints.
 * @param input Natural language constraint specification
 * @returns Parsed constraints with confidence and any warnings
 */
export function parseConstraints(input: string): ParseResult {
  if (!input || input.trim().length === 0) {
    return {
      constraints: [],
      unrecognized: [],
      confidence: 1.0,
      normalized: "",
      warnings: [],
    };
  }

  // Normalize input
  const normalized = normalizeInput(input);

  // Split into clauses (comma, "and", etc.)
  const clauses = splitIntoClauses(normalized);

  const constraints: IConstraint[] = [];
  const unrecognized: string[] = [];
  const warnings: string[] = [];
  const usedPatterns = new Set<string>();

  // Process each clause
  for (const clause of clauses) {
    const trimmedClause = clause.trim();
    if (!trimmedClause) continue;

    const matchingPatterns = findMatchingPatterns(trimmedClause);

    if (matchingPatterns.length === 0) {
      // No patterns matched - track unrecognized
      unrecognized.push(trimmedClause);
    } else {
      // Use the first (highest priority) matching pattern
      const pattern = matchingPatterns[0];
      if (!pattern) continue;

      // Check for duplicates
      if (usedPatterns.has(pattern.id)) {
        warnings.push(`Duplicate constraint: ${pattern.description}`);
        continue;
      }

      // Build the constraint
      try {
        const constraint = pattern.build(trimmedClause);
        constraints.push(constraint);
        usedPatterns.add(pattern.id);
      } catch (error) {
        warnings.push(
          `Failed to build constraint from "${trimmedClause}": ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
    }
  }

  // Check for conflicts
  const conflicts = detectConflicts(constraints);
  warnings.push(...conflicts);

  // Calculate confidence
  const totalClauses = clauses.filter((c) => c.trim().length > 0).length;
  const recognizedClauses = totalClauses - unrecognized.length;
  const confidence = totalClauses > 0 ? recognizedClauses / totalClauses : 1.0;

  return {
    constraints,
    unrecognized,
    confidence,
    normalized,
    warnings,
  };
}

export function parseConstraintSet(input: string): {
  constraintSet: ConstraintSet;
  parseResult: ParseResult;
} {
  const parseResult = parseConstraints(input);

  const hard: IConstraint[] = [];
  const soft: IConstraint[] = [];

  for (const constraint of parseResult.constraints) {
    if (constraint.mode === "hard") {
      hard.push(constraint);
    } else {
      soft.push(constraint);
    }
  }

  return {
    constraintSet: { hard, soft },
    parseResult,
  };
}

function normalizeInput(input: string): string {
  return input
    .toLowerCase()
    .replace(/[.!?]/g, ",") // Replace sentence endings with commas
    .replace(/\s+/g, " ") // Normalize whitespace
    .replace(/,+/g, ",") // Collapse multiple commas
    .trim();
}

function splitIntoClauses(input: string): string[] {
  // Split on comma, "and", "with", "plus"
  const separators = /[,]|\s+and\s+|\s+with\s+|\s+plus\s+/gi;
  return input.split(separators).map((c) => c.trim()).filter((c) => c.length > 0);
}

function detectConflicts(constraints: IConstraint[]): string[] {
  const conflicts: string[] = [];

  // Group by type
  const byType = new Map<string, IConstraint[]>();
  for (const constraint of constraints) {
    const existing = byType.get(constraint.type) ?? [];
    existing.push(constraint);
    byType.set(constraint.type, existing);
  }

  // Check for conflicts within same type
  for (const [type, typeConstraints] of byType) {
    if (typeConstraints.length > 1) {
      // Multiple constraints of same type might conflict
      // For now, just warn
      conflicts.push(
        `Multiple ${type} constraints specified - later ones may override earlier`
      );
    }
  }

  // Check for logical conflicts
  // e.g., "all pro" + "all anti" is impossible
  const motionTypeConstraints = constraints.filter(
    (c) => c.description.includes("pro") || c.description.includes("anti")
  );
  const requiresPro = motionTypeConstraints.some(
    (c) => c.description.includes("Require") && c.description.includes("pro")
  );
  const requiresAnti = motionTypeConstraints.some(
    (c) => c.description.includes("Require") && c.description.includes("anti")
  );
  if (requiresPro && requiresAnti) {
    conflicts.push("Conflicting constraints: cannot require both pro and anti motions");
  }

  return conflicts;
}

export function getAvailablePatterns(): ConstraintPattern[] {
  return [...CONSTRAINT_PATTERNS];
}

export function getAvailableSynonyms(): Record<string, string[]> {
  return { ...SYNONYMS };
}
