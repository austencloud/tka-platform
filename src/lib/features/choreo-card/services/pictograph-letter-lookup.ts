export interface CsvEdge {
  letter: string;
  startPosition: string;
  endPosition: string;
  timing: string;
  direction: string;
  blueMotionType: string;
  blueRotationDirection: string;
  blueStartLocation: string;
  blueEndLocation: string;
  redMotionType: string;
  redRotationDirection: string;
  redStartLocation: string;
  redEndLocation: string;
  [key: string]: string;
}

export interface StepMotionQuery {
  startPosition: string;
  endPosition: string;
  blue: { motionType: string; startLocation: string; endLocation: string };
  red: { motionType: string; startLocation: string; endLocation: string };
}

/** Parse the pictograph dataframe CSV text into edge rows. */
export function parseCsvEdges(csvText: string): CsvEdge[] {
  const lines = csvText.split("\n").filter((l) => l.trim());
  if (lines.length === 0) return [];
  const headers = lines[0].split(",").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cols = line.split(",").map((c) => c.trim());
    const edge: Record<string, string> = {};
    headers.forEach((h, i) => (edge[h] = cols[i] ?? ""));
    return edge as CsvEdge;
  });
}

/** Find the letter for a transformed step by exact edge match. Null when none. */
export function lookupLetter(
  edges: CsvEdge[],
  q: StepMotionQuery,
): string | null {
  const match = edges.find(
    (e) =>
      e.startPosition === q.startPosition &&
      e.endPosition === q.endPosition &&
      e.blueMotionType === q.blue.motionType &&
      e.blueStartLocation === q.blue.startLocation &&
      e.blueEndLocation === q.blue.endLocation &&
      e.redMotionType === q.red.motionType &&
      e.redStartLocation === q.red.startLocation &&
      e.redEndLocation === q.red.endLocation,
  );
  return match ? match.letter : null;
}

let cachedDiamondEdges: CsvEdge[] | null = null;

/** Fetch + cache the diamond pictograph dataframe (served from /static). */
export async function loadDiamondEdges(): Promise<CsvEdge[]> {
  if (cachedDiamondEdges) return cachedDiamondEdges;
  const res = await fetch("/data/pictographs/DiamondPictographDataframe.csv");
  if (!res.ok)
    throw new Error(`Failed to load pictograph CSV: ${res.status}`);
  cachedDiamondEdges = parseCsvEdges(await res.text());
  return cachedDiamondEdges;
}
