<!--
  SpinnerModeToggle.svelte

  Single-select control for switching between Library, Infinite, and Live modes
  in the endless spinner. Exactly one mode is active at a time, so this routes
  through the shared SegmentedControl primitive (sliding indicator + single-
  select semantics) rather than a hand-rolled segmented control.

  The indicator accent swaps to red while Live is selected, preserving the
  live-broadcast cue. (A per-segment status dot lived on the old hand-rolled
  version; reinstating it cleanly needs a slot on the shared SegmentedControl,
  which is out of scope for this feature's directory.)
-->
<script lang="ts">
  import SegmentedControl from "$lib/shared/ui/components/SegmentedControl.svelte";
  import { t } from "$lib/shared/i18n/i18n.svelte";
  import type { SpinnerMode } from "../domain/models/spinner-models";

  let {
    mode = "library",
    onModeChange,
  }: {
    mode?: SpinnerMode;
    onModeChange?: (mode: SpinnerMode) => void;
  } = $props();

  const options = $derived<{ value: SpinnerMode; label: string }[]>([
    { value: "library", label: t("landing_spinner_mode_library") },
    { value: "infinite", label: t("landing_spinner_mode_infinite") },
    { value: "live", label: t("landing_spinner_mode_live") },
  ]);

  // Live selection gets the red indicator; everything else uses the brand accent.
  let indicatorColor = $derived<"accent" | "red">(
    mode === "live" ? "red" : "accent"
  );

  function handleChange(value: SpinnerMode) {
    onModeChange?.(value);
  }
</script>

<div class="mode-toggle">
  <SegmentedControl
    {options}
    value={mode}
    onchange={handleChange}
    color={indicatorColor}
    semantics="radiogroup"
    ariaLabel={t("landing_spinner_mode_source")}
  />
</div>

<style>
  /* rem width: the route's continuous 4K root ramp grows it — no step tier. */
  .mode-toggle {
    width: min(100%, 28rem);
    margin: 0 auto;
  }
</style>
