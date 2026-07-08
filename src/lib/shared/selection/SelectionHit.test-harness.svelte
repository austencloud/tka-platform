<script lang="ts">
  import "./selection.css";
  import SelectionHit from "./SelectionHit.svelte";
  import { SequenceSelection, setSequenceSelection } from "./sequence-selection.svelte";

  let {
    withScope = true,
    groupId,
    isGroupStart = false,
    label = "",
    onselect,
  }: {
    withScope?: boolean;
    groupId: string;
    isGroupStart?: boolean;
    label?: string;
    onselect?: (id: string) => void;
  } = $props();

  if (withScope) setSequenceSelection(new SequenceSelection());
</script>

<div class="tka-seq-cell" style="width:80px;height:80px">
  <SelectionHit {groupId} {isGroupStart} {label} {onselect} />
</div>
