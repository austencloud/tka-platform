<script lang="ts">
  import SegmentedControl from "$lib/shared/ui/components/SegmentedControl.svelte";
  import ScrubbableNumber from "$lib/shared/ui/components/ScrubbableNumber.svelte";
  import { getThirdOrderContext } from "../context/third-order-context";
  import type {
    ThirdOrderCarrierLane,
    ThirdOrderOrientationMode,
    ThirdOrderTimingMode,
  } from "../domain/third-order-composition";

  const state = getThirdOrderContext();
  const laneOptions = [
    { value: "left", label: "Blue carrier", shortLabel: "Blue", tone: "blue" },
    { value: "right", label: "Red carrier", shortLabel: "Red", tone: "red" },
  ] satisfies Array<{
    value: ThirdOrderCarrierLane;
    label: string;
    shortLabel: string;
    tone: "blue" | "red";
  }>;
  const orientationOptions = [
    {
      value: "world",
      label: "World locked",
      shortLabel: "World",
      icon: "fas fa-lock",
    },
    {
      value: "radial",
      label: "Radial to center",
      shortLabel: "Radial",
      icon: "fas fa-bullseye",
    },
    {
      value: "tangent",
      label: "Follow path tangent",
      shortLabel: "Tangent",
      icon: "fas fa-route",
    },
    {
      value: "carrier",
      label: "Follow carrier direction",
      shortLabel: "Carrier",
      icon: "fas fa-compass",
    },
  ] satisfies Array<{
    value: ThirdOrderOrientationMode;
    label: string;
    shortLabel: string;
    icon: string;
  }>;
  const timingOptions = [
    { value: "phrase", label: "Phrase per count", shortLabel: "Phrase" },
    { value: "beats", label: "Shared counts", shortLabel: "Shared" },
    { value: "independent", label: "Independent clock", shortLabel: "Free" },
  ] satisfies Array<{
    value: ThirdOrderTimingMode;
    label: string;
    shortLabel: string;
  }>;

  const orientationHelp: Record<ThirdOrderOrientationMode, string> = {
    world:
      "The child grid keeps one fixed orientation while its center travels.",
    radial:
      "The child grid’s north axis always points toward the parent center.",
    tangent:
      "The child grid turns to face the direction its center is traveling.",
    carrier: "The child grid inherits the carrier prop’s own staff direction.",
  };
</script>

