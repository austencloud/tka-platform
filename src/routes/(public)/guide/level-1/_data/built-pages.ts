/**
 * Built body-page components, keyed by manifest id (see guide-manifest.ts).
 * SHARED by both the print route (/print) and the book route (/book) so a page,
 * once rebuilt, shows identically in both. Any manifest id NOT in here renders a
 * numbered placeholder. Add an entry as each body page is rebuilt page-by-page.
 */
import type { Component } from "svelte";
import TheGridPage from "../_pages/TheGridPage.svelte";
import HandPositionsPage from "../_pages/HandPositionsPage.svelte";
import HandMotionsPage from "../_pages/HandMotionsPage.svelte";
import Type1AlphaBetaPage from "../_pages/Type1AlphaBetaPage.svelte";
import GammaPage from "../_pages/GammaPage.svelte";
import Type2ShiftsPage from "../_pages/Type2ShiftsPage.svelte";
import Type3CrossShiftsPage from "../_pages/Type3CrossShiftsPage.svelte";
import Type456Page from "../_pages/Type456Page.svelte";
import StaffPositionsPage from "../_pages/StaffPositionsPage.svelte";
import StaffMotionsPage from "../_pages/StaffMotionsPage.svelte";
import NegativeSpacePage from "../_pages/NegativeSpacePage.svelte";
import BaseLettersPage from "../_pages/BaseLettersPage.svelte";
import AlphaBetaWordsPage from "../_pages/AlphaBetaWordsPage.svelte";
import CompoundLettersPage from "../_pages/CompoundLettersPage.svelte";
import GammaLettersPage from "../_pages/GammaLettersPage.svelte";
import GammaWordsPage from "../_pages/GammaWordsPage.svelte";
import Type2ShiftLettersPage from "../_pages/Type2ShiftLettersPage.svelte";
import Type3CrossShiftLettersPage from "../_pages/Type3CrossShiftLettersPage.svelte";
import Type456LettersPage from "../_pages/Type456LettersPage.svelte";
import WordsPage from "../_pages/WordsPage.svelte";
import LoopsPage from "../_pages/LoopsPage.svelte";
import ReversalsPage from "../_pages/ReversalsPage.svelte";
import DoubleStaffCodexT12Page from "../_pages/DoubleStaffCodexT12Page.svelte";
import DoubleStaffCodexT36Page from "../_pages/DoubleStaffCodexT36Page.svelte";

export const BUILT: Record<string, Component> = {
  "the-grid": TheGridPage,
  "hand-positions": HandPositionsPage,
  "hand-motions": HandMotionsPage,
  "hm-type1": Type1AlphaBetaPage,
  "hm-gamma": GammaPage,
  "hm-type2": Type2ShiftsPage,
  "hm-type34": Type3CrossShiftsPage,
  "hm-type56": Type456Page,
  "staff-positions": StaffPositionsPage,
  "staff-motions": StaffMotionsPage,
  "negative-space": NegativeSpacePage,
  "base-letters": BaseLettersPage,
  "lt1-abc-ghi": AlphaBetaWordsPage,
  "lt1-dj-ek-fl": CompoundLettersPage,
  "lt1-mp-nq-or-stuv": GammaLettersPage,
  "lt1-gamma-words": GammaWordsPage,
  "lt2-wxyz": Type2ShiftLettersPage,
  "lt3-dash-letters": Type3CrossShiftLettersPage,
  "lt456-phi-psi-lambda": Type456LettersPage,
  "words": WordsPage,
  "permutations": LoopsPage,
  "reversals": ReversalsPage,
  "bl-double-staff": DoubleStaffCodexT12Page,
  "bl-double-staff-36": DoubleStaffCodexT36Page,
};
