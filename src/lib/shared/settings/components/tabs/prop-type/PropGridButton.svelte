<script lang="ts">
  import type { HTMLButtonAttributes } from "svelte/elements";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import PropGridPreview from "./PropGridPreview.svelte";
  import type { FanAppearance } from "$lib/shared/pictograph/prop/domain/fan-appearance";
  import type { PropLook } from "$lib/shared/pictograph/prop/domain/prop-look";
  import type { CompositionRecipe } from "$lib/shared/pictograph/prop/domain/prop-composition-recipes";
  import { getPropTypeDisplayInfo } from "./prop-type-registry";
  import PropSelectionButton from "./PropSelectionButton.svelte";

  let {
    propType,
    selected = false,
    selectedLeft = false,
    selectedRight = false,
    color = "blue",
    badge,
    actionLabel,
    buttonProps,
    onSelect,
    fanAppearance,
    propLook,
    recipeOverrides,
  } = $props<{
    propType: PropType;
    selected?: boolean;
    selectedLeft?: boolean;
    selectedRight?: boolean;
    color?: "blue" | "red" | (string & {});
    badge?: number;
    actionLabel?: string;
    buttonProps?: HTMLButtonAttributes;
    onSelect?: (propType: PropType) => void;
    fanAppearance: FanAppearance;
    propLook?: PropLook;
    recipeOverrides?: Partial<Record<PropType, CompositionRecipe>>;
  }>();

  const displayInfo = $derived(getPropTypeDisplayInfo(propType));
  const resolvedActionLabel = $derived(
    actionLabel ?? `Select ${displayInfo.label} prop type`
  );
</script>

<PropSelectionButton
  label={displayInfo.label}
  {selected}
  {selectedLeft}
  {selectedRight}
  {color}
  {badge}
  actionLabel={resolvedActionLabel}
  {buttonProps}
  ghost={true}
  onpress={onSelect ? () => onSelect?.(propType) : undefined}
>
  {#snippet art()}
    <PropGridPreview
      {propType}
      neutral
      {fanAppearance}
      {propLook}
      {recipeOverrides}
    />
  {/snippet}
</PropSelectionButton>
