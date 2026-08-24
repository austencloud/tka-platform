export function corpusFilm(
  id: string,
  shot: Record<string, unknown>,
  extras: Record<string, unknown> = {}
): unknown {
  return {
    version: 2,
    id,
    title: id,
    shots: [{ id: "s1", title: "S1", ...shot }],
    ...extras,
  };
}
