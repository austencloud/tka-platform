<script lang="ts">
  import { getViewer3DContext } from "$lib/shared/3d/context/viewer-3d-context";
  import {
    getExportOptionsState,
    type VideoFps,
    type VideoResolution,
    type VideoQuality,
  } from "$lib/shared/sequence-viewer/state/export-options-state.svelte";
  import type { CameraPresetId } from "$lib/shared/sequence-viewer/camera-choreography/state.svelte";
  import { scale, slide } from "svelte/transition";
  import { backOut, cubicOut } from "svelte/easing";

  const viewer = getViewer3DContext();
  const open = $derived(viewer.activePopover === "export");
  const opts = getExportOptionsState();

  let advancedOpen = $state(false);

  // Spec §6.2 #3 — 3D export option domains.
  const RESOLUTIONS: VideoResolution[] = [720, 1080, 2160, 4320];
  function resLabel(r: VideoResolution): string {
    return r === 2160 ? "4K" : r === 4320 ? "8K" : String(r);
  }
  const QUALITIES: VideoQuality[] = ["standard", "cinema"];
  function qualityLabel(q: VideoQuality): string {
    return q === "cinema" ? "Cinema" : "Standard";
  }
  const FPS_OPTIONS: VideoFps[] = [30, 60, 120];

  // Camera preset tiles. Plane-locked variants tint using the plane accent
  // tokens so the picker reads as "this preset locks you to that plane".
  type PresetTile = {
    id: CameraPresetId;
    label: string;
    icon: string;
    tint?: string;
  };
  const CAMERA_PRESETS: PresetTile[] = [
    { id: "free", label: "Free", icon: "fa-hand-paper" },
    { id: "auto-orbit", label: "Auto-orbit", icon: "fa-sync-alt" },
    { id: "plane-wall", label: "Wall", icon: "fa-square", tint: "var(--plane-wall, #4a9eff)" },
    { id: "plane-wheel", label: "Wheel", icon: "fa-circle", tint: "var(--plane-wheel, #ff9e4a)" },
    { id: "plane-floor", label: "Floor", icon: "fa-th-large", tint: "var(--plane-floor, #4affa0)" },
    { id: "quad-plane-tour", label: "Tour", icon: "fa-film" },
    { id: "ensemble-focus", label: "Ensemble", icon: "fa-users" },
  ];

  const performerCount = $derived(viewer.performerManager.performers.length);
  const activePresetId = $derived(viewer.cameraChoreography.activePresetId);

  function isDisabled(id: CameraPresetId): boolean {
    return id === "ensemble-focus" && performerCount !== 4;
  }

  function tooltipFor(id: CameraPresetId): string | undefined {
    if (id === "ensemble-focus" && performerCount !== 4) {
      return "Needs exactly 4 performers";
    }
    return undefined;
  }

  function pickPreset(id: CameraPresetId) {
    if (isDisabled(id)) return;
    viewer.cameraChoreography.setPresetId(id);
  }
</script>

