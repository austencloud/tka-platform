<!-- src/lib/shared/3d/components/MobileSceneEverythingSheet.svelte -->
<script lang="ts">
  /**
   * "Everything else" controls for the mobile bottom sheet: the same bodies
   * the desktop RightRail exposes as popovers (Formation, Camera, Export,
   * Scene, + Dev for admins), stacked as sections.
   */
  import FormationPopover from "./controls/FormationPopover.svelte";
  import CameraPopover from "./CameraPopover.svelte";
  import ExportPopover from "$lib/shared/sequence-viewer/components/ExportPopover.svelte";
  import SceneSelectorPopover from "./SceneSelectorPopover.svelte";
  import DevToolsPopover from "./controls/DevToolsPopover.svelte";
  import { authState } from "$lib/shared/auth/state/auth-state.svelte";

  const SECTIONS = [
    { id: "scene", label: "Scene", icon: "fa-mountain-sun" },
    { id: "formation", label: "Formation", icon: "fa-users" },
    { id: "camera", label: "Camera", icon: "fa-video" },
    { id: "export", label: "Export", icon: "fa-arrow-up-from-bracket" },
  ];
  let active = $state("scene");
</script>

<div class="everything-sheet">
  <div class="section-tabs" role="tablist" aria-label="Scene controls">
    {#each SECTIONS as s}
      <button
        class="section-tab"
        class:active={active === s.id}
        role="tab"
        aria-selected={active === s.id}
        onclick={() => (active = s.id)}
      >
        <i class="fas {s.icon}" aria-hidden="true"></i>
        <span>{s.label}</span>
      </button>
    {/each}
    {#if authState.isAdmin}
      <button
        class="section-tab"
        class:active={active === "dev"}
        role="tab"
        aria-selected={active === "dev"}
        onclick={() => (active = "dev")}
      >
        <i class="fas fa-terminal" aria-hidden="true"></i>
        <span>Dev</span>
      </button>
    {/if}
  </div>

  <div class="section-body">
    {#if active === "scene"}<SceneSelectorPopover />{/if}
    {#if active === "formation"}<FormationPopover />{/if}
    {#if active === "camera"}<CameraPopover />{/if}
    {#if active === "export"}<ExportPopover />{/if}
    {#if active === "dev" && authState.isAdmin}<DevToolsPopover />{/if}
  </div>
</div>

<style>
  .everything-sheet { display: flex; flex-direction: column; gap: 12px; }
  .section-tabs {
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: 1fr;
    gap: 4px;
    padding: 3px;
    background: rgba(0, 0, 0, 0.28);
    border-radius: 10px;
  }
  .section-tab {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
    min-height: 44px;
    padding: 6px 0;
    border: none;
    border-radius: 7px;
    background: transparent;
    color: rgba(255, 255, 255, 0.68);
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
  }
  .section-tab.active {
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
  }
  .section-tab i { font-size: 14px; }
</style>
