<!--
  PropOrientationControl.svelte

  Picks a prop's starting orientation. There are four of them (eight with
  interradial), and they all fit on one row, so they are all shown: stepping
  through a cycle to reach Counter meant three presses and a guess at the order,
  and hid two of the four choices behind a popover. The tone carries which prop
  is being set even before anything is selected.
-->
<script lang="ts">
  import SegmentedControl from "$lib/shared/ui/components/SegmentedControl.svelte";

  interface Props {
    color: "blue" | "red";
    orientation: string;
    onOrientationChange: (orientation: string) => void;
    /** Enable interradial orientations (Level 6). */
    showInterradial?: boolean;
    /** Restrict the control to the vocabulary allowed by its host. */
    allowedOrientations?: readonly string[];
    compact?: boolean;
    disabled?: boolean;
    /**
     * Opt this control into the attract presenter, per host. Absent by default:
     * the same control sits in the generate customizer, which the presenter is
     * not meant to reach. Only the step editor passes it.
     */
    ghostKind?: "step-edit";
  }

  let {
    color,
    orientation,
    onOrientationChange,
    showInterradial = false,
    allowedOrientations,
    compact = false,
    disabled = false,
    ghostKind,
  }: Props = $props();

  interface OrientationOption {
    value: string;
    label: string;
  }

  const cardinalOptions: OrientationOption[] = [
    { value: "in", label: "In" },
    { value: "out", label: "Out" },
    { value: "clock", label: "CW" },
    { value: "counter", label: "CCW" },
  ];

  const interradialOptions: OrientationOption[] = [
    { value: "clockIn", label: "CW·In" },
    { value: "clockOut", label: "CW·Out" },
    { value: "counterIn", label: "CCW·In" },
    { value: "counterOut", label: "CCW·Out" },
  ];

  const allOrientationOptions = $derived(
    showInterradial
      ? [...cardinalOptions, ...interradialOptions]
      : cardinalOptions
  );

  const options = $derived(
    allOrientationOptions
      .filter(
        (option) =>
          !allowedOrientations || allowedOrientations.includes(option.value)
      )
      .map((option) => ({
        value: option.value,
        label: option.label,
        // The label is short and ambiguous on its own — CW could be a rotation
        // direction anywhere. The full name is what a screen reader announces.
        ariaLabel: `Set ${color} orientation to ${option.label}`,
        tone: color,
        disabled,
      }))
  );
</script>

<div class="orientation-control" class:compact>
  <SegmentedControl
    {options}
    value={orientation}
    onchange={onOrientationChange}
    {color}
    size="sm"
    density={compact ? "compact" : "standard"}
    semantics="radiogroup"
    ariaLabel="{color === 'blue' ? 'Blue' : 'Red'} start orientation"
    {ghostKind}
  />
</div>

<style>
  .orientation-control {
    width: 100%;
  }
</style>
