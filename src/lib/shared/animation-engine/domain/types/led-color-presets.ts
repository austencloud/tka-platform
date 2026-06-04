export interface LedColorPreset {
  id: string;
  name: string;
  primaryColor: string;
  secondaryColor?: string;
  builtIn: boolean;
}

export const BUILT_IN_COLOR_PRESETS: readonly LedColorPreset[] = [
  { id: "green-glow", name: "Green Glow", primaryColor: "#00ff88", builtIn: true },
  { id: "fire-red", name: "Fire Red", primaryColor: "#ff4444", builtIn: true },
  { id: "ice-blue", name: "Ice Blue", primaryColor: "#4488ff", builtIn: true },
  { id: "hot-pink", name: "Hot Pink", primaryColor: "#ff00ff", builtIn: true },
  { id: "amber", name: "Amber", primaryColor: "#ffaa00", builtIn: true },
  { id: "ultraviolet", name: "Ultraviolet", primaryColor: "#8800ff", builtIn: true },
  { id: "white", name: "White", primaryColor: "#ffffff", builtIn: true },
  { id: "cyan", name: "Cyan", primaryColor: "#00ffff", builtIn: true },
];

export function validatePreset(p: unknown): p is LedColorPreset {
  if (!p || typeof p !== "object") return false;
  const obj = p as Record<string, unknown>;
  return (
    typeof obj.id === "string" && obj.id.length > 0 &&
    typeof obj.name === "string" &&
    typeof obj.primaryColor === "string" &&
    typeof obj.builtIn === "boolean"
  );
}
