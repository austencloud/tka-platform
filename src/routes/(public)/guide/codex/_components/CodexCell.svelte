<script lang="ts">
  import GuidePictograph from "../../level-1/_components/GuidePictograph.svelte";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import { codexData, type CodexCellDef } from "../_data/codex-groups";

  let { cell }: { cell: CodexCellDef } = $props();

  const data = codexData(cell.id);
</script>

<div class="codex-cell">
  {#if cell.top}
    <span class="cell-top">{cell.top}</span>
  {/if}
  <div class="picto">
    <GuidePictograph
      {data}
      size="sm"
      showGrid={true}
      showArrows={true}
      propType={PropType.STAFF}
      printMode={true}
      darkMode={false}
      eager={true}
    />
  </div>
  {#if cell.name}
    <span class="cell-name">{cell.name}</span>
  {/if}
</div>

<style>
  .codex-cell {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1px;
    min-width: 0;
  }

  .cell-top {
    font-size: 0.62rem;
    font-weight: 600;
    color: #333;
    line-height: 1.1;
  }

  /* Reserve a square so the async pictograph swap never reflows neighbors. */
  .picto {
    width: 100%;
    max-width: 64px;
    aspect-ratio: 1;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .picto :global(.guide-pictograph) {
    width: 100%;
    gap: 0;
  }

  .cell-name {
    font-style: italic;
    font-size: 0.6rem;
    color: #555;
    line-height: 1.1;
  }
</style>