<aside class="inspector" aria-label="Third Order inspector">
  <header class="inspector-header">
    <div>
      <span class="eyebrow">Selected system</span>
      <h2>{state.selectedChild.label}</h2>
    </div>
    <button
      class="visibility-button"
      class:muted={!state.selectedChild.visible}
      type="button"
      aria-pressed={state.selectedChild.visible}
      onclick={() =>
        state.setChildVisible(
          state.selectedChildId,
          !state.selectedChild.visible
        )}
    >
      <i
        class="fas {state.selectedChild.visible ? 'fa-eye' : 'fa-eye-slash'}"
        aria-hidden="true"
      ></i>
      {state.selectedChild.visible ? "Visible" : "Hidden"}
    </button>
  </header>

  <section class="control-section">
    <div class="section-heading">
      <div>
        <span class="section-number">01</span>
        <h3>Carrier lane</h3>
      </div>
      <p>Which virtual hand moves this whole grid?</p>
    </div>
    <SegmentedControl
      options={laneOptions}
      value={state.selectedChild.lane}
      onchange={(lane) => state.setChildLane(state.selectedChildId, lane)}
      semantics="radiogroup"
      ariaLabel="Carrier lane"
    />
  </section>

  <section class="control-section">
    <div class="section-heading">
      <div>
        <span class="section-number">02</span>
        <h3>Frame orientation</h3>
      </div>
      <p>How does the child coordinate system turn along its route?</p>
    </div>
    <SegmentedControl
      options={orientationOptions}
      value={state.selectedChild.orientationMode}
      onchange={(mode) =>
        state.setChildOrientation(state.selectedChildId, mode)}
      columns={2}
      density="compact"
      semantics="radiogroup"
      ariaLabel="Frame orientation"
    />
    <div class="mode-explanation">
      <i class="fas fa-circle-info" aria-hidden="true"></i>
      <span>{orientationHelp[state.selectedChild.orientationMode]}</span>
    </div>
  </section>

  <section class="control-section">
    <div class="section-heading">
      <div>
        <span class="section-number">03</span>
        <h3>Inner timing</h3>
      </div>
      <p>How the child sequence advances against the carrier.</p>
    </div>
    <SegmentedControl
      options={timingOptions}
      value={state.selectedChild.timingMode}
      onchange={(mode) => state.setChildTiming(state.selectedChildId, mode)}
      columns={3}
      density="tight"
      semantics="radiogroup"
      ariaLabel="Inner timing"
    />
    {#if state.selectedChild.timingMode === "independent"}
      <div class="rate-row">
        <span>Playback rate</span>
        <ScrubbableNumber
          value={state.selectedChild.rate}
          min={0.1}
          max={4}
          step={0.1}
          label="Child playback rate"
          unit="×"
          showLabel={false}
          onchange={(rate) => state.setChildRate(state.selectedChildId, rate)}
        />
      </div>
    {/if}
  </section>

  <section class="geometry-note">
    <span class="geometry-mark" aria-hidden="true">2×</span>
    <div>
      <h3>Aligned geometry</h3>
      <p>
        The carrier grid is twice the child grid. Center, hand point, and outer
        point meet on one line.
      </p>
    </div>
  </section>
</aside>

<style>
  .inspector {
    display: flex;
    flex-direction: column;
    gap: 18px;
    height: 100%;
    min-width: 0;
    padding: 18px;
    overflow: auto;
    background: color-mix(
      in srgb,
      var(--theme-card-bg, #11131a) 86%,
      transparent
    );
  }
  .inspector-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }
  .inspector-header h2 {
    margin: 4px 0 0;
    color: var(--theme-text, #fff);
    font-size: 20px;
  }
  .eyebrow {
    color: var(--theme-accent, #8b5cf6);
    font-size: 11px;
    font-weight: 750;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .visibility-button {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    min-height: 40px;
    padding: 8px 11px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.14));
    border-radius: 10px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
    color: var(--theme-text, #fff);
    font-size: 12px;
    font-weight: 650;
    cursor: pointer;
  }
  .visibility-button.muted {
    color: var(--theme-text-dim, #9ca3af);
  }
  .control-section {
    display: grid;
    gap: 11px;
    padding-top: 17px;
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
  }
  .section-heading {
    display: grid;
    gap: 4px;
  }
  .section-heading > div {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .section-heading h3,
  .geometry-note h3 {
    margin: 0;
    color: var(--theme-text, #fff);
    font-size: 14px;
  }
  .section-heading p,
  .geometry-note p {
    margin: 0;
    color: var(--theme-text-dim, #9ca3af);
    font-size: 12px;
    line-height: 1.45;
  }
  .section-number {
    color: var(--theme-accent, #8b5cf6);
    font-size: 11px;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
  }
  .mode-explanation {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    min-height: 48px;
    padding: 10px 11px;
    border-radius: 10px;
    background: color-mix(
      in srgb,
      var(--theme-accent, #8b5cf6) 10%,
      transparent
    );
    color: var(--theme-text-dim, #aeb5c1);
    font-size: 12px;
    line-height: 1.45;
  }
  .mode-explanation i {
    margin-top: 2px;
    color: var(--theme-accent, #a78bfa);
  }
  .rate-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    min-height: 46px;
    color: var(--theme-text-dim, #aeb5c1);
    font-size: 13px;
  }
  .geometry-note {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-top: auto;
    padding: 13px;
    border: 1px solid
      color-mix(in srgb, var(--theme-accent, #8b5cf6) 28%, transparent);
    border-radius: 13px;
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--theme-accent, #8b5cf6) 11%, transparent),
      transparent
    );
  }
  .geometry-mark {
    display: grid;
    place-items: center;
    width: 46px;
    height: 46px;
    flex: 0 0 46px;
    border-radius: 50%;
    background: color-mix(
      in srgb,
      var(--theme-accent, #8b5cf6) 18%,
      transparent
    );
    color: var(--theme-accent, #c084fc);
    font-size: 15px;
    font-weight: 850;
  }
</style>
