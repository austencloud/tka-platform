<!--
  CodexSheetPicker — canonical codex letter map, rendered on the PROVEN pipeline.

  Each cell is the real representative pictograph for a letter (from the same
  letterQueryHandler dataframe the variations pane uses), rendered via
  PictographContainer. No guide/print data — that carried malformed arrows and a
  baked-in turn. Correct arrows, real turns, global dark mode, transform support.

  Layout: pictographs float (no box backdrop), uniform square size. Boxes are the
  canonical groupings (ABC | DEF …). Transition labels (α→α, γ→γ…) are derived
  from real positions and GROUPED — a run of identical transitions shows a single
  centered label (so γ→γ appears once over M–V). OPEN/CLOSE rides each box.
-->
<script lang="ts">
  import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/pictograph-data";
  import PictographContainer from "$lib/shared/pictograph/shared/components/PictographContainer.svelte";

  let {
    representatives,
    selectedLetter,
    darkMode = false,
    onSelect,
  }: {
    representatives: Map<string, PictographData>;
    selectedLetter: string;
    darkMode?: boolean;
    onSelect: (letter: string) => void;
  } = $props();

  interface BoxDef {
    letters: string[];
    mode?: "OPEN" | "CLOSE";
    full?: boolean;
  }
  interface TypeDef {
    n: number;
    label: string;
    word: string;
    color: string;
    boxes: BoxDef[];
  }

  // Canonical codex arrangement.
  const CODEX: TypeDef[] = [
    {
      n: 1, label: "Type 1", word: "Dual-Shift", color: "#36c3ff",
      boxes: [
        { letters: ["A", "B", "C"] }, { letters: ["D", "E", "F"] },
        { letters: ["G", "H", "I"] }, { letters: ["J", "K", "L"] },
        { letters: ["M", "N", "O"] }, { letters: ["P", "Q", "R"] },
        { letters: ["S", "T", "U", "V"], full: true },
      ],
    },
    {
      n: 2, label: "Type 2", word: "Shift", color: "#6F2DA8",
      boxes: [
        { letters: ["W", "X"], mode: "OPEN" }, { letters: ["Y", "Z"], mode: "CLOSE" },
        { letters: ["Σ", "Δ"], mode: "CLOSE" }, { letters: ["Θ", "Ω"], mode: "OPEN" },
      ],
    },
    {
      n: 3, label: "Type 3", word: "Cross-Shift", color: "#26e600",
      boxes: [
        { letters: ["W-", "X-"] }, { letters: ["Y-", "Z-"] },
        { letters: ["Θ-", "Ω-"] }, { letters: ["Σ-", "Δ-"] },
      ],
    },
    { n: 4, label: "Type 4", word: "Dash", color: "#26e600", boxes: [{ letters: ["Φ", "Ψ", "Λ"], full: true }] },
    { n: 5, label: "Type 5", word: "Dual-Dash", color: "#00b3ff", boxes: [{ letters: ["Φ-", "Ψ-", "Λ-"], full: true }] },
    { n: 6, label: "Type 6", word: "Static", color: "#eb7d00", boxes: [{ letters: ["α", "β", "γ"], full: true }] },
  ];

  const POS: Record<string, string> = { alpha: "α", beta: "β", gamma: "γ" };
  function posGlyph(p: unknown): string {
    const s = String(p ?? "").toLowerCase().replace(/[0-9]/g, "");
    return POS[s] ?? "";
  }

  function boxTransition(box: BoxDef): string {
    for (const l of box.letters) {
      const rep = representatives.get(l);
      if (rep?.startPosition && rep?.endPosition) {
        const a = posGlyph(rep.startPosition);
        const b = posGlyph(rep.endPosition);
        if (a && b) return `${a}→${b}`;
      }
    }
    return "";
  }

  // Per-box transition label, blanked when identical to the box before it, so a
  // repeated transition (the γ→γ run on M–V) shows its label only once.
  function dedupedTransitions(type: TypeDef): string[] {
    let prev = "";
    return type.boxes.map((box) => {
      const t = boxTransition(box);
      const show = t && t !== prev ? t : "";
      prev = t;
      return show;
    });
  }
</script>

<div class="sheet">
  {#each CODEX as type (type.n)}
    {@const transitions = dedupedTransitions(type)}
    <div class="type-block">
      <h3 class="type-head">
        <span class="type-n">{type.label}</span>
        <span class="type-word" style:color={type.color}>{type.word}</span>
      </h3>

      <div class="boxes">
        {#each type.boxes as box, bi (bi)}
          <div class="box" class:full={box.full}>
            <div class="box-head">
              <span class="box-trans">{transitions[bi]}</span>
              {#if box.mode}<span class="box-mode">{box.mode}</span>{/if}
            </div>
            <div class="cells" style:--cols={box.letters.length}>
              {#each box.letters as letter (letter)}
                {@const data = representatives.get(letter)}
                <button
                  type="button"
                  class="cell"
                  class:active={selectedLetter === letter}
                  aria-pressed={selectedLetter === letter}
                  aria-label={letter}
                  onclick={() => onSelect(letter)}
                >
                  <span class="picto">
                    {#if data}
                      <PictographContainer
                        pictographData={data}
                        {darkMode}
                        showGrid={true}
                        showTKA={true}
                        showTnD={false}
                        showReversals={false}
                      />
                    {:else}
                      <span class="missing">{letter}</span>
                    {/if}
                  </span>
                </button>
              {/each}
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/each}
</div>

<style>
  .sheet {
    --cell: 76px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    align-items: center;
  }

  .type-block {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }

  .type-head {
    display: flex;
    align-items: baseline;
    justify-content: center;
    gap: 8px;
    margin: 2px 0;
    font-family: Georgia, "Times New Roman", serif;
    font-style: italic;
    font-size: 1rem;
  }
  .type-n { color: var(--theme-text, #fff); font-weight: 600; }
  .type-word { font-weight: 600; }

  /* Two boxes per row (ABC | DEF), content-sized, centered, gap between the
     pair. Full boxes (STUV, dash, static) span both columns and center. */
  .boxes {
    display: grid;
    grid-template-columns: repeat(2, auto);
    justify-content: center;
    justify-items: center;
    align-items: start;
    gap: 12px 36px;
  }
  .box {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
  }
  .box.full { grid-column: 1 / -1; }

  /* Label centered over each box; reserved height keeps paired boxes aligned
     even when a box's label is blank (deduped). */
  .box-head {
    display: flex;
    align-items: baseline;
    justify-content: center;
    gap: 6px;
    min-height: 1.1em;
  }
  .box-trans { font-size: 0.78rem; font-weight: 700; color: var(--theme-text, #fff); }
  .box-mode {
    font-style: italic;
    font-size: 0.56rem;
    letter-spacing: 0.1em;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.45));
  }

  /* No backdrop — pictographs float. Uniform square cells. */
  .cells {
    display: grid;
    grid-template-columns: repeat(var(--cols), var(--cell));
    justify-content: center;
    gap: 6px;
  }

  .cell {
    width: var(--cell);
    height: var(--cell);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2px;
    border: 1.5px solid transparent;
    border-radius: 8px;
    background: transparent;
    cursor: pointer;
    transition: border-color 120ms, transform 120ms;
  }
  .cell:hover { transform: translateY(-1px); }
  .cell.active {
    border-color: var(--theme-accent, #50c878);
    box-shadow: 0 0 0 1px var(--theme-accent, #50c878);
  }

  .picto {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .picto :global(.pictograph),
  .picto :global(svg) { width: 100%; height: 100%; }

  .missing {
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
  }
</style>
