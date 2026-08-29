<script lang="ts">
  /**
   * GaitOverlay
   *
   * The DOM half of the instrument, mounted beside the canvas rather than
   * inside it. Renders one readout per rig the probe found, so a cast of six
   * is six panels and the odd one out is visible without hunting.
   *
   * Renders nothing at all until the probe is enabled, which is what keeps
   * this free for every surface that carries it and never turns it on.
   */

  import { countFailing, type GaitManeuverProfile } from "./gait-verdicts";
  import GaitReadout from "./GaitReadout.svelte";
  import { gaitProbeState } from "./gait-probe-state.svelte";

  interface Props {
    /** Start collapsed on a surface where the picture matters more. */
    collapsed?: boolean;
    /** Offer the boundary window separately from steady travel. */
    showArrival?: boolean;
    /** Reference family used to choose meaningful diagnostic rows. */
    maneuver?: GaitManeuverProfile;
  }

  let {
    collapsed = false,
    showArrival = false,
    maneuver = "walk",
  }: Props = $props();

  let open = $state(!collapsed);
  let selected = $state<string | null>(null);
  let scope = $state<"gait" | "arrival">("gait");

  const activeReports = $derived(
    scope === "arrival" ? gaitProbeState.arrivalReports : gaitProbeState.reports
  );
  const ids = $derived([...activeReports.keys()].sort());
  // Three full readouts do not fit over a stage, and stacking them buries the
  // thing being measured. One at a time, with the rest one click away.
  const active = $derived(
    selected !== null && ids.includes(selected) ? selected : (ids[0] ?? null)
  );

  /** How many numbers are outside the human range, for the selector chips. */
  function failCount(id: string): number {
    const report = activeReports.get(id);
    if (!report || report.stances.length === 0) return -1;
    return countFailing(report, scope, maneuver);
  }
</script>

{#if gaitProbeState.enabled}
  <div class="gait-overlay" class:open>
    <button
      type="button"
      class="toggle"
      aria-expanded={open}
      onclick={() => (open = !open)}
    >
      <span class="dot" aria-hidden="true"></span>
      Gait probe
      <span class="count">{ids.length}</span>
    </button>

    {#if open}
      <div class="panels">
        {#if showArrival && gaitProbeState.arrivalReports.size > 0}
          <div
            class="scope-picker"
            role="tablist"
            aria-label="Measurement window"
          >
            <button
              type="button"
              role="tab"
              aria-selected={scope === "gait"}
              class:on={scope === "gait"}
              onclick={() => (scope = "gait")}
            >
              Walking
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={scope === "arrival"}
              class:on={scope === "arrival"}
              onclick={() => (scope = "arrival")}
            >
              Arrival
            </button>
          </div>
        {/if}
        {#if ids.length > 1}
          <div class="picker" role="tablist" aria-label="Performer to measure">
            {#each ids as id (id)}
              {@const failing = failCount(id)}
              <button
                type="button"
                role="tab"
                aria-selected={id === active}
                class="pick"
                class:on={id === active}
                onclick={() => (selected = id)}
              >
                {id}
                <span class="pick-score" class:clean={failing === 0}>
                  {failing < 0 ? "--" : failing}
                </span>
              </button>
            {/each}
          </div>
        {/if}

        {#if active}
          <GaitReadout
            label={`${active} · ${
              scope === "arrival"
                ? "arrival"
                : maneuver === "turn-in-place"
                  ? "turning"
                  : maneuver === "lateral"
                    ? "sidestepping"
                    : maneuver === "crossover"
                      ? "grapevine"
                      : "walking"
            }`}
            report={activeReports.get(active) ?? null}
            trail={gaitProbeState.trail(active)}
            {scope}
            {maneuver}
          />
        {:else}
          <p class="empty">No rigged avatars found in this scene yet.</p>
        {/if}
      </div>
    {/if}
  </div>
{/if}

<style>
  .gait-overlay {
    position: absolute;
    right: 0.75rem;
    bottom: 0.75rem;
    z-index: 40;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 0.5rem;
    max-height: calc(100% - 1.5rem);
    pointer-events: none;
  }

  .toggle {
    pointer-events: auto;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    /* Design-system touch floor; px because a target must not scale away. */
    min-height: 44px;
    padding: 0 0.875rem;
    border-radius: 999px;
    border: 1px solid rgba(255, 255, 255, 0.18);
    background: color-mix(in srgb, #0b0f16 88%, transparent);
    color: #e8edf5;
    font-size: 0.8125rem;
    font-weight: 600;
    cursor: pointer;
  }

  .toggle:hover {
    border-color: rgba(255, 255, 255, 0.36);
  }

  .dot {
    width: 0.5rem;
    height: 0.5rem;
    border-radius: 50%;
    background: #ff5f5f;
  }

  .count {
    font-variant-numeric: tabular-nums;
    color: #8b97a8;
  }

  .panels {
    pointer-events: auto;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    width: min(34rem, 40vw);
    overflow-y: auto;
  }

  .picker {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
  }

  .scope-picker {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.25rem;
    padding: 0.2rem;
    border-radius: 0.6rem;
    background: color-mix(in srgb, #0b0f16 88%, transparent);
  }

  .scope-picker button {
    min-height: 44px;
    border: 0;
    border-radius: 0.45rem;
    background: transparent;
    color: #8b97a8;
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }

  .scope-picker button.on {
    background: #243247;
    color: #e8edf5;
  }

  .pick {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    min-height: 44px;
    padding: 0 0.75rem;
    border-radius: 0.5rem;
    border: 1px solid rgba(255, 255, 255, 0.14);
    background: color-mix(in srgb, #0b0f16 88%, transparent);
    color: #8b97a8;
    font-size: 0.75rem;
    cursor: pointer;
  }

  .pick.on {
    border-color: rgba(255, 255, 255, 0.5);
    background: color-mix(in srgb, #16202e 92%, transparent);
    color: #e8edf5;
  }

  .pick-score {
    font-variant-numeric: tabular-nums;
    /* Room for two digits and the placeholder, so selecting a performer
       cannot resize its own chip and shove its neighbours along the row. */
    min-width: 2ch;
    text-align: right;
    color: #ffb454;
  }

  .pick-score.clean {
    color: #7ddc9a;
  }

  .empty {
    margin: 0;
    padding: 0.75rem;
    border-radius: 0.75rem;
    background: color-mix(in srgb, #0b0f16 88%, transparent);
    color: #8b97a8;
    font-size: 0.8125rem;
  }
</style>
