/**
 * Built body-page components, keyed by manifest id (see guide-manifest.ts).
 * SHARED by both the print route (/print) and the book route (/book) so a page,
 * once rebuilt, shows identically in both. Any manifest id NOT in here renders a
 * numbered placeholder. Add an entry as each body page is rebuilt page-by-page.
 */
import type { Component } from "svelte";
import TheGridPage from "../_pages/TheGridPage.svelte";
import HandPositionsPage from "../_pages/HandPositionsPage.svelte";

export const BUILT: Record<string, Component> = {
  "the-grid": TheGridPage,
  "hand-positions": HandPositionsPage,
};
