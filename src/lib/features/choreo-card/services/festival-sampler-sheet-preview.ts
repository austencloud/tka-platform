import { CARD_SIZES, getPageLayout } from "../domain/card-sizes";
import { mirrorFestivalSheetColumns } from "./festival-sampler-sheet";
import type { CardPair } from "./types";

export type FestivalSamplerSheetSide = "front" | "back";

export interface FestivalSamplerPreviewPlacement<
  TPair extends CardPair = CardPair,
> {
  pair: TPair;
  sourceIndex: number;
  source: HTMLCanvasElement;
  sourceX: number;
  sourceY: number;
  sourceWidth: number;
  sourceHeight: number;
  destinationX: number;
  destinationY: number;
  destinationWidth: number;
  destinationHeight: number;
}

const poker = CARD_SIZES.poker;
const letterLayout = getPageLayout("poker", "letter");

export const FESTIVAL_PREVIEW_PAGE_WIDTH = letterLayout.pageWidthPt;
export const FESTIVAL_PREVIEW_PAGE_HEIGHT = letterLayout.pageHeightPt;

export function planFestivalSamplerSheetPreview<TPair extends CardPair>(
  pairs: readonly TPair[],
  side: FestivalSamplerSheetSide
): FestivalSamplerPreviewPlacement<TPair>[] {
  if (pairs.length !== letterLayout.cardsPerPage) {
    throw new Error(
      `Festival preview needs ${letterLayout.cardsPerPage} cards; received ${pairs.length}`
    );
  }

  const indexedPairs = pairs.map((pair, sourceIndex) => ({
    pair,
    sourceIndex,
  }));
  const orderedPairs =
    side === "back" ? mirrorFestivalSheetColumns(indexedPairs) : indexedPairs;

  return orderedPairs.map(({ pair, sourceIndex }, index) => {
    const source = pair[side];
    const sourceScaleX = source.width / poker.canvasWidth;
    const sourceScaleY = source.height / poker.canvasHeight;
    const column = index % letterLayout.cols;
    const row = Math.floor(index / letterLayout.cols);

    return {
      pair,
      sourceIndex,
      source,
      sourceX: poker.bleedPx * sourceScaleX,
      sourceY: poker.bleedPx * sourceScaleY,
      sourceWidth: poker.contentWidth * sourceScaleX,
      sourceHeight: poker.contentHeight * sourceScaleY,
      destinationX:
        letterLayout.marginXPt +
        column * (letterLayout.cardWidthPt + letterLayout.gutterPt),
      destinationY:
        letterLayout.marginYPt +
        row * (letterLayout.cardHeightPt + letterLayout.gutterPt),
      destinationWidth: letterLayout.cardWidthPt,
      destinationHeight: letterLayout.cardHeightPt,
    };
  });
}

export function drawFestivalSamplerSheetPreview(
  canvas: HTMLCanvasElement,
  pairs: readonly CardPair[],
  side: FestivalSamplerSheetSide
): void {
  canvas.width = FESTIVAL_PREVIEW_PAGE_WIDTH;
  canvas.height = FESTIVAL_PREVIEW_PAGE_HEIGHT;

  const context = canvas.getContext("2d");
  if (!context) throw new Error("Festival sheet preview canvas is unavailable");

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";

  for (const placement of planFestivalSamplerSheetPreview(pairs, side)) {
    context.drawImage(
      placement.source,
      placement.sourceX,
      placement.sourceY,
      placement.sourceWidth,
      placement.sourceHeight,
      placement.destinationX,
      placement.destinationY,
      placement.destinationWidth,
      placement.destinationHeight
    );
  }
}
