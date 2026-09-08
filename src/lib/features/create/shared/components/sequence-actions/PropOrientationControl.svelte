<script lang="ts">
  import SegmentedControl from "$lib/shared/ui/components/SegmentedControl.svelte";

  interface Props {
    hand: "left" | "right";
    orientation: string;
    onOrientationChange: (orientation: string) => void;
    /** Enable interradial orientations (Level 4). */
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
    hand,
    orientation,
    onOrientationChange,
    showInterradial = false,
    allowedOrientations,
    compact = false,
    disabled = false,
    ghostKind,
  }: Props = $props();

  const tone = $derived(hand === "left" ? "blue" : "red");
  const handLabel = $derived(hand === "left" ? "Left" : "Right");

  interface OrientationOption {
    value: string;
    label: string;
    name: string;
    icon: string;
  }

  const cardinalOptions: OrientationOption[] = [
    { value: "in", label: "In", name: "Inward", icon: "fa-compress-alt" },
    { value: "out", label: "Out", name: "Outward", icon: "fa-expand-alt" },
    { value: "clock", label: "CW", name: "Clockwise", icon: "fa-rotate-right" },
    {
      value: "counter",
      label: "CCW",
      name: "Counterclockwise",
      icon: "fa-rotate-left",
    },
  ];

  const interradialOptions: OrientationOption[] = [
    {
      value: "clockIn",
      label: "CW·In",
      name: "Clockwise inward",
      icon: "fa-rotate-right",
    },
    {
      value: "clockOut",
      label: "CW·Out",
      name: "Clockwise outward",
      icon: "fa-rotate-right",
    },
    {
      value: "counterIn",
      label: "CCW·In",
      name: "Counterclockwise inward",
      icon: "fa-rotate-left",
    },
    {
      value: "counterOut",
      label: "CCW·Out",
      name: "Counterclockwise outward",
      icon: "fa-rotate-left",
    },
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
        label: option.name,
        // The label is short and ambiguous on its own — CW could be a rotation
        // direction anywhere. The full name is what a screen reader announces.
        ariaLabel: `Set ${hand} orientation to ${option.name}`,
        tone,
        disabled,
      }))
  );
</script>

<div class="orientation-control" class:compact>
  <SegmentedControl
    {options}
    value={orientation}
    onchange={onOrientationChange}
    color={tone}
    density="tight"
    columns={options.length > 4 ? 4 : undefined}
    semantics="radiogroup"
    ariaLabel="{handLabel} start orientation"
    {ghostKind}
  >
    {#snippet optionContent(value)}
      {@const option = allOrientationOptions.find(
        (item) => item.value === value
      )}
      <span class="orientation-option">
        <i class="fas {option?.icon}" aria-hidden="true"></i>
        <span>{option?.label}</span>
      </span>
    {/snippet}
  </SegmentedControl>
</div>

<style>
  .orientation-control {
    width: 100%;
    max-width: 24rem;
    min-width: 0;
  }

  .orientation-option {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 52px;
    font-size: var(--font-size-min, 14px);
    font-weight: 650;
    line-height: 1.25;
  }

  .orientation-option i {
    font-size: 20px;
    line-height: 1;
  }

  /* Short landscape editors keep the same choices and 44px targets. */
  .compact .orientation-option {
    min-height: 28px;
    gap: 4px;
  }

  .compact .orientation-option i {
    font-size: 16px;
  }
</style>
