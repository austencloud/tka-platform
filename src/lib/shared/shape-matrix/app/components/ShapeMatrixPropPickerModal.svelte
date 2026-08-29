<script lang="ts">
  import PropSelectionSheet from "$lib/shared/settings/components/tabs/prop-type/PropSelectionSheet.svelte";
  import { getShapeMatrixAppContext } from "../context/shape-matrix-app-context";

  const state = getShapeMatrixAppContext();
</script>

<PropSelectionSheet
  isOpen={state.propPickerOpen}
  selectedPropType={state.propType}
  color="blue"
  title="Choose a prop"
  autoClose={false}
  onSelect={(propType) => void state.setPropType(propType)}
  onOpenChange={(open) => {
    if (!open) state.closePropPicker();
  }}
/>
