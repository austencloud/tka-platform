<!--
  RetroTreeView - Expandable hierarchical list

  Renders a tree with [+]/[-] toggle icons, indentation, and selection
  highlight. Used for the File Manager left pane and any hierarchical
  data display. Each node can have children that expand/collapse.

  Keyboard navigation: ArrowUp/Down moves selection, ArrowRight expands,
  ArrowLeft collapses, Enter selects.
-->
<script lang="ts">
  import type { RetroTreeNode } from "../../domain/types/retro-types";

  let {
    nodes,
    selectedId = $bindable(""),
    onselect,
  }: {
    nodes: RetroTreeNode[];
    selectedId?: string;
    onselect?: (id: string) => void;
  } = $props();

  /**
   * Mutable expansion state tracked separately so we don't mutate the
   * nodes prop. Keyed by node id.
   */
  let expandedMap = $state<Record<string, boolean>>({});

  /** Initialize expansion state from node defaults on first render. */
  $effect(() => {
    function initExpanded(nodeList: RetroTreeNode[]) {
      for (const node of nodeList) {
        if (expandedMap[node.id] === undefined && node.expanded) {
          expandedMap[node.id] = true;
        }
        if (node.children) {
          initExpanded(node.children);
        }
      }
    }
    initExpanded(nodes);
  });

  function isExpanded(id: string): boolean {
    return expandedMap[id] ?? false;
  }

  function toggleExpanded(id: string) {
    expandedMap[id] = !isExpanded(id);
  }

  function selectNode(id: string) {
    selectedId = id;
    onselect?.(id);
  }

  function handleNodeClick(node: RetroTreeNode) {
    selectNode(node.id);
  }

  function handleToggleClick(event: MouseEvent, node: RetroTreeNode) {
    event.stopPropagation();
    toggleExpanded(node.id);
  }

  /** Flatten the visible tree for keyboard navigation. */
  function flattenVisible(nodeList: RetroTreeNode[]): RetroTreeNode[] {
    const result: RetroTreeNode[] = [];
    for (const node of nodeList) {
      result.push(node);
      if (node.children && isExpanded(node.id)) {
        result.push(...flattenVisible(node.children));
      }
    }
    return result;
  }

  function handleKeydown(event: KeyboardEvent) {
    const flat = flattenVisible(nodes);
    const currentIndex = flat.findIndex((n) => n.id === selectedId);

    switch (event.key) {
      case "ArrowDown": {
        event.preventDefault();
        const next = Math.min(currentIndex + 1, flat.length - 1);
        if (next >= 0) selectNode(flat[next]!.id);
        break;
      }
      case "ArrowUp": {
        event.preventDefault();
        const prev = Math.max(currentIndex - 1, 0);
        if (prev >= 0) selectNode(flat[prev]!.id);
        break;
      }
      case "ArrowRight": {
        event.preventDefault();
        const node = flat[currentIndex];
        if (node?.children?.length) {
          if (!isExpanded(node.id)) {
            toggleExpanded(node.id);
          } else {
            const nextIndex = currentIndex + 1;
            if (nextIndex < flat.length) selectNode(flat[nextIndex]!.id);
          }
        }
        break;
      }
      case "ArrowLeft": {
        event.preventDefault();
        const node = flat[currentIndex];
        if (node?.children?.length && isExpanded(node.id)) {
          toggleExpanded(node.id);
        }
        break;
      }
      case "Enter": {
        event.preventDefault();
        const node = flat[currentIndex];
        if (node?.children?.length) {
          toggleExpanded(node.id);
        }
        break;
      }
    }
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div
  class="retro-treeview sunken-panel"
  role="tree"
  tabindex="0"
  onkeydown={handleKeydown}
  aria-label="Tree view"
>
  {#snippet renderNodes(nodeList: RetroTreeNode[], depth: number)}
    {#each nodeList as node (node.id)}
      {@const hasChildren = (node.children?.length ?? 0) > 0}
      {@const expanded = isExpanded(node.id)}
      <div
        class="retro-tree-node"
        class:selected={node.id === selectedId}
        role="treeitem"
        aria-expanded={hasChildren ? expanded : undefined}
        aria-selected={node.id === selectedId}
        tabindex={node.id === selectedId ? 0 : -1}
        style="padding-left: {depth * 16 + 4}px;"
        onclick={() => handleNodeClick(node)}
        onkeydown={handleKeydown}
      >
        <!-- Expand/collapse toggle -->
        {#if hasChildren}
          <button
            class="retro-tree-toggle"
            type="button"
            aria-label={expanded ? "Collapse" : "Expand"}
            onclick={(e) => handleToggleClick(e, node)}
          >
            {expanded ? "−" : "+"}
          </button>
        {:else}
          <span class="retro-tree-toggle-spacer"></span>
        {/if}

        <!-- Optional icon -->
        {#if node.icon}
          <span class="retro-tree-icon" aria-hidden="true">{@html node.icon}</span>
        {/if}

        <!-- Label -->
        <span class="retro-tree-label">{node.label}</span>
      </div>

      <!-- Recursively render children if expanded -->
      {#if hasChildren && expanded}
        <div role="group">
          {@render renderNodes(node.children!, depth + 1)}
        </div>
      {/if}
    {/each}
  {/snippet}

  {@render renderNodes(nodes, 0)}
</div>

<style>
  .retro-treeview {
    overflow: auto;
    background: var(--retro-field-bg, #fff);
    font-family: var(--retro-font-family, "Microsoft Sans Serif", Arial, sans-serif);
    font-size: var(--retro-font-size, 11px);
    color: var(--retro-field-text, #000);
    padding: var(--retro-padding-sm, 2px);
    min-height: 60px;
  }

  .retro-treeview:focus-visible {
    outline: 1px dotted var(--retro-black, #000);
    outline-offset: -2px;
  }

  /* Tree node row                                                       */
  .retro-tree-node {
    display: flex;
    align-items: center;
    gap: 2px;
    padding-top: 1px;
    padding-bottom: 1px;
    padding-right: var(--retro-padding-md, 4px);
    cursor: default;
    user-select: none;
    white-space: nowrap;
  }

  .retro-tree-node.selected {
    background: var(--retro-selection-bg, #000080);
    color: var(--retro-selection-text, #fff);
  }

  /* Expand/collapse toggle                                              */
  .retro-tree-toggle {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 12px;
    height: 12px;
    padding: 0;
    margin: 0;
    border: 1px solid var(--retro-dark-gray, #808080);
    background: var(--retro-field-bg, #fff);
    font-family: var(--retro-font-mono, "Fixedsys", monospace);
    font-size: 10px;
    line-height: 1;
    cursor: default;
    flex-shrink: 0;
    color: var(--retro-black, #000);
  }

  .retro-tree-toggle-spacer {
    display: inline-block;
    width: 12px;
    flex-shrink: 0;
  }

  /* Node icon and label                                                 */
  .retro-tree-icon {
    display: flex;
    align-items: center;
    width: 16px;
    height: 16px;
    flex-shrink: 0;
    image-rendering: pixelated;
  }

  .retro-tree-icon :global(svg) {
    width: 100%;
    height: 100%;
    image-rendering: pixelated;
  }

  .retro-tree-label {
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
