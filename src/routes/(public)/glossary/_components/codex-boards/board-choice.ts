// Which of the three candidate boards the codex is showing.
//
// The switcher does not get a row of its own. A drilled glossary category
// already spends one full-width row on "Categories / <title> / <count>", and a
// second row underneath it holding three short labels is most of a row of
// pictographs thrown away. So the switcher renders inside that existing header
// row, which puts the choice in the page and the boards in LetterCodex - and
// this module is what the two agree on.
//
// All of this is scaffolding for the comparison. When one board wins, the
// switcher, this module and the two losing boards come out together.

export type BoardKey = "sheets" | "atlas" | "stage";

export const BOARDS: { value: BoardKey; label: string; ariaLabel: string }[] = [
  {
    value: "sheets",
    label: "Sheets",
    ariaLabel: "Sheets layout - the guide's two printed pages",
  },
  {
    value: "atlas",
    label: "Atlas",
    ariaLabel: "Atlas layout - one band per type, boxes flowing across the width",
  },
  {
    value: "stage",
    label: "Stage",
    ariaLabel: "Stage layout - compact index beside a large inspector",
  },
];

export function readBoard(value: string | null): BoardKey {
  return value === "atlas" || value === "stage" || value === "sheets"
    ? value
    : "atlas";
}
