import type { PictographData } from "../../../../../shared/domain/models/PictographData";
import type { ITurnsTupleKeyGenerator } from "../contracts/ITurnsTupleKeyGenerator";


/**
 * TurnsTupleKeyGenerator
 * Generates turns tuple array matching advanced lookup expectations.
 */
export class TurnsTupleKeyGenerator implements ITurnsTupleKeyGenerator {
  generateTurnsTuple(pictographData: PictographData): number[] {
    try {
      const blueTurns = this.getTurns(pictographData.motions.blue?.turns);
      const redTurns = this.getTurns(pictographData.motions.red?.turns);
      return [blueTurns, redTurns];
    } catch {
      return [0, 0];
    }
  }

  private getTurns(value: unknown): number {
    if (typeof value === "number") return value;
    return 0;
  }
}

// ============================================================================
// DIRECT SINGLETON EXPORT
// ============================================================================
// Use this instead of turnsTupleKeyGenerator to avoid DI container rebuilds.
// ============================================================================

export const turnsTupleKeyGenerator = new TurnsTupleKeyGenerator();
