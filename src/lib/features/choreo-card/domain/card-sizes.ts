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

// US Letter in points (1 inch = 72 points)
const LETTER_W_PT = 612; // 8.5 * 72
const LETTER_H_PT = 792; // 11 * 72

export interface PageLayout {
  cols: number;
  rows: number;
  cardsPerPage: number;
  cardWidthPt: number;
  cardHeightPt: number;
  gutterPt: number;
  marginXPt: number;
  marginYPt: number;
}

const GUTTER_PT = 0;

const PAGE_LAYOUTS: Record<CardSizeId, PageLayout> = {
  poker: buildLayout(CARD_SIZES.poker, 3, 3),
  tarot: buildLayout(CARD_SIZES.tarot, 3, 2),
};

function buildLayout(
  size: (typeof CARD_SIZES)[CardSizeId],
  cols: number,
  rows: number
): PageLayout {
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
    marginXPt: (LETTER_W_PT - gridW) / 2,
    marginYPt: (LETTER_H_PT - gridH) / 2,
  };
}

export function getPageLayout(cardSize: CardSizeId): PageLayout {
  return PAGE_LAYOUTS[cardSize];
}
