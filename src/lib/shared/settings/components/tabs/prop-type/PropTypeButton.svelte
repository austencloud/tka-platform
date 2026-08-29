<script lang="ts">
  import type { HTMLButtonAttributes } from "svelte/elements";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import PropCompositionPreview from "$lib/shared/pictograph/prop/components/PropCompositionPreview.svelte";
  import { getPropTypeDisplayInfo } from "./prop-type-registry";
  import PropSelectionButton from "./PropSelectionButton.svelte";

  let {
    propType,
    selected = false,
    selectedBlue = false,
    selectedRed = false,
    color = "blue",
    badge,
    actionLabel,
    buttonProps,
    onSelect,
  } = $props<{
    propType: PropType;
    selected?: boolean;
    selectedBlue?: boolean;
    selectedRed?: boolean;
    color?: "blue" | "red" | (string & {});
    badge?: number;
    actionLabel?: string;
    buttonProps?: HTMLButtonAttributes;
    onSelect?: (propType: PropType) => void;
  }>();

  const displayInfo = $derived(getPropTypeDisplayInfo(propType));
  const resolvedActionLabel = $derived(
    actionLabel ?? `Select ${displayInfo.label} prop type`
  );
</script>

<PropSelectionButton
  label={displayInfo.label}
  {selected}
  {selectedBlue}
  {selectedRed}
  {color}
  {badge}
  actionLabel={resolvedActionLabel}
  {buttonProps}
  ghost={true}
  onpress={onSelect ? () => onSelect?.(propType) : undefined}
>
  {#snippet art()}
    <PropCompositionPreview {propType} neutral />
  {/snippet}
</PropSelectionButton>
