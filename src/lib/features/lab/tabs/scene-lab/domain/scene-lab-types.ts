/**
 * Scene Lab Types
 *
 * Scene identifier union - add new IDs here as we build new scenes.
 */

export type SceneId = "winter" | "forest-firefly" | "forest-autumn";

export interface SceneOption {
  id: SceneId;
  label: string;
  description: string;
}

export const SCENE_OPTIONS: SceneOption[] = [
  {
    id: "winter",
    label: "Winter",
    description: "Snowy forest clearing with frozen pond and campfire",
  },
  {
    id: "forest-firefly",
    label: "Forest (Firefly)",
    description: "Moonlit forest with fireflies and warm campfire",
  },
  {
    id: "forest-autumn",
    label: "Forest (Autumn)",
    description: "Golden-hour forest clearing with falling leaves",
  },
];
