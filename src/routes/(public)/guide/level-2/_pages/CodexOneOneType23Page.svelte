<script lang="ts">
  /**
   * Codex 1/1 — Type 2/3 — Level 2 body page 21 (manifest `codex-1-1-t23`),
   * faithful to old p21. Same split-column layout as p18 (Type 2 shift | Type 3
   * cross-shift) but with a turn on BOTH hands (`¹₁`), shown in Same (rows 1–2, dot
   * above) and Opp (rows 3–4, dot below). Cell data via codexRelData with hi=lo=1.
   */
  import CodexGridPage, { type CodexCell } from "../_components/CodexGridPage.svelte";
  import { codexRelData } from "../_data/codex-turns";

  const cell = (letter: string, rel: "same" | "opp"): CodexCell => ({
    data: codexRelData(letter, 1, 1, rel),
    letter,
    slot: "both",
    dot: rel,
  });

  const T2a = ["W", "X", "Y", "Z"];
  const T2b = ["Σ", "Δ", "Θ", "Ω"];
  const T3a = ["W-", "X-", "Y-", "Z-"];
  const T3b = ["Σ-", "Δ-", "Θ-", "Ω-"];

  const rows: CodexCell[][] = [
    [...T2a.map((l) => cell(l, "same")), ...T3a.map((l) => cell(l, "same"))],
    [...T2b.map((l) => cell(l, "same")), ...T3b.map((l) => cell(l, "same"))],
    [...T2a.map((l) => cell(l, "opp")), ...T3a.map((l) => cell(l, "opp"))],
    [...T2b.map((l) => cell(l, "opp")), ...T3b.map((l) => cell(l, "opp"))],
  ];

  const leftHeader = [{ t: "Type 2 - " }, { t: "Shift", c: "#7048b6" }];
  const rightHeader = [{ t: "Type 3 - " }, { t: "Cross", c: "#2f9e44" }, { t: "-Shift", c: "#7048b6" }];
</script>

<CodexGridPage turnLabel="1 / 1" {leftHeader} {rightHeader} {rows} />
