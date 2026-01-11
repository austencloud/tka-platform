<script lang="ts">
  import type { UFOMood, WobbleType } from "$lib/shared/background/night-sky/services/UFOSystem";

  type EntranceType = "fade" | "warp" | "zoom" | "descend";
  type ExitType = "fade" | "warp" | "zoom" | "shootUp";

  interface UFOStatus {
    active: boolean;
    mood: string | null;
    tiredness: number | null;
    state: string | null;
    position: { x: number; y: number } | null;
    heading: number | null;
    scannedStars: number;
  }

  interface Props {
    status: UFOStatus;
    onSpawn: () => void;
    onSetMood: (mood: UFOMood) => void;
    onResetTiredness: () => void;
    onClearScannedStars: () => void;
    onTriggerWobble: (type: WobbleType) => void;
    onWander: () => void;
    onDrift: () => void;
    onPause: () => void;
    onScanStar: () => void;
    onScanGround: () => void;
    onEntranceType: (type: EntranceType) => void;
    onExitType: (type: ExitType) => void;
    onTriggerMeteor: () => void;
    onTriggerComet: () => void;
  }

  let {
    status,
    onSpawn,
    onSetMood,
    onResetTiredness,
    onClearScannedStars,
    onTriggerWobble,
    onWander,
    onDrift,
    onPause,
    onScanStar,
    onScanGround,
    onEntranceType,
    onExitType,
    onTriggerMeteor,
    onTriggerComet,
  }: Props = $props();

  // Collapsible section state
  let expandedSections = $state<Set<string>>(new Set(["mood"]));

  function toggleSection(section: string) {
    const next = new Set(expandedSections);
    if (next.has(section)) {
      next.delete(section);
    } else {
      next.add(section);
    }
    expandedSections = next;
  }

  const moodOptions: { mood: UFOMood; icon: string; color: string }[] = [
    { mood: "curious", icon: "fa-search", color: "#93c5fd" },
    { mood: "excited", icon: "fa-bolt", color: "#fcd34d" },
    { mood: "playful", icon: "fa-star", color: "#c4b5fd" },
    { mood: "bored", icon: "fa-meh", color: "#9ca3af" },
    { mood: "startled", icon: "fa-exclamation", color: "#fca5a5" },
    { mood: "tired", icon: "fa-bed", color: "#6b7280" },
  ];

  const wobbleOptions: { type: WobbleType; label: string; icon: string }[] = [
    { type: "curious_tilt", label: "Curious", icon: "fa-search" },
    { type: "startled_jolt", label: "Startle", icon: "fa-bolt" },
    { type: "disappointed_shake", label: "Disappoint", icon: "fa-frown" },
    { type: "happy_bounce", label: "Happy", icon: "fa-smile" },
    { type: "yawn_stretch", label: "Yawn", icon: "fa-bed" },
  ];

  const entranceOptions: { type: EntranceType; icon: string }[] = [
    { type: "fade", icon: "fa-ghost" },
    { type: "warp", icon: "fa-bolt" },
    { type: "zoom", icon: "fa-compress-arrows-alt" },
    { type: "descend", icon: "fa-arrow-down" },
  ];

  const exitOptions: { type: ExitType; icon: string }[] = [
    { type: "fade", icon: "fa-ghost" },
    { type: "warp", icon: "fa-bolt" },
    { type: "zoom", icon: "fa-expand-arrows-alt" },
    { type: "shootUp", icon: "fa-rocket" },
  ];
</script>

