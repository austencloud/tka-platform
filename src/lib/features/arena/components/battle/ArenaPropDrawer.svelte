<!--
  ArenaPropDrawer.svelte

  Prop type selector for the arena.
  Unlike the settings prop drawer, this doesn't change global settings.
  It just returns the selected prop type via callback.
-->
<script lang="ts">
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import PropSelectionSheet from "$lib/shared/settings/components/tabs/prop-type/PropSelectionSheet.svelte";
  import { t } from "$lib/shared/i18n/i18n.svelte";

  let {
    isOpen = $bindable(false),
    selectedPropType,
    onSelect,
  }: {
    isOpen: boolean;
    selectedPropType: PropType;
    onSelect: (propType: PropType) => void;
  } = $props();
</script>

<PropSelectionSheet
  bind:isOpen
  {selectedPropType}
  color="blue"
  title={t('arena_battle_prop_title')}
  {onSelect}
/>
