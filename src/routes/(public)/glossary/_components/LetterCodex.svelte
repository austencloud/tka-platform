<!--
  LetterCodex - the glossary's visual letter reference.

  This file is a HOST, not a layout. It owns four things and nothing else:
  which board is showing, which letter is selected, the variations query, and
  where the inspector goes for the board that is showing. Every pictograph, every
  cell frame, every shared wall, every transition glyph, every OPEN/CLOSE tag
  and every Greek name comes from the guide's own codex primitives - CodexSheet,
  CodexBox, CodexCell - which were extended with a dark theme rather than
  reimplemented. The letter is the TKA glyph inside its pictograph, which is
  CodexCell's default and where it belongs.

  Three boards are mounted at once so the layout direction can be compared in
  place rather than in a harness. Once one is chosen the other two and the
  switcher come out.
-->
<script lang="ts">
  import { onMount, tick } from "svelte";
  import { page } from "$app/state";
  import { mutateCurrentUrl } from "$lib/shared/navigation/services/url-state";
  import SegmentedControl from "$lib/shared/ui/components/SegmentedControl.svelte";
  import BaseModal from "$lib/shared/foundation/ui/modal/BaseModal.svelte";
  import ModalHeader from "$lib/shared/foundation/ui/modal/ModalHeader.svelte";
  import {
    SequenceSelection,
    setSequenceSelection,
  } from "$lib/shared/selection/sequence-selection.svelte";
  import "$lib/shared/selection/selection.css";
  import "./codex-boards/codex-dark.css";
  import BoardSheets from "./codex-boards/BoardSheets.svelte";
  import BoardAtlas from "./codex-boards/BoardAtlas.svelte";
  import BoardStage from "./codex-boards/BoardStage.svelte";
  import CodexInspector from "./codex-boards/CodexInspector.svelte";
  import CodexTypeLegend from "./codex-boards/CodexTypeLegend.svelte";
  import { CODEX_BY_LABEL, CODEX_LETTERS, type CodexLetterInfo } from "./codex-boards/codex-letters";
  import { letterQueryHandler } from "$lib/shared/pictograph/tka-glyph/services/letter-query-handler";
  import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/pictograph-data";

  let { initialLetter = "A" }: { initialLetter?: string } = $props();

  type BoardKey = "sheets" | "atlas" | "stage";

  const BOARDS: { value: BoardKey; label: string; ariaLabel: string }[] = [
    { value: "sheets", label: "Sheets", ariaLabel: "Sheets layout - the guide's two printed pages" },
    { value: "atlas", label: "Atlas", ariaLabel: "Atlas layout - one continuous run of boxes" },
    { value: "stage", label: "Stage", ariaLabel: "Stage layout - compact index beside a large inspector" },
  ];

  function readBoard(value: string | null): BoardKey {
    return value === "atlas" || value === "stage" || value === "sheets" ? value : "atlas";
  }

  let board = $state<BoardKey>("atlas");

  function setBoard(next: BoardKey): void {
    board = next;
    mutateCurrentUrl((url) => url.searchParams.set("board", next));
  }

  // Hover/selected ring - the shared primitive the guide's codex cells already
  // use, so the two surfaces highlight identically. CodexCell reads it from
  // context, so it has to be set before any board mounts.
  const selection = new SequenceSelection();
  setSequenceSelection(selection);

  const fallback: CodexLetterInfo =
    CODEX_BY_LABEL.get(initialLetter) ?? CODEX_BY_LABEL.get("A")!;

  let selectedId = $state(fallback.id);
  selection.select(fallback.id);

  const info = $derived(CODEX_LETTERS.get(selectedId) ?? fallback);

  let allPictographs = $state<PictographData[]>([]);
  let isLoading = $state(true);
  let loadError = $state(false);

  const variations = $derived(
    allPictographs.filter((p) => p.letter === info.label)
  );

  async function load(): Promise<void> {
    isLoading = true;
    loadError = false;
    try {
      allPictographs = await letterQueryHandler.getAllPictographVariations(GridMode.DIAMOND);
    } catch (e) {
      console.error("LetterCodex: variations failed to load", e);
      loadError = true;
    } finally {
      isLoading = false;
    }
  }

  onMount(() => {
    board = readBoard(page.url.searchParams.get("board"));
    void load();
  });

  // Sheets and Atlas spend the whole band on the 47 letters, so their inspector
  // is an overlay. Stage has it on the page already and must not open a second
  // copy of the same thing.
  const overlayBoard = $derived(board !== "stage");
  let overlayOpen = $state(false);
  let stageBoard = $state<ReturnType<typeof BoardStage> | undefined>();

  function select(id: string): void {
    if (!CODEX_LETTERS.has(id)) return;
    selectedId = id;
    selection.select(id);
    if (overlayBoard) {
      overlayOpen = true;
      return;
    }
    // Stage board, stacked layout: the inspector sits under a full-height
    // index, so without this the chosen letter's detail is off-screen.
    tick().then(() => stageBoard?.revealStage());
  }
</script>

<div class="codex codex-dark">
  <!-- One toolbar row, not two stacked ones: the type legend and the layout
       switcher together cost less height than either did alone, and every
       pixel here comes out of the letters. -->
  <div class="toolbar">
    <div class="switcher">
      <span class="switcher-label" id="codex-board-label">Layout</span>
      <SegmentedControl
        options={BOARDS}
        value={board}
        onchange={setBoard}
        size="sm"
        ariaLabelledby="codex-board-label"
      />
    </div>
    {#if board !== "sheets"}
      <CodexTypeLegend />
    {/if}
  </div>

  {#if board === "sheets"}
    <BoardSheets onSelect={select} />
  {:else if board === "atlas"}
    <BoardAtlas onSelect={select} />
  {:else}
    <BoardStage
      bind:this={stageBoard}
      onSelect={select}
      {info}
      {variations}
      {isLoading}
      {loadError}
      onRetry={load}
    />
  {/if}
</div>

{#if overlayBoard}
  <BaseModal
    bind:open={overlayOpen}
    size="fit"
    labelledBy="codex-overlay-title"
    class="codex-overlay codex-dark"
  >
    {#snippet header()}
      <ModalHeader
        id="codex-overlay-title"
        title={info.name ? `${info.label} · ${info.name}` : info.label}
        subtitle="{info.typeName} · {info.transition}"
        iconColor={info.typeColor}
        onClose={() => (overlayOpen = false)}
      />
    {/snippet}
    <div class="overlay-body">
      <CodexInspector
        {info}
        {variations}
        {isLoading}
        {loadError}
        onRetry={load}
        orientation="row"
      />
    </div>
  </BaseModal>
{/if}

<style>
  .codex {
    padding: 0.35rem 0 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem 1.5rem;
  }

  /* Comparison affordance only - it comes out with the two losing boards.
     fit-content so the control sizes to its three short labels instead of
     stretching into a progress bar across the band. */
  .switcher {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    width: fit-content;
  }
  .switcher-label {
    font-size: 0.8rem;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--theme-text-muted, oklch(0.72 0.015 270));
  }

  .overlay-body {
    padding: 1rem 1.25rem 1.25rem;
    --codex-hero-size: clamp(9rem, 34vw, 18rem);
    --codex-var-cols: 4;
    --codex-var-size: clamp(4rem, 14vw, 8rem);
  }
  @media (min-width: 60rem) {
    .overlay-body {
      --codex-var-cols: 8;
      --codex-var-size: clamp(5rem, 7vw, 8.5rem);
    }
  }
</style>
