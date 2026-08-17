/**
 * Turns one hand's pattern into a sentence a first-time reader can follow.
 *
 * The old editor named figures ("Book", "Long Book", "Solo 1") borrowed from the
 * reversal-pattern vocabulary. Those are real TKA names, but nothing on screen
 * taught them, so a newcomer had no way in. Reading the phrase off the hand's own
 * steps instead means the control always says what it actually does, and a figure
 * with no name at all — anything hand-edited — still reads as a sentence.
 */

/** "3rd", "4th", "8th" — the ordinal for a repeat length. */
function ordinal(n: number): string {
  const lastTwo = n % 100;
  if (lastTwo >= 11 && lastTwo <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

/** "1", "1 and 2", "1, 3 and 6". */
function joinSteps(steps: readonly number[]): string {
  if (steps.length === 1) return String(steps[0]);
  const head = steps.slice(0, -1).join(", ");
  return `${head} and ${steps[steps.length - 1]}`;
}

/**
 * `mask[i]` is true when step i does something (turns, reverses, holds).
 * The result slots into "<Hand> turns 1 on ___".
 */
export function describeMask(mask: readonly boolean[]): string {
  const active: number[] = [];
  for (let i = 0; i < mask.length; i++) if (mask[i]) active.push(i);

  if (active.length === 0) return "no steps";
  if (active.length === mask.length) return "every step";

  // A single active step in the period is a regular beat, however long the
  // period is: [✓ · · ·] is "every 4th step" and [· · ✓ ·] is the same beat
  // started later. Saying where it starts matters — two hands on the same
  // period but different offsets are trading off, not doubling up.
  if (active.length === 1) {
    const start = active[0]!;
    // "every 2nd step" is technically right and nobody says it.
    const every =
      mask.length === 2 ? "every other step" : `every ${ordinal(mask.length)} step`;
    return start === 0 ? every : `${every}, starting on step ${start + 1}`;
  }

  return `steps ${joinSteps(active.map((i) => i + 1))}`;
}
