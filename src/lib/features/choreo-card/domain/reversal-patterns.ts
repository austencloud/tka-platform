/**
 * Reversal Pattern Definitions
 *
 * Defines 15 reversal patterns across 5 families for use in drill generation.
 * Each pattern specifies a reversing sequence with period and minimum beat requirements.
 */

export interface ReversalPatternDef {
  readonly id: string;
  readonly label: string;
  readonly family: ReversalFamily;
  readonly sequence: string;
  readonly period: number;
  readonly minBeats: number;
}

export const REVERSAL_PATTERNS = [
  // Simple family: basic prop reversal patterns
  {
    id: 'continuous',
    label: 'Continuous',
    family: 'simple',
    sequence: '----',
    period: 1,
    minBeats: 4,
  },
  {
    id: 'book',
    label: 'Book',
    family: 'simple',
    sequence: 'PPPP',
    period: 1,
    minBeats: 4,
  },
  {
    id: 'red-book',
    label: 'Red Book',
    family: 'simple',
    sequence: 'RRRR',
    period: 1,
    minBeats: 4,
  },
  {
    id: 'blue-book',
    label: 'Blue Book',
    family: 'simple',
    sequence: 'BBBB',
    period: 1,
    minBeats: 4,
  },
  {
    id: 'long-book',
    label: 'Long Book',
    family: 'simple',
    sequence: 'P-P-',
    period: 2,
    minBeats: 4,
  },
  {
    id: 'alternating',
    label: 'Alternating',
    family: 'simple',
    sequence: 'RBRB',
    period: 2,
    minBeats: 4,
  },

  // Solo family: single-hand reversals
  {
    id: 'solo-1',
    label: 'Solo Pattern 1',
    family: 'solo',
    sequence: 'RBBRBRRB',
    period: 8,
    minBeats: 8,
  },
  {
    id: 'solo-2',
    label: 'Solo Pattern 2',
    family: 'solo',
    sequence: 'RBBRBRRBBRRBRBBR',
    period: 16,
    minBeats: 16,
  },
  {
    id: 'solo-3',
    label: 'Solo Pattern 3',
    family: 'solo',
    sequence: 'RBBRBRRBBRRBRBBRBRRBRBBRRBBRBRRB',
    period: 32,
    minBeats: 32,
  },

  // Dense-weave family: tight two-prop interactions
  {
    id: 'dense-weave-1',
    label: 'Dense Weave 1',
    family: 'dense-weave',
    sequence: 'RPBPRPBP',
    period: 8,
    minBeats: 8,
  },
  {
    id: 'dense-weave-2',
    label: 'Dense Weave 2',
    family: 'dense-weave',
    sequence: 'RPBPRPBPBPRPBPRP',
    period: 16,
    minBeats: 16,
  },
  {
    id: 'dense-weave-3',
    label: 'Dense Weave 3',
    family: 'dense-weave',
    sequence: 'RPBPRPBPBPRPBPRPBPRPBPRPRPBPRPBP',
    period: 32,
    minBeats: 32,
  },

  // Sparse-weave family: loose two-prop interactions
  {
    id: 'sparse-weave-1',
    label: 'Sparse Weave 1',
    family: 'sparse-weave',
    sequence: 'RBRPBRBP',
    period: 8,
    minBeats: 8,
  },
  {
    id: 'sparse-weave-2',
    label: 'Sparse Weave 2',
    family: 'sparse-weave',
    sequence: 'RBRPBRBPBRBPRBRP',
    period: 16,
    minBeats: 16,
  },
  {
    id: 'sparse-weave-3',
    label: 'Sparse Weave 3',
    family: 'sparse-weave',
    sequence: 'RBRPBRBPBRBPRBRPBRBPRBRPRBRPBRBP',
    period: 32,
    minBeats: 32,
  },
] as const;

/**
 * Reversal family type derived from pattern definitions
 */
export type ReversalFamily = 'simple' | 'solo' | 'dense-weave' | 'sparse-weave';

/**
 * Ordered list of reversal families
 */
export const REVERSAL_FAMILIES: readonly ReversalFamily[] = [
  'simple',
  'solo',
  'dense-weave',
  'sparse-weave',
] as const;

/**
 * Filtered collection of simple patterns only
 */
export const SIMPLE_PATTERNS = REVERSAL_PATTERNS.filter(
  (p) => p.family === 'simple'
);

/**
 * Look up a reversal pattern by its id
 */
export function getReversalPattern(id: string): ReversalPatternDef | undefined {
  return REVERSAL_PATTERNS.find((p) => p.id === id);
}

/**
 * Get all reversal patterns compatible with a given beat count.
 *
 * A pattern is compatible if:
 * 1. The beat count is divisible by the pattern's period
 * 2. The beat count meets the pattern's minimum requirement
 */
export function getCompatiblePatterns(beatCount: number): ReversalPatternDef[] {
  return REVERSAL_PATTERNS.filter(
    (p) => beatCount % p.period === 0 && beatCount >= p.minBeats
  );
}