<div class="ufo-lab">
  <!-- Compact Status Bar -->
  <div class="status-bar">
    <div class="status-chip {status.state ?? 'inactive'}">
      <span class="chip-label">{status.state ?? 'inactive'}</span>
    </div>
    <div class="status-chip mood {status.mood ?? 'inactive'}">
      <span class="chip-label">{status.mood ?? 'none'}</span>
    </div>
    <div class="energy-mini">
      <i class="fas fa-bolt"></i>
      <div class="energy-track">
        <div class="energy-fill" style="width: {(1 - (status.tiredness ?? 0)) * 100}%"></div>
      </div>
    </div>
    <div class="memory-mini" title="{status.scannedStars} stars scanned">
      <i class="fas fa-brain"></i>
      <span>{status.scannedStars}/10</span>
    </div>
  </div>

  <!-- Primary Actions -->
  <div class="primary-actions">
    <button class="spawn-btn" onclick={onSpawn}>
      <i class="fas fa-satellite"></i>
      <span>Spawn UFO</span>
    </button>
    <div class="quick-commands">
      <button class="cmd-btn" onclick={onWander} title="Wander">
        <i class="fas fa-random"></i>
      </button>
      <button class="cmd-btn" onclick={onDrift} title="Drift">
        <i class="fas fa-cloud"></i>
      </button>
      <button class="cmd-btn" onclick={onPause} title="Pause">
        <i class="fas fa-pause"></i>
      </button>
      <button class="cmd-btn" onclick={onScanStar} title="Scan">
        <i class="fas fa-crosshairs"></i>
      </button>
    </div>
  </div>

  <!-- Collapsible: Mood -->
  <div class="collapsible-section" class:expanded={expandedSections.has("mood")}>
    <button class="section-toggle" onclick={() => toggleSection("mood")}>
      <i class="fas fa-heart"></i>
      <span>Mood</span>
      <i class="fas fa-chevron-down chevron"></i>
    </button>
    {#if expandedSections.has("mood")}
      <div class="section-content">
        <div class="mood-grid">
          {#each moodOptions as { mood, icon, color }}
            <button
              class="mood-btn"
              class:active={status.mood === mood}
              style="--mood-color: {color}"
              onclick={() => onSetMood(mood)}
              title={mood}
            >
              <i class="fas {icon}"></i>
            </button>
          {/each}
        </div>
        <div class="mood-actions">
          <button class="secondary-btn" onclick={onResetTiredness}>
            <i class="fas fa-battery-full"></i> Reset Energy
          </button>
          <button class="secondary-btn" onclick={onClearScannedStars}>
            <i class="fas fa-eraser"></i> Clear Memory
          </button>
        </div>
      </div>
    {/if}
  </div>

  <!-- Collapsible: Reactions (Wobbles) -->
  <div class="collapsible-section" class:expanded={expandedSections.has("reactions")}>
    <button class="section-toggle" onclick={() => toggleSection("reactions")}>
      <i class="fas fa-wave-square"></i>
      <span>Reactions</span>
      <i class="fas fa-chevron-down chevron"></i>
    </button>
    {#if expandedSections.has("reactions")}
      <div class="section-content">
        <div class="reaction-grid">
          {#each wobbleOptions as { type, label, icon }}
            <button class="reaction-btn" onclick={() => onTriggerWobble(type)}>
              <i class="fas {icon}"></i>
              <span>{label}</span>
            </button>
          {/each}
        </div>
      </div>
    {/if}
  </div>

  <!-- Collapsible: Animations (Entrance/Exit) -->
  <div class="collapsible-section" class:expanded={expandedSections.has("animations")}>
    <button class="section-toggle" onclick={() => toggleSection("animations")}>
      <i class="fas fa-door-open"></i>
      <span>Animations</span>
      <i class="fas fa-chevron-down chevron"></i>
    </button>
    {#if expandedSections.has("animations")}
      <div class="section-content">
        <div class="anim-group">
          <span class="anim-label">Enter</span>
          <div class="anim-buttons">
            {#each entranceOptions as { type, icon }}
              <button class="anim-btn entrance" onclick={() => onEntranceType(type)} title={type}>
                <i class="fas {icon}"></i>
              </button>
            {/each}
          </div>
        </div>
        <div class="anim-group">
          <span class="anim-label">Exit</span>
          <div class="anim-buttons">
            {#each exitOptions as { type, icon }}
              <button class="anim-btn exit" onclick={() => onExitType(type)} title={type}>
                <i class="fas {icon}"></i>
              </button>
            {/each}
          </div>
        </div>
      </div>
    {/if}
  </div>

  <!-- Collapsible: Events -->
  <div class="collapsible-section" class:expanded={expandedSections.has("events")}>
    <button class="section-toggle" onclick={() => toggleSection("events")}>
      <i class="fas fa-magic"></i>
      <span>Events</span>
      <i class="fas fa-chevron-down chevron"></i>
    </button>
    {#if expandedSections.has("events")}
      <div class="section-content">
        <div class="event-grid">
          <button class="event-btn meteor" onclick={onTriggerMeteor}>
            <i class="fas fa-meteor"></i>
            <span>Meteor</span>
          </button>
          <button class="event-btn comet" onclick={onTriggerComet}>
            <i class="fas fa-fire"></i>
            <span>Comet</span>
          </button>
        </div>
      </div>
    {/if}
  </div>

  <!-- Click Hint (compact) -->
  <div class="click-hint">
    <i class="fas fa-mouse-pointer"></i>
    <span>Click canvas to interact with UFO</span>
  </div>
</div>

<style>
  .ufo-lab {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  /* ===== Status Bar ===== */
  .status-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    background: rgba(255, 255, 255, 0.03);
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.06);
  }

  .status-chip {
    padding: 3px 8px;
    border-radius: 12px;
    font-size: 0.65rem;
    font-weight: 600;
    text-transform: capitalize;
    background: rgba(255, 255, 255, 0.05);
    color: #6b7280;
  }

  .status-chip.wandering { background: rgba(96, 165, 250, 0.2); color: #93c5fd; }
  .status-chip.paused { background: rgba(251, 191, 36, 0.2); color: #fcd34d; }
  .status-chip.scanning_star,
  .status-chip.scanning_ground { background: rgba(52, 211, 153, 0.2); color: #6ee7b7; }
  .status-chip.tracking_event,
  .status-chip.chasing { background: rgba(239, 68, 68, 0.2); color: #fca5a5; }
  .status-chip.entering,
  .status-chip.exiting { background: rgba(168, 85, 247, 0.2); color: #c4b5fd; }
  .status-chip.napping { background: rgba(75, 85, 99, 0.3); color: #9ca3af; }
  .status-chip.celebrating { background: linear-gradient(90deg, rgba(239, 68, 68, 0.2), rgba(251, 191, 36, 0.2)); color: #fcd34d; }

  .status-chip.mood.curious { background: rgba(96, 165, 250, 0.15); color: #93c5fd; }
  .status-chip.mood.excited { background: rgba(251, 191, 36, 0.15); color: #fcd34d; }
  .status-chip.mood.playful { background: rgba(168, 85, 247, 0.15); color: #c4b5fd; }
  .status-chip.mood.bored { background: rgba(107, 114, 128, 0.2); color: #9ca3af; }
  .status-chip.mood.startled { background: rgba(239, 68, 68, 0.15); color: #fca5a5; }
  .status-chip.mood.tired { background: rgba(75, 85, 99, 0.2); color: #6b7280; }

  .energy-mini {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-left: auto;
    color: #6ee7b7;
    font-size: 0.7rem;
  }

  .energy-mini i {
    font-size: 0.6rem;
    opacity: 0.7;
  }

  .energy-track {
    width: 40px;
    height: 6px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 3px;
    overflow: hidden;
  }

  .energy-fill {
    height: 100%;
    background: linear-gradient(90deg, #10b981, #34d399);
    border-radius: 3px;
    transition: width 0.3s ease;
  }

  .memory-mini {
    display: flex;
    align-items: center;
    gap: 4px;
    color: #a78bfa;
    font-size: 0.65rem;
  }

  .memory-mini i {
    font-size: 0.6rem;
    opacity: 0.7;
  }

  /* ===== Primary Actions ===== */
  .primary-actions {
    display: flex;
    gap: 10px;
    align-items: stretch;
  }

  .spawn-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 12px 16px;
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 10px;
    color: #ffffff;
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
  }

  .spawn-btn:hover {
    transform: translateY(-1px);
    box-shadow: 0 6px 16px rgba(99, 102, 241, 0.4);
  }

  .spawn-btn:active {
    transform: translateY(0);
  }

  .quick-commands {
    display: flex;
    gap: 6px;
  }

  .cmd-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    color: #d1d5db;
    font-size: 0.85rem;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .cmd-btn:hover {
    background: rgba(139, 92, 246, 0.2);
    border-color: rgba(139, 92, 246, 0.4);
    color: #ffffff;
    transform: translateY(-1px);
  }

  .cmd-btn:active {
    transform: translateY(0) scale(0.95);
  }

  /* ===== Collapsible Sections ===== */
  .collapsible-section {
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 10px;
    overflow: hidden;
    transition: border-color 0.2s ease;
  }

  .collapsible-section.expanded {
    border-color: rgba(139, 92, 246, 0.2);
  }

  .section-toggle {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 10px 12px;
    background: transparent;
    border: none;
    color: rgba(255, 255, 255, 0.7);
    font-size: 0.75rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .section-toggle:hover {
    background: rgba(255, 255, 255, 0.03);
    color: #ffffff;
  }

  .section-toggle i:first-child {
    font-size: 0.7rem;
    color: #a78bfa;
    opacity: 0.8;
  }

  .section-toggle .chevron {
    margin-left: auto;
    font-size: 0.6rem;
    opacity: 0.5;
    transition: transform 0.2s ease;
  }

  .collapsible-section.expanded .chevron {
    transform: rotate(180deg);
  }

  .section-content {
    padding: 0 12px 12px;
  }

  /* ===== Mood Section ===== */
  .mood-grid {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: 6px;
    margin-bottom: 10px;
  }

  .mood-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    aspect-ratio: 1;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    color: var(--mood-color, #d1d5db);
    font-size: 0.85rem;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .mood-btn:hover {
    background: color-mix(in srgb, var(--mood-color) 20%, transparent);
    border-color: var(--mood-color);
    transform: translateY(-1px);
  }

  .mood-btn.active {
    background: color-mix(in srgb, var(--mood-color) 25%, transparent);
    border-color: var(--mood-color);
    box-shadow: 0 0 10px color-mix(in srgb, var(--mood-color) 40%, transparent);
  }

  .mood-actions {
    display: flex;
    gap: 8px;
  }

  .secondary-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 8px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 6px;
    color: rgba(255, 255, 255, 0.7);
    font-size: 0.7rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .secondary-btn:hover {
    background: rgba(255, 255, 255, 0.08);
    color: #ffffff;
  }

  .secondary-btn i {
    font-size: 0.65rem;
    opacity: 0.7;
  }

  /* ===== Reactions Section ===== */
  .reaction-grid {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 6px;
  }

  .reaction-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 10px 4px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    color: #d1d5db;
    font-size: 0.6rem;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .reaction-btn:hover {
    background: rgba(139, 92, 246, 0.15);
    border-color: rgba(139, 92, 246, 0.3);
    color: #ffffff;
    transform: translateY(-1px);
  }

  .reaction-btn:active {
    transform: translateY(0) scale(0.95);
  }

  .reaction-btn i {
    font-size: 0.9rem;
  }

  /* ===== Animations Section ===== */
  .anim-group {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
  }

  .anim-group:last-child {
    margin-bottom: 0;
  }

  .anim-label {
    font-size: 0.65rem;
    color: rgba(255, 255, 255, 0.5);
    width: 32px;
    flex-shrink: 0;
  }

  .anim-buttons {
    display: flex;
    gap: 6px;
    flex: 1;
  }

  .anim-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 8px;
    border-radius: 6px;
    font-size: 0.8rem;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .anim-btn.entrance {
    background: rgba(34, 211, 238, 0.1);
    border: 1px solid rgba(34, 211, 238, 0.2);
    color: #67e8f9;
  }

  .anim-btn.entrance:hover {
    background: rgba(34, 211, 238, 0.2);
    border-color: rgba(34, 211, 238, 0.4);
    transform: translateY(-1px);
  }

  .anim-btn.exit {
    background: rgba(251, 146, 60, 0.1);
    border: 1px solid rgba(251, 146, 60, 0.2);
    color: #fdba74;
  }

  .anim-btn.exit:hover {
    background: rgba(251, 146, 60, 0.2);
    border-color: rgba(251, 146, 60, 0.4);
    transform: translateY(-1px);
  }

  /* ===== Events Section ===== */
  .event-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }

  .event-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 10px;
    border-radius: 8px;
    font-size: 0.75rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .event-btn.meteor {
    background: rgba(251, 146, 60, 0.12);
    border: 1px solid rgba(251, 146, 60, 0.25);
    color: #fdba74;
  }

  .event-btn.meteor:hover {
    background: rgba(251, 146, 60, 0.2);
    transform: translateY(-1px);
  }

  .event-btn.comet {
    background: rgba(34, 211, 238, 0.12);
    border: 1px solid rgba(34, 211, 238, 0.25);
    color: #67e8f9;
  }

  .event-btn.comet:hover {
    background: rgba(34, 211, 238, 0.2);
    transform: translateY(-1px);
  }

  /* ===== Click Hint ===== */
  .click-hint {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 8px;
    font-size: 0.65rem;
    color: rgba(255, 255, 255, 0.35);
  }

  .click-hint i {
    font-size: 0.6rem;
  }
</style>
