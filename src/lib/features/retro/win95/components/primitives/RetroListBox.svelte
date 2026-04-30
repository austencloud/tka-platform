<!--
  RetroListBox - Scrollable list with single selection

  Uses 98.css's sunken field styling. Renders a list of items
  where clicking selects and double-clicking fires the action callback.
  The visible height is controlled by the `height` prop (row count).
-->
<script lang="ts">
  let {
    selectedIndex = $bindable(-1),
    items,
    height = 8,
    onselect,
    ondblclick,
  }: {
    selectedIndex?: number;
    items: string[];
    height?: number;
    onselect?: (index: number) => void;
    ondblclick?: (index: number) => void;
  } = $props();

  /** 98.css list items are ~16px tall (11px font + 5px padding). */
  const ROW_HEIGHT = 16;
  const listHeight = $derived(height * ROW_HEIGHT);

  function handleClick(index: number) {
    selectedIndex = index;
    onselect?.(index);
  }

  function handleDblClick(index: number) {
    selectedIndex = index;
    ondblclick?.(index);
  }

  function handleKeydown(event: KeyboardEvent) {
    if (items.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      const next = Math.min(selectedIndex + 1, items.length - 1);
      selectedIndex = next;
      onselect?.(next);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      const prev = Math.max(selectedIndex - 1, 0);
      selectedIndex = prev;
      onselect?.(prev);
    } else if (event.key === "Enter" && selectedIndex >= 0) {
      event.preventDefault();
      ondblclick?.(selectedIndex);
    }
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<ul
  class="retro-listbox sunken-panel"
  style="height: {listHeight}px;"
  role="listbox"
  tabindex="0"
  onkeydown={handleKeydown}
  aria-label="List"
>
  {#each items as item, i (i)}
    <li
      class="retro-listbox-item"
      class:selected={i === selectedIndex}
      role="option"
      aria-selected={i === selectedIndex}
      onclick={() => handleClick(i)}
      ondblclick={() => handleDblClick(i)}
      onkeydown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick(i);
        }
      }}
    >
      {item}
    </li>
  {/each}
</ul>

<style>
  .retro-listbox {
    list-style: none;
    margin: 0;
    padding: var(--retro-padding-sm, 2px);
    overflow-y: auto;
    overflow-x: hidden;
    font-family: var(--retro-font-family, "Microsoft Sans Serif", Arial, sans-serif);
    font-size: var(--retro-font-size, 11px);
    color: var(--retro-field-text, #000);
    background: var(--retro-field-bg, #fff);
    box-sizing: border-box;
  }

  .retro-listbox:focus-visible {
    outline: 1px dotted var(--retro-black, #000);
    outline-offset: -2px;
  }

  .retro-listbox-item {
    padding: 1px var(--retro-padding-md, 4px);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    cursor: default;
    user-select: none;
    line-height: 14px;
  }

  .retro-listbox-item.selected {
    background: var(--retro-selection-bg, #000080);
    color: var(--retro-selection-text, #fff);
  }
</style>
