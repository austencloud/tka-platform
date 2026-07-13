/**
 * Level 2 guide — BUILT page registry. Maps manifest id → the page component
 * that faithfully rebuilds that original page. Unregistered ids render the
 * shared PagePlaceholder in /print and /book until built (mirrors
 * level-1/_data/built-pages.ts).
 */
import type { Component } from "svelte";
import DividerOneTurnsPage from "../_pages/DividerOneTurnsPage.svelte";

export const BUILT2: Record<string, Component> = {
  // Pages register here as they are built (see the level-2 rebuild tracker).
  "divider-1-turns": DividerOneTurnsPage,
};
