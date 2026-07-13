/**
 * Level 2 guide — BUILT page registry. Maps manifest id → the page component
 * that faithfully rebuilds that original page. Unregistered ids render the
 * shared PagePlaceholder in /print and /book until built (mirrors
 * level-1/_data/built-pages.ts).
 */
import type { Component } from "svelte";
import DividerOneTurnsPage from "../_pages/DividerOneTurnsPage.svelte";
import TurnsPage from "../_pages/TurnsPage.svelte";
import DashStaticTurnsPage from "../_pages/DashStaticTurnsPage.svelte";
import GlyphsPadsPage from "../_pages/GlyphsPadsPage.svelte";
import Type1DualShiftPage from "../_pages/Type1DualShiftPage.svelte";
import SAndTPage from "../_pages/SAndTPage.svelte";
import Type2ShiftPage from "../_pages/Type2ShiftPage.svelte";
import Type3CrossShiftPage from "../_pages/Type3CrossShiftPage.svelte";
import Type4DashPage from "../_pages/Type4DashPage.svelte";
import OpeningClosingPage from "../_pages/OpeningClosingPage.svelte";

export const BUILT2: Record<string, Component> = {
  // Pages register here as they are built (see the level-2 rebuild tracker).
  "divider-1-turns": DividerOneTurnsPage,
  "turns-shifts": TurnsPage,
  "turns-dash-static": DashStaticTurnsPage,
  "glyphs-pads": GlyphsPadsPage,
  "t1-dual-shift": Type1DualShiftPage,
  "s-and-t": SAndTPage,
  "t2-shift": Type2ShiftPage,
  "t3-cross-shift": Type3CrossShiftPage,
  "t4-dash": Type4DashPage,
  "opening-closing": OpeningClosingPage,
};
