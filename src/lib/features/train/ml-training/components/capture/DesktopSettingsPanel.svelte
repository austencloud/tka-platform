<!--
  DesktopSettingsPanel.svelte

  Desktop sidebar with config panel, recording controls, and workflow info.
-->
<script lang="ts">
  import type { PropType } from "../../domain/models";

  interface Props {
    sessionName: string;
    propType: PropType;
    fps: number;
    isRecording: boolean;
    isPaused: boolean;
    isInitialized: boolean;
    onSessionNameChange: (name: string) => void;
    onPropTypeChange: (prop: PropType) => void;
    onFpsChange: (fps: number) => void;
    onStartRecording: () => void;
    onStopRecording: () => void;
    onTogglePause: () => void;
    onTakeSnapshot: () => void;
  }

  let {
    sessionName,
    propType,
    fps,
    isRecording,
    isPaused,
    isInitialized,
    onSessionNameChange,
    onPropTypeChange,
    onFpsChange,
    onStartRecording,
    onStopRecording,
    onTogglePause,
    onTakeSnapshot,
  }: Props = $props();

  const canStartRecording = $derived(isInitialized && !isRecording);
  const canStopRecording = $derived(isRecording);
</script>

<div class="desktop-settings">
  <div class="config-panel">
    <h3>Session Settings</h3>

    <div class="config-field">
      <label for="session-name">Session Name</label>
      <input
        type="text"
        id="session-name"
        value={sessionName}
        oninput={(e) => onSessionNameChange(e.currentTarget.value)}
        placeholder="Enter session name"
        disabled={isRecording}
      />
    </div>

    <div class="config-field">
      <label for="prop-type">Prop Type</label>
      <select
        id="prop-type"
        value={propType}
        onchange={(e) => onPropTypeChange(e.currentTarget.value as PropType)}
        disabled={isRecording}
      >
        <option value="club">Club</option>
        <option value="staff">Staff</option>
        <option value="fan">Fan</option>
        <option value="hoop">Hoop</option>
        <option value="buugeng">Buugeng</option>
      </select>
    </div>

    <div class="config-field">
      <label for="fps">Capture FPS</label>
      <select
        id="fps"
        value={fps}
        onchange={(e) => onFpsChange(Number(e.currentTarget.value))}
        disabled={isRecording}
      >
        <option value={5}>5 FPS (low)</option>
        <option value={10}>10 FPS (recommended)</option>
        <option value={15}>15 FPS (high)</option>
        <option value={30}>30 FPS (very high)</option>
      </select>
    </div>
  </div>

  <!-- Desktop Recording Controls -->
  <div class="desktop-controls">
    {#if canStartRecording}
      <button
        class="btn-record-desktop"
        onclick={onStartRecording}
        disabled={!isInitialized}
      >
        <i class="fa fa-circle" aria-hidden="true"></i>
        Start Recording
      </button>
    {:else if canStopRecording}
      <div class="recording-active">
        <button class="btn-pause-desktop" onclick={onTogglePause}>
          <i class="fa {isPaused ? 'fa-play' : 'fa-pause'}" aria-hidden="true"
          ></i>
          {isPaused ? "Resume" : "Pause"}
        </button>

        <button class="btn-snapshot-desktop" onclick={onTakeSnapshot}>
          <i class="fa fa-camera" aria-hidden="true"></i>
          Snapshot
        </button>

        <button class="btn-stop-desktop" onclick={onStopRecording}>
          <i class="fa fa-stop" aria-hidden="true"></i>
          Stop
        </button>
      </div>
    {/if}
  </div>

  <div class="workflow-info">
    <h4>📋 ML Training Workflow</h4>
    <ol>
      <li><strong>Capture:</strong> Record prop video frames</li>
      <li><strong>Label:</strong> Draw bounding boxes</li>
      <li><strong>Export:</strong> COCO format dataset</li>
      <li><strong>Train:</strong> MediaPipe Model Maker</li>
    </ol>
  </div>
</div>

<style>
  .desktop-settings {
    display: none;
  }

  @media (min-width: 1024px) {
    .desktop-settings {
      display: flex;
      flex-direction: column;
      width: 320px;
      gap: 1.5rem;
    }

    .config-panel {
      padding: 1.5rem;
      background: var(--theme-panel-bg);
      border-radius: 16px;
      border: 1px solid var(--theme-stroke);
      box-shadow: var(--theme-panel-shadow, 0 12px 28px rgba(0, 0, 0, 0.35));
      backdrop-filter: blur(24px) saturate(180%);
      -webkit-backdrop-filter: blur(24px) saturate(180%);
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }

    .config-panel h3 {
      margin: 0;
      font-size: 1rem;
      font-weight: 600;
      color: var(--theme-accent);
    }

    .config-field {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .config-field label {
      font-size: 0.85rem;
      font-weight: 500;
      opacity: 0.8;
    }

    .config-field input,
    .config-field select {
      padding: 0.875rem 1rem;
      background: var(--theme-card-bg, var(--theme-card-bg));
      border: 1px solid var(--theme-stroke-strong, var(--theme-stroke-strong));
      border-radius: 10px;
      color: inherit;
      font-size: 1rem;
      transition: all var(--duration-normal);
    }

    .config-field input:focus,
    .config-field select:focus {
      outline: none;
      border-color: var(--theme-accent, var(--theme-accent));
      background: color-mix(in srgb, var(--theme-accent) 10%, transparent);
    }

    .config-field input:disabled,
    .config-field select:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .workflow-info {
      padding: 1.25rem;
      background: linear-gradient(
        135deg,
        color-mix(
          in srgb,
          var(--theme-accent, var(--theme-accent)) 10%,
          transparent
        ),
        color-mix(
          in srgb,
          var(--theme-accent, var(--theme-accent)) 10%,
          transparent
        )
      );
      border: 1px solid
        color-mix(
          in srgb,
          var(--theme-accent, var(--theme-accent)) 20%,
          transparent
        );
      border-radius: 12px;
    }

    .workflow-info h4 {
      margin: 0 0 0.75rem 0;
      font-size: 0.95rem;
      color: var(--theme-accent);
    }

    .workflow-info ol {
      margin: 0;
      padding-left: 1.25rem;
      font-size: 0.85rem;
      line-height: 1.6;
      opacity: 0.9;
    }

    .workflow-info strong {
      color: var(--theme-accent);
    }

    .desktop-controls {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .desktop-controls button {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.75rem;
      padding: 1rem 1.5rem;
      border: none;
      border-radius: 12px;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: all var(--duration-normal) ease;
    }

    .desktop-controls button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .btn-record-desktop {
      background: linear-gradient(
        135deg,
        var(--semantic-error),
        var(--semantic-error)
      );
      color: white;
      box-shadow: 0 4px 16px rgba(239, 68, 68, 0.3);
    }

    .btn-record-desktop:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(239, 68, 68, 0.4);
    }

    .recording-active {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .btn-pause-desktop {
      background: linear-gradient(135deg, var(--semantic-warning), #d97706);
      color: white;
    }

    .btn-snapshot-desktop {
      background: linear-gradient(135deg, var(--semantic-info), #2563eb);
      color: white;
    }

    .btn-stop-desktop {
      background: color-mix(
        in srgb,
        var(--semantic-error, var(--semantic-error)) 18%,
        var(--theme-panel-bg)
      );
      border: 1px solid
        color-mix(
          in srgb,
          var(--semantic-error, var(--semantic-error)) 30%,
          var(--theme-stroke, var(--theme-card-bg))
        );
      color: var(--theme-text);
    }
  }
</style>
