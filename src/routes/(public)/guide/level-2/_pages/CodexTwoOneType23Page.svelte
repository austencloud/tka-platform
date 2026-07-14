<script lang="ts">
  /**
   * Codex 2/1 — Type 2/3 — Level 2 body page 30 (manifest `codex-2-1-t23`), faithful
   * to old p30. p21 split-column layout with 2 turns on the high slot and 1 on the
   * low (`²₁`), Same (rows 1–2) and Opp (rows 3–4).
   */
  import CodexGridPage, { type CodexCell } from "../_components/CodexGridPage.svelte";
  import { codexRelData } from "../_data/codex-turns";

  const cell = (letter: string, rel: "same" | "opp"): CodexCell => ({
    data: codexRelData(letter, 2, 1, rel),
    letter,
    sup: "2",
    sub: "1",
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

<CodexGridPage turnLabel="2 / 1" {leftHeader} {rightHeader} {rows} />
