import type { Component } from 'svelte';

export type PageEntry =
  | { kind: 'svelte'; pageNumber: number; label: string; component: Component }
  | { kind: 'artboard'; pageNumber: number; label: string; src: string };

import Page01FrontCover from '../_pages/Page01FrontCover.svelte';
import Page02DrinkWater from '../_pages/Page02DrinkWater.svelte';
import Page03Support from '../_pages/Page03Support.svelte';
import Page04ReadMeFirst from '../_pages/Page04ReadMeFirst.svelte';
import Page05TableOfContents from '../_pages/Page05TableOfContents.svelte';
import Page06TitlePositions from '../_pages/Page06TitlePositions.svelte';
import Page07TheGrid from '../_pages/Page07TheGrid.svelte';
import Page08HandPositions from '../_pages/Page08HandPositions.svelte';
import Page09HandMotions from '../_pages/Page09HandMotions.svelte';
import Page10Type1AlphaBeta from '../_pages/Page10Type1AlphaBeta.svelte';
import Page11Type1Gamma from '../_pages/Page11Type1Gamma.svelte';
import Page12Type2Shifts from '../_pages/Page12Type2Shifts.svelte';
import Page13Type3and4 from '../_pages/Page13Type3and4.svelte';
import Page14Type5and6 from '../_pages/Page14Type5and6.svelte';
import Page15StaffPositions from '../_pages/Page15StaffPositions.svelte';
import Page16StaffMotions from '../_pages/Page16StaffMotions.svelte';
import Page17NegativeSpace from '../_pages/Page17NegativeSpace.svelte';
import Page18TitleLetters from '../_pages/Page18TitleLetters.svelte';
import Page19CodexType12 from '../_pages/Page19CodexType12.svelte';
import Page20CodexType3456 from '../_pages/Page20CodexType3456.svelte';
import Page21Type1Letters from '../_pages/Page21Type1Letters.svelte';
import Page22AlphaBetaWords from '../_pages/Page22AlphaBetaWords.svelte';
import Page23CompoundLetters from '../_pages/Page23CompoundLetters.svelte';
import Page24CompoundWords from '../_pages/Page24CompoundWords.svelte';
import Page25GammaLetters from '../_pages/Page25GammaLetters.svelte';
import Page26GammaWords from '../_pages/Page26GammaWords.svelte';
import Page27Type2Shifts from '../_pages/Page27Type2Shifts.svelte';
import Page28Type3CrossShifts from '../_pages/Page28Type3CrossShifts.svelte';
import Page29Type456 from '../_pages/Page29Type456.svelte';
import Page30TitleWords from '../_pages/Page30TitleWords.svelte';
import Page31WordsIntro from '../_pages/Page31WordsIntro.svelte';
import Page32Loops from '../_pages/Page32Loops.svelte';
import Page33Reversals from '../_pages/Page33Reversals.svelte';
import Page34AABBExamples from '../_pages/Page34AABBExamples.svelte';
import Page35AABBBodyTurn from '../_pages/Page35AABBBodyTurn.svelte';
import Page36ACACBCBC from '../_pages/Page36ACACBCBC.svelte';
import Page37Type1Loops from '../_pages/Page37Type1Loops.svelte';
import Page38GammaLoops from '../_pages/Page38GammaLoops.svelte';
import Page39Type2Loops from '../_pages/Page39Type2Loops.svelte';
import Page40SixteenCount from '../_pages/Page40SixteenCount.svelte';
import Page41EightLetterWords from '../_pages/Page41EightLetterWords.svelte';
import Page42PropReversalLoops from '../_pages/Page42PropReversalLoops.svelte';
import Page43FullReversalLoops from '../_pages/Page43FullReversalLoops.svelte';
import Page44Collaborate from '../_pages/Page44Collaborate.svelte';
import Page45TacoTuesday from '../_pages/Page45TacoTuesday.svelte';
import Page46Stretch from '../_pages/Page46Stretch.svelte';
import Page47BackCover from '../_pages/Page47BackCover.svelte';

const ART = '/guide/level-1/artboards';