{#if open}
  <!-- svelte-ignore a11y_interactive_supports_focus -->
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div
    class="pop"
    role="dialog"
    aria-label="Export"
    onclick={(e) => e.stopPropagation()}
    onpointerdown={(e) => e.stopPropagation()}
    in:scale={{ duration: 220, start: 0.92, opacity: 0, easing: backOut }}
    out:scale={{ duration: 160, start: 0.95, opacity: 0, easing: cubicOut }}
  >
    <div class="pop-header">Export</div>

    <div class="pop-body">
      <div class="row">
        <div class="row-label">Resolution</div>
        <div class="chips">
          {#each RESOLUTIONS as r (r)}
            <button
              class="chip"
              class:active={opts.videoResolution === r}
              onclick={() => opts.setVideoResolution(r)}
              aria-pressed={opts.videoResolution === r}
            >
              {resLabel(r)}
            </button>
          {/each}
        </div>
      </div>

      <div class="row">
        <div class="row-label">Quality</div>
        <div class="chips">
          {#each QUALITIES as q (q)}
            <button
              class="chip"
              class:active={opts.videoQuality === q}
              onclick={() => opts.setVideoQuality(q)}
              aria-pressed={opts.videoQuality === q}
            >
              {qualityLabel(q)}
            </button>
          {/each}
        </div>
      </div>

      <div class="row">
        <div class="row-label">FPS</div>
        <div class="chips">
          {#each FPS_OPTIONS as f (f)}
            <button
              class="chip"
              class:active={opts.videoFps === f}
              onclick={() => opts.setVideoFps(f)}
              aria-pressed={opts.videoFps === f}
            >
              {f}
            </button>
          {/each}
        </div>
      </div>

      <div class="row">
        <div class="row-label">Camera</div>
        <div class="camera-grid">
          {#each CAMERA_PRESETS as preset (preset.id)}
            {@const disabled = isDisabled(preset.id)}
            {@const active = activePresetId === preset.id}
            <button
              type="button"
              class="cam-tile"
              class:active
              disabled={disabled}
              aria-pressed={active}
              title={tooltipFor(preset.id)}
              style={preset.tint ? `--tile-accent: ${preset.tint};` : undefined}
              onclick={() => pickPreset(preset.id)}
            >
              <i class="fas {preset.icon}"></i>
              <span class="cam-label">{preset.label}</span>
            </button>
          {/each}
        </div>
      </div>

      <button
        class="advanced-toggle"
        onclick={() => (advancedOpen = !advancedOpen)}
        aria-expanded={advancedOpen}
      >
        <i class="fas fa-chevron-{advancedOpen ? 'down' : 'right'}"></i>
        Advanced
      </button>

      {#if advancedOpen}
        <div class="advanced" transition:slide={{ duration: 180 }}>
          <div class="row">
            <div class="row-label">Loop count</div>
            <div class="stepper">
              <button
                class="step-btn"
                onclick={() => opts.setVideoLoopCount(opts.videoLoopCount - 1)}
                aria-label="Decrease loop count"
                disabled={opts.videoLoopCount <= 1}
              >
                <i class="fas fa-minus"></i>
              </button>
              <span class="step-value">{opts.videoLoopCount}</span>
              <button
                class="step-btn"
                onclick={() => opts.setVideoLoopCount(opts.videoLoopCount + 1)}
                aria-label="Increase loop count"
                disabled={opts.videoLoopCount >= 10}
              >
                <i class="fas fa-plus"></i>
              </button>
            </div>
          </div>
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .pop {
    position: absolute; right: calc(100% + 10px); top: 0;
    width: 340px;
    background: rgba(20, 22, 32, 0.82);
    backdrop-filter: blur(24px) saturate(150%);
    border: 1px solid rgba(255,255,255,0.18);
    border-radius: 18px;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.55);
    overflow: hidden;
    z-index: 100;
  }
  .pop-header {
    padding: 14px 16px 10px;
    border-bottom: 1px solid rgba(255,255,255,0.10);
    font-size: 11px; font-weight: 700; letter-spacing: 0.08em;
    text-transform: uppercase; color: rgba(255,255,255,0.42);
  }
  .pop-body { padding: 14px 16px 16px; display: flex; flex-direction: column; gap: 14px; }

  .row { display: flex; flex-direction: column; gap: 8px; }
  .row-label {
    font-size: 11px; font-weight: 600; letter-spacing: 0.06em;
    text-transform: uppercase; color: rgba(255,255,255,0.52);
  }

  .chips { display: flex; gap: 6px; flex-wrap: wrap; }
  .chip {
    flex: 1 1 auto; min-width: 56px;
    padding: 8px 10px;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.10);
    border-radius: 10px;
    color: rgba(255,255,255,0.72);
    font-size: 12px; font-weight: 600;
    cursor: pointer;
    transition: all 140ms cubic-bezier(0.2, 0, 0.13, 1.5);
  }
  .chip:hover { background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.95); }
  .chip.active {
    background: color-mix(in srgb, #4a9eff 22%, transparent);
    border-color: color-mix(in srgb, #4a9eff 55%, transparent);
    color: #cfe4ff;
  }

  .camera-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 6px;
  }
  .cam-tile {
    --tile-accent: #4a9eff;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    gap: 6px;
    padding: 10px 6px;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.10);
    border-radius: 10px;
    color: rgba(255,255,255,0.72);
    font-size: 11px; font-weight: 600;
    cursor: pointer;
    transition: all 140ms cubic-bezier(0.2, 0, 0.13, 1.5);
    min-height: 58px;
  }
  .cam-tile:hover:not(:disabled) {
    background: rgba(255,255,255,0.08);
    color: rgba(255,255,255,0.95);
  }
  .cam-tile:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }
  .cam-tile.active {
    background: color-mix(in srgb, var(--tile-accent) 22%, transparent);
    border-color: color-mix(in srgb, var(--tile-accent) 55%, transparent);
    color: color-mix(in srgb, var(--tile-accent) 70%, white 30%);
  }
  .cam-tile i { font-size: 15px; }
  .cam-label { letter-spacing: 0.02em; }

  .advanced-toggle {
    background: none; border: none;
    padding: 4px 0; margin-top: 2px;
    color: rgba(255,255,255,0.58);
    font-size: 11px; font-weight: 600; letter-spacing: 0.06em;
    text-transform: uppercase;
    cursor: pointer;
    display: flex; align-items: center; gap: 8px;
    align-self: flex-start;
  }
  .advanced-toggle:hover { color: rgba(255,255,255,0.92); }
  .advanced-toggle i { font-size: 10px; width: 10px; }

  .advanced { display: flex; flex-direction: column; gap: 14px; }

  .stepper {
    display: flex; align-items: center; gap: 12px;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.10);
    border-radius: 10px;
    padding: 4px;
    align-self: flex-start;
  }
  .step-btn {
    width: 28px; height: 28px;
    background: transparent; border: none; border-radius: 8px;
    color: rgba(255,255,255,0.82);
    cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    font-size: 11px;
  }
  .step-btn:hover:not(:disabled) { background: rgba(255,255,255,0.08); }
  .step-btn:disabled { opacity: 0.3; cursor: not-allowed; }
  .step-value {
    min-width: 24px; text-align: center;
    color: rgba(255,255,255,0.95);
    font-size: 13px; font-weight: 700; font-variant-numeric: tabular-nums;
  }
</style>
