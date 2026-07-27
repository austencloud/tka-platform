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
    <thead>
      <tr>
        <th scope="col">Prop<span>depart</span></th>
        <th scope="col">Dir<span>depart</span></th>
        <th scope="col">Hand<span>depart</span></th>
        <th scope="col">Radius</th>
        <th scope="col">Hand<span>arrive</span></th>
        <th scope="col">Dir<span>arrive</span></th>
        <th scope="col">Prop<span>arrive</span></th>
      </tr>
    </thead>
    <tbody>
      {#each increments as row, i (i)}
        <tr class:active={i === activeStep}>
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
    border-collapse: collapse;
    font-variant-numeric: tabular-nums;
  }

  th {
    padding: 0.7rem 0.4rem 0.6rem;
    font-size: 0.8rem;
    font-weight: 600;
    line-height: 1.15;
    color: var(--semantic-text-secondary, rgb(255 255 255 / 0.62));
    border-bottom: 1px solid var(--semantic-border-subtle, rgb(255 255 255 / 0.12));
    white-space: nowrap;
  }

  th span {
    display: block;
    font-size: 0.68rem;
    font-weight: 400;
    opacity: 0.72;
  }

  td {
    padding: 0.55rem 0.4rem;
    text-align: center;
    font-size: 1.05rem;
    color: var(--semantic-text-primary, rgb(255 255 255 / 0.9));
  }

  td.radius {
    color: var(--semantic-text-secondary, rgb(255 255 255 / 0.55));
    font-size: 0.92rem;
  }

  td.unresolved {
    color: var(--semantic-warning, #fbbf24);
    font-style: italic;
  }

  tr.active {
    background: color-mix(in srgb, var(--theme-accent, #8b5cf6) 22%, transparent);
  }

  tr.active td {
    font-weight: 700;
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
