export function corpusFilm(
  id: string,
  scene: Record<string, unknown>,
  extras: Record<string, unknown> = {}
): unknown {
  return {
    version: 2,
    id,
    title: id,
    scenes: [{ id: "s1", title: "S1", ...scene }],
    ...extras,
  };
}
