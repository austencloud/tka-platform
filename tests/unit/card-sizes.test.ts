import { describe, it, expect } from 'vitest';
import { CARD_SIZES, getPageLayout } from '$lib/features/choreo-card/domain/card-sizes';

describe('CARD_SIZES', () => {
  it('poker dimensions match existing MPC constants', () => {
    expect(CARD_SIZES.poker.canvasWidth).toBe(822);
    expect(CARD_SIZES.poker.canvasHeight).toBe(1122);
    expect(CARD_SIZES.poker.bleedPx).toBe(36);
    expect(CARD_SIZES.poker.contentWidth).toBe(750);
    expect(CARD_SIZES.poker.contentHeight).toBe(1050);
  });

  it('tarot dimensions are correct at 300 DPI', () => {
    expect(CARD_SIZES.tarot.canvasWidth).toBe(897);
    expect(CARD_SIZES.tarot.canvasHeight).toBe(1497);
    expect(CARD_SIZES.tarot.bleedPx).toBe(36);
    expect(CARD_SIZES.tarot.contentWidth).toBe(825);
    expect(CARD_SIZES.tarot.contentHeight).toBe(1425);
  });
});

describe('getPageLayout', () => {
  it('poker layout matches existing PrintPDFExporter (3x3=9)', () => {
    const layout = getPageLayout('poker');
    expect(layout.cols).toBe(3);
    expect(layout.rows).toBe(3);
    expect(layout.cardsPerPage).toBe(9);
    expect(layout.cardWidthPt).toBe(180);
    expect(layout.cardHeightPt).toBe(252);
  });

  it('tarot layout fits 2x2=4 on letter (bigger cards than poker)', () => {
    const layout = getPageLayout('tarot');
    expect(layout.cols).toBe(2);
    expect(layout.rows).toBe(2);
    expect(layout.cardsPerPage).toBe(4);
    expect(layout.cardWidthPt).toBe(198);
    expect(layout.cardHeightPt).toBe(342);
  });

  it('margins are centered on letter page', () => {
    const poker = getPageLayout('poker');
    expect(poker.marginXPt).toBe(36);
    expect(poker.marginYPt).toBe(18);

    const tarot = getPageLayout('tarot');
    expect(tarot.marginXPt).toBe(108);
    expect(tarot.marginYPt).toBe(54);
  });
});
