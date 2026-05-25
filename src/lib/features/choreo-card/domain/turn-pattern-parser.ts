export const TURN_VALUES = [0, 0.5, 1, 1.5, 2, 2.5, 3] as const;

export interface TurnCoord {
  blue: number;
  red: number;
}

export function parseTurnPattern(pattern: string): TurnCoord | null {
  if (!pattern) return null;

  const uniformMatch = pattern.match(/^uniform[- ](\d+(?:\.\d+)?)t$/i);
  if (uniformMatch) {
    const turns = parseFloat(uniformMatch[1]!);
    return { blue: turns, red: turns };
  }

  const pipeMatch = pattern.match(/^(\d+(?:\.\d+)?)\|(\d+(?:\.\d+)?)$/);
  if (pipeMatch) {
    return { blue: parseFloat(pipeMatch[1]!), red: parseFloat(pipeMatch[2]!) };
  }

  return null;
}
