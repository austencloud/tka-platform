<script lang="ts">
  /**
   * The notation, live. These columns are the formula a,b(h(±x±y±z)h'){Class}a',b'
   * with the variables spelled out as headings, using the simplified hand
   * substitution the written guide uses throughout.
   */
  import type { QftIncrement } from "$lib/shared/notation/qft/qft-model";

  interface Props {
    increments: QftIncrement[];
    activeStep: number;
    /**
     * Show only the step currently on screen, as a labelled strip.
     *
     * Eight rows of seven numbers are not readable on a 375px screen, and
     * forcing them there costs the animation the room it needs. On a small
     * screen the animation is the subject and the notation is its caption; on a
     * large one the whole table is legible at once, and the sweep down the
     * columns is itself worth seeing.
     */
    compact?: boolean;
  }

  let { increments, activeStep, compact = false }: Props = $props();

  const cell = (v: number | "n") => (v === "n" ? "n" : String(v));

  const active = $derived(increments[activeStep] ?? increments[0]);

  const strip = $derived(
    active
      ? [
          { label: "Prop depart", value: cell(active.propDepart) },
          { label: "Dir depart", value: cell(active.propDirDepart) },
          { label: "Hand depart", value: cell(active.handDepart) },
          { label: "Radius", value: String(active.radius) },
          { label: "Hand arrive", value: cell(active.handArrive) },
          { label: "Dir arrive", value: cell(active.propDirArrive) },
          { label: "Prop arrive", value: cell(active.propArrive) }
        ]
      : []
  );
</script>

{#if compact}
  <dl class="strip">
    {#each strip as item (item.label)}
      <div class="pair">
        <dt>{item.label}</dt>
        <dd>{item.value}</dd>
      </div>
    {/each}
  </dl>
{:else}
<div class="wrap">
  <table>
    <caption class="sr-only">
      QfT notation rows for the current pattern, one row per eighth of a hand revolution
    </caption>
    <colgroup><col class="c-step" /></colgroup>
    <colgroup class="g-depart"><col /><col /><col /></colgroup>
    <colgroup class="g-radius"><col /></colgroup>
    <colgroup class="g-arrive"><col /><col /><col /></colgroup>
    <thead>
      <!--
        Two header rows because the seven columns are not seven peers: they are
        a departure, a radius, and an arrival. Reading them as one flat run of
        digits is what made this look like a spreadsheet.
      -->
      <tr class="groups">
        <td></td>
        <th scope="colgroup" colspan="3">Depart</th>
        <th scope="col">Radius</th>
        <th scope="colgroup" colspan="3">Arrive</th>
      </tr>
      <tr class="fields">
        <td><span class="sr-only">Step</span></td>
        <th scope="col">Prop</th>
        <th scope="col">Dir</th>
        <th scope="col">Hand</th>
        <th scope="col"><span class="sr-only">Radius</span></th>
        <th scope="col">Hand</th>
        <th scope="col">Dir</th>
        <th scope="col">Prop</th>
      </tr>
    </thead>
    <tbody>
      {#each increments as row, i (i)}
        <tr class:active={i === activeStep}>
          <th scope="row" class="step">{i + 1}</th>
          <td>{row.propDepart}</td>
          <td class:unresolved={row.propDirDepart === "n"}>{cell(row.propDirDepart)}</td>
          <td>{row.handDepart}</td>
          <td class="radius">{row.radius}</td>
          <td>{row.handArrive}</td>
          <td class:unresolved={row.propDirArrive === "n"}>{cell(row.propDirArrive)}</td>
          <td>{row.propArrive}</td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>
{/if}

<style>
  .strip {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.4rem 1rem;
    margin: 0;
    padding: 0.9rem 1rem;
    border-radius: 0.75rem;
    border: 1px solid var(--semantic-border-subtle, rgb(255 255 255 / 0.12));
    background: var(--semantic-surface-raised, rgb(0 0 0 / 0.24));
  }

  .strip .pair {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.5rem;
  }

  .strip dt {
    font-size: 0.78rem;
    color: var(--semantic-text-secondary, rgb(255 255 255 / 0.6));
  }

  .strip dd {
    margin: 0;
    font-size: 1.05rem;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    /* Reserved so a value going from 8 to n never shifts its label. */
    min-width: 1.5ch;
    text-align: right;
  }

  .wrap {
    /*
     * Never the thing that shrinks. As a flex child in a squeezed column this
     * would otherwise collapse into a two-row sliver behind a scrollbar, which
     * is the one element on the page that must stay whole — it is the notation.
     */
    flex: none;
    overflow-x: auto;
    border-radius: 0.75rem;
    border: 1px solid var(--semantic-border-subtle, rgb(255 255 255 / 0.12));
    background: var(--semantic-surface-raised, rgb(0 0 0 / 0.24));
  }

  table {
    width: 100%;
    /*
     * Fixed, so the active row can change weight without any column resizing
     * under it. With auto layout a bolder 8 is a wider 8, and the whole table
     * would breathe once a second.
     */
    table-layout: fixed;
    border-collapse: collapse;
    font-variant-numeric: tabular-nums;
  }

  .c-step {
    width: 2.6rem;
  }

  /* The three groups read as three things. Rules, not boxes — boxes would make
     it more of a spreadsheet, not less. */
  .g-radius,
  .g-arrive {
    border-left: 1px solid var(--semantic-border-subtle, rgb(255 255 255 / 0.14));
  }

  .groups th {
    padding: 0.65rem 0.4rem 0.15rem;
    font-size: 0.7rem;
    font-weight: 500;
    letter-spacing: 0.09em;
    text-transform: uppercase;
    color: var(--semantic-text-secondary, rgb(255 255 255 / 0.42));
  }

  .fields th {
    padding: 0 0.4rem 0.55rem;
    font-size: 0.78rem;
    font-weight: 600;
    line-height: 1.15;
    color: var(--semantic-text-secondary, rgb(255 255 255 / 0.62));
    white-space: nowrap;
  }

  thead {
    border-bottom: 1px solid var(--semantic-border-subtle, rgb(255 255 255 / 0.12));
  }

  tbody td,
  .step {
    padding: 0.5rem 0.4rem;
    text-align: center;
    font-size: 1.05rem;
    font-weight: 500;
    color: var(--semantic-text-primary, rgb(255 255 255 / 0.9));
  }

  /*
   * One row is the step on screen; the other seven are the context it sits in.
   * Everything recedes except the row the stage is currently drawing.
   */
  tbody tr {
    opacity: 0.38;
    transition: opacity 220ms ease;
  }

  tbody tr.active {
    opacity: 1;
  }

  .step {
    font-size: 0.8rem;
    font-weight: 500;
    color: var(--semantic-text-secondary, rgb(255 255 255 / 0.45));
    /* Reserved so the accent marker cannot move the digits when it appears. */
    border-left: 2px solid transparent;
  }

  tr.active .step {
    border-left-color: var(--theme-accent, #8b5cf6);
    color: var(--semantic-text-primary, rgb(255 255 255 / 0.9));
  }

  tr.active td {
    font-weight: 700;
  }

  td.radius {
    color: var(--semantic-text-secondary, rgb(255 255 255 / 0.62));
    font-size: 0.92rem;
  }

  td.unresolved {
    color: var(--semantic-warning, #fbbf24);
    font-style: italic;
  }

  @media (prefers-reduced-motion: reduce) {
    tbody tr {
      transition: none;
    }
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
</style>
