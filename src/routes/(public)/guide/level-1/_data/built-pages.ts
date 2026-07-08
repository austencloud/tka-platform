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

export const BUILT: Record<string, Component> = {
  "the-grid": TheGridPage,
  "hand-positions": HandPositionsPage,
  "hand-motions": HandMotionsPage,
  "hm-type1": Type1AlphaBetaPage,
  "hm-gamma": GammaPage,
  "hm-type2": Type2ShiftsPage,
  "hm-type34": Type3CrossShiftsPage,
  "hm-type56": Type456Page,
};
