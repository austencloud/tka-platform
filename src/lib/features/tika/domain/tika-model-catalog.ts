import type { ModelOption } from "../types";

export interface TikaModelDefinition extends ModelOption {
  provider: "anthropic" | "deepseek";
  modelId: string;
}

// Keep the picker and server on the same model IDs. Reviewed against the
// providers' model catalogs on 2026-09-04; provider retirement is an API break.
export const TIKA_MODELS = [
  {
    id: "haiku",
    modelId: "claude-haiku-4-5-20251001",
    provider: "anthropic",
    name: "Claude Haiku 4.5",
    shortName: "Haiku 4.5",
    icon: "fa-bolt",
    color: "#f59e0b",
    description: "Fast, lower-cost everyday answers",
  },
  {
    id: "sonnet-5",
    modelId: "claude-sonnet-5",
    provider: "anthropic",
    name: "Claude Sonnet 5",
    shortName: "Sonnet 5",
    icon: "fa-brain",
    color: "#6366f1",
    description: "More capable reasoning",
  },
  {
    id: "deepseek",
    modelId: "deepseek-v4-flash",
    provider: "deepseek",
    name: "DeepSeek V4 Flash",
    shortName: "V4 Flash",
    icon: "fa-water",
    color: "#3b82f6",
    description: "Low-cost alternative",
  },
] as const satisfies readonly TikaModelDefinition[];

export type TikaModelKey = (typeof TIKA_MODELS)[number]["id"];
export const DEFAULT_TIKA_MODEL: TikaModelKey = "haiku";

export function resolveTikaModelKey(key: string): TikaModelKey | null {
  // Saved Sonnet preferences retain their more-capable tier after retirement.
  if (key === "sonnet-4" || key === "sonnet-4-legacy") return "sonnet-5";
  return TIKA_MODELS.find((model) => model.id === key)?.id ?? null;
}

export function getTikaModelDefinition(
  key: string
): TikaModelDefinition | undefined {
  const resolved = resolveTikaModelKey(key);
  return TIKA_MODELS.find((model) => model.id === resolved);
}

export function getConfiguredTikaModels(providers: {
  anthropic: boolean;
  deepseek: boolean;
}): ModelOption[] {
  return TIKA_MODELS.filter((model) => providers[model.provider]).map(
    ({ provider: _provider, modelId: _modelId, ...option }) => option
  );
}
