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
import Type5DualDashPage from "../_pages/Type5DualDashPage.svelte";
import Type6StaticPage from "../_pages/Type6StaticPage.svelte";
import OneOneType1Page from "../_pages/OneOneType1Page.svelte";
import OneOneType23Page from "../_pages/OneOneType23Page.svelte";
import OneOneType456Page from "../_pages/OneOneType456Page.svelte";
import CodexOneZeroType1Page from "../_pages/CodexOneZeroType1Page.svelte";
import CodexZeroOneType23Page from "../_pages/CodexZeroOneType23Page.svelte";
import CodexOneZeroType23And456Page from "../_pages/CodexOneZeroType23And456Page.svelte";
import CodexOneOneType1Page from "../_pages/CodexOneOneType1Page.svelte";
import CodexOneOneType23Page from "../_pages/CodexOneOneType23Page.svelte";
import CodexOneOneType456Page from "../_pages/CodexOneOneType456Page.svelte";

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
  "t5-dual-dash": Type5DualDashPage,
  "t6-static": Type6StaticPage,
  "one-one-t1": OneOneType1Page,
  "one-one-t23": OneOneType23Page,
  "one-one-t456": OneOneType456Page,
  "codex-1-0-t1": CodexOneZeroType1Page,
  "codex-0-1-t23": CodexZeroOneType23Page,
  "codex-1-0-t23-456": CodexOneZeroType23And456Page,
  "codex-1-1-t1": CodexOneOneType1Page,
  "codex-1-1-t23": CodexOneOneType23Page,
  "codex-1-1-t456": CodexOneOneType456Page,
};