export const pages: PageEntry[] = [
  { kind: 'svelte', pageNumber: 1, label: 'Front Cover', component: Page01FrontCover },
  { kind: 'svelte', pageNumber: 2, label: 'drink water', component: Page02DrinkWater },
  { kind: 'svelte', pageNumber: 3, label: 'Support the Author', component: Page03Support },
  { kind: 'svelte', pageNumber: 4, label: 'Read Me First', component: Page04ReadMeFirst },
  { kind: 'svelte', pageNumber: 5, label: 'Table of Contents', component: Page05TableOfContents },
  { kind: 'svelte', pageNumber: 6, label: '1.0 — Positions / Motions', component: Page06TitlePositions },
  { kind: 'svelte', pageNumber: 7, label: 'The Grid', component: Page07TheGrid },
  { kind: 'svelte', pageNumber: 8, label: 'Hand Positions', component: Page08HandPositions },
  { kind: 'svelte', pageNumber: 9, label: 'Hand Motions', component: Page09HandMotions },
  { kind: 'svelte', pageNumber: 10, label: 'Type 1 — Dual-Shifts (alpha, beta)', component: Page10Type1AlphaBeta },
  { kind: 'svelte', pageNumber: 11, label: 'Type 1 — gamma', component: Page11Type1Gamma },
  { kind: 'svelte', pageNumber: 12, label: 'Type 2 — Shifts', component: Page12Type2Shifts },
  { kind: 'svelte', pageNumber: 13, label: 'Type 3 / Type 4', component: Page13Type3and4 },
  { kind: 'svelte', pageNumber: 14, label: 'Type 5 / Type 6', component: Page14Type5and6 },
  { kind: 'svelte', pageNumber: 15, label: 'Staff Positions', component: Page15StaffPositions },
  { kind: 'svelte', pageNumber: 16, label: 'Staff Motions', component: Page16StaffMotions },
  { kind: 'svelte', pageNumber: 17, label: 'Negative Space / Body Turns', component: Page17NegativeSpace },
  { kind: 'svelte', pageNumber: 18, label: '1.1 — Letters', component: Page18TitleLetters },
  { kind: 'svelte', pageNumber: 19, label: 'Codex — Type 1, 2', component: Page19CodexType12 },
  { kind: 'svelte', pageNumber: 20, label: 'Codex — Type 3, 4, 5, 6', component: Page20CodexType3456 },
  { kind: 'svelte', pageNumber: 21, label: 'Type 1 — Dual-Shift letters', component: Page21Type1Letters },
  { kind: 'svelte', pageNumber: 22, label: 'Alpha/Beta Words — ABC, GHI', component: Page22AlphaBetaWords },
  { kind: 'svelte', pageNumber: 23, label: 'Compound Letters', component: Page23CompoundLetters },
  { kind: 'svelte', pageNumber: 24, label: 'Compound Words — DJ, EK, FL', component: Page24CompoundWords },
  { kind: 'svelte', pageNumber: 25, label: 'Gamma Letters', component: Page25GammaLetters },
  { kind: 'svelte', pageNumber: 26, label: 'Gamma Words — MP, NQ, OR, STUV', component: Page26GammaWords },
  { kind: 'svelte', pageNumber: 27, label: 'Type 2 — Shifts (letters)', component: Page27Type2Shifts },
  { kind: 'svelte', pageNumber: 28, label: 'Type 3 — Cross-Shifts (letters)', component: Page28Type3CrossShifts },
  { kind: 'svelte', pageNumber: 29, label: 'Type 4, 5, 6 (letters)', component: Page29Type456 },
  { kind: 'svelte', pageNumber: 30, label: '1.2 — Words / LOOPs / Reversals', component: Page30TitleWords },
  { kind: 'svelte', pageNumber: 31, label: 'Words intro', component: Page31WordsIntro },
  { kind: 'svelte', pageNumber: 32, label: 'LOOPs (CAPs)', component: Page32Loops },
  { kind: 'svelte', pageNumber: 33, label: 'Reversals', component: Page33Reversals },
  { kind: 'svelte', pageNumber: 34, label: 'Examples — AABB', component: Page34AABBExamples },
  { kind: 'svelte', pageNumber: 35, label: 'AABB body turn / CCCC', component: Page35AABBBodyTurn },
  { kind: 'svelte', pageNumber: 36, label: 'ACAC, BCBC reversals', component: Page36ACACBCBC },
  { kind: 'svelte', pageNumber: 37, label: 'Type 1 LOOPs — DJII, BBLF, KIEC', component: Page37Type1Loops },
  { kind: 'svelte', pageNumber: 38, label: 'Gamma LOOPs — SOTR, VPUQ, MVNU', component: Page38GammaLoops },
  { kind: 'svelte', pageNumber: 39, label: 'Type 2 LOOPs — BΣTX, EΔUZ, OYHθ', component: Page39Type2Loops },
  { kind: 'svelte', pageNumber: 40, label: '16-count — GθOZ, EΔQY', component: Page40SixteenCount },
  { kind: 'svelte', pageNumber: 41, label: '8-Letter Words', component: Page41EightLetterWords },
  { kind: 'svelte', pageNumber: 42, label: 'Prop-Reversal LOOPs', component: Page42PropReversalLoops },
  { kind: 'svelte', pageNumber: 43, label: 'Full-Reversal LOOPs', component: Page43FullReversalLoops },
  { kind: 'svelte', pageNumber: 44, label: "Let's Collaborate", component: Page44Collaborate },
  { kind: 'svelte', pageNumber: 45, label: 'Taco Tuesday', component: Page45TacoTuesday },
  { kind: 'svelte', pageNumber: 46, label: 'Stretch Reminder', component: Page46Stretch },
  { kind: 'svelte', pageNumber: 47, label: 'Back Cover', component: Page47BackCover },
];
