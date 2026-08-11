export const CARD_SIZES = {
  poker: {
    label: 'Poker 2.5"×3.5"',
    widthInches: 2.5,
    heightInches: 3.5,
    contentWidth: 750,
    contentHeight: 1050,
    canvasWidth: 822,
    canvasHeight: 1122,
    bleedPx: 36,
  },
  tarot: {
    label: 'Tarot 2.75"×4.75"',
    widthInches: 2.75,
    heightInches: 4.75,
    contentWidth: 825,
    contentHeight: 1425,
    canvasWidth: 897,
    canvasHeight: 1497,
    bleedPx: 36,
  },
} as const;

export type CardSizeId = keyof typeof CARD_SIZES;

// Home-print sheet stock (1 inch = 72 points). "superb" is Super B / A3+
// (13"×19", 330×483mm) — the Epson ET-16650's maximum sheet, fed through the
// rear specialty slot for heavy cover stock.
export const PAPER_SIZES = {
  letter: {
    label: 'Letter 8.5"×11"',
    shortLabel: "Letter",
    widthInches: 8.5,
    heightInches: 11,
    widthPt: 612,
    heightPt: 792,
  },
  superb: {
    label: 'Super B 13"×19"',
    shortLabel: '13"×19"',
    widthInches: 13,
    heightInches: 19,
    widthPt: 936,
    heightPt: 1368,
  },
} as const;

export type PaperSizeId = keyof typeof PAPER_SIZES;

export interface PageLayout {
  cols: number;
  rows: number;
  cardsPerPage: number;
  cardWidthPt: number;
  cardHeightPt: number;
  gutterPt: number;
  marginXPt: number;
  marginYPt: number;
  pageWidthPt: number;
  pageHeightPt: number;
}

const GUTTER_PT = 0;

// Grid counts are pinned per card × paper combination, not derived from an
// auto-fill, so every sheet keeps a printable margin. Tarot on Super B stops at
// 3 rows: a 4th row is exactly 19.00" tall — zero margin, inside the printer's
// non-printable edge.
const PAGE_LAYOUTS: Record<PaperSizeId, Record<CardSizeId, PageLayout>> = {
  letter: {
    poker: buildLayout(CARD_SIZES.poker, "letter", 3, 3),
    tarot: buildLayout(CARD_SIZES.tarot, "letter", 3, 2),
  },
  superb: {
    poker: buildLayout(CARD_SIZES.poker, "superb", 5, 5),
    tarot: buildLayout(CARD_SIZES.tarot, "superb", 4, 3),
  },
};

function buildLayout(
  size: (typeof CARD_SIZES)[CardSizeId],
  paperSize: PaperSizeId,
  cols: number,
  rows: number
): PageLayout {
  const paper = PAPER_SIZES[paperSize];
  const cardWidthPt = Math.round(size.widthInches * 72);
  const cardHeightPt = Math.round(size.heightInches * 72);
  const gridW = cols * cardWidthPt + (cols - 1) * GUTTER_PT;
  const gridH = rows * cardHeightPt + (rows - 1) * GUTTER_PT;
  return {
    cols,
    rows,
    cardsPerPage: cols * rows,
    cardWidthPt,
    cardHeightPt,
    gutterPt: GUTTER_PT,
    marginXPt: (paper.widthPt - gridW) / 2,
    marginYPt: (paper.heightPt - gridH) / 2,
    pageWidthPt: paper.widthPt,
    pageHeightPt: paper.heightPt,
  };
}

export function getPageLayout(
  cardSize: CardSizeId,
  paperSize: PaperSizeId = "letter"
): PageLayout {
  return PAGE_LAYOUTS[paperSize][cardSize];
}
