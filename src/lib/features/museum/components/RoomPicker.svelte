<script lang="ts">
  /**
   * RoomPicker — floating pill bar for isolating individual museum rooms.
   *
   * Sits at the top center of the museum 3D view. Each pill represents a room.
   * Clicking a pill filters the museum to show only that room. "Full Museum"
   * restores the complete connected layout.
   *
   * The selected room is synced to the URL query param `?room=<id>` so users
   * can share links to specific rooms.
   */

  interface Props {
    selectedRoom: string | null;
    onSelect: (roomId: string | null) => void;
  }

  const { selectedRoom, onSelect }: Props = $props();

  // Room ordering follows the main path, then side branches
  const ROOM_ORDER: { id: string; name: string; theme: string }[] = [
    { id: "entrance", name: "Entrance Lobby", theme: "institutional" },
    { id: "vulcan-cave", name: "Vulcan Cave", theme: "cave" },
    { id: "egyptian", name: "Egyptian Wing", theme: "classical" },
    { id: "renaissance", name: "Renaissance Wing", theme: "renaissance" },
    { id: "victorian", name: "Victorian Wing", theme: "industrial" },
    { id: "digital", name: "Digital Wing", theme: "digital" },
    { id: "suppression", name: "The Suppression", theme: "institutional" },
    { id: "crumble", name: "The Crumble", theme: "construction" },
    { id: "gallery", name: "K's Gallery", theme: "gallery" },
    { id: "fear", name: "Room of Fear", theme: "institutional" },
    { id: "isolation", name: "Room of Isolation", theme: "institutional" },
    { id: "collaboration", name: "Room of Collaboration", theme: "outdoor" },
    { id: "gift-shop", name: "Gift Shop", theme: "retail" },
    // Side branches
    { id: "vtg-wing", name: "Vulcan Wing", theme: "construction" },
    { id: "construction-zone", name: "Construction Zone", theme: "construction" },
    { id: "janitor", name: "Janitor's Closet", theme: "construction" },
  ];

  const WING_THEME_COLORS: Record<string, string> = {
    institutional: "#8090a0",
    cave: "#c07030",
    classical: "#d4a850",
    renaissance: "#b08040",
    industrial: "#a09070",
    digital: "#5080c0",
    construction: "#c0a030",
    gallery: "#d4a060",
    retail: "#a0b0a0",
    outdoor: "#70a060",
  };

  function getThemeColor(theme: string): string {
    return WING_THEME_COLORS[theme] ?? "#888";
  }
</script>

<div class="room-picker">
  <button
    class="room-pill"
    class:active={selectedRoom === null}
    onclick={() => onSelect(null)}
  >
    Full Museum
  </button>

  {#each ROOM_ORDER as room}
    <button
      class="room-pill"
      class:active={selectedRoom === room.id}
      style:--pill-accent={getThemeColor(room.theme)}
      onclick={() => onSelect(room.id)}
    >
      {room.name}
    </button>
  {/each}
</div>

<style>
  .room-picker {
    position: absolute;
    top: 12px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 100;
    display: flex;
    flex-direction: row;
    gap: 4px;
    padding: 4px 8px;
    border-radius: 20px;
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(8px);
    overflow-x: auto;
    max-width: 90vw;
    scrollbar-width: none;
  }

  .room-picker::-webkit-scrollbar {
    display: none;
  }

  .room-pill {
    flex-shrink: 0;
    padding: 4px 12px;
    border-radius: 16px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    background: transparent;
    color: var(--theme-text, #ffffff);
    font-size: var(--font-size-compact, 12px);
    font-family: inherit;
    cursor: pointer;
    white-space: nowrap;
    border-left: 3px solid var(--pill-accent, transparent);
    transition: background 0.15s ease, border-color 0.15s ease;
  }

  .room-pill:hover {
    background: rgba(255, 255, 255, 0.08);
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
  }

  .room-pill.active {
    background: color-mix(in srgb, var(--pill-accent, #888) 20%, transparent);
    border-color: var(--pill-accent, rgba(255, 255, 255, 0.3));
  }

  /* "Full Museum" pill has no accent border */
  .room-pill:first-child {
    border-left: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .room-pill.active:first-child {
    background: rgba(255, 255, 255, 0.12);
    border-color: rgba(255, 255, 255, 0.3);
  }
</style>
