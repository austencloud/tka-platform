/**
 * TikaModelProvider - Multi-provider model configuration
 *
 * Manages AI model selection across Anthropic and DeepSeek providers.
 */

import { createAnthropic } from "@ai-sdk/anthropic";
import { createDeepSeek } from "@ai-sdk/deepseek";
import type { LanguageModel } from "ai";

export interface ModelConfig {
  provider: "anthropic" | "deepseek";
  modelId: string;
}

const MODELS: Record<string, ModelConfig> = {
  "sonnet-4": { provider: "anthropic", modelId: "claude-sonnet-4-6" },
  "sonnet-4-legacy": { provider: "anthropic", modelId: "claude-sonnet-4-20250514" },
  haiku: { provider: "anthropic", modelId: "claude-haiku-4-5-20251001" },
  deepseek: { provider: "deepseek", modelId: "deepseek-chat" },
};

export class TikaModelProvider {
  constructor(
    private anthropicApiKey: string,
    private deepseekApiKey: string
  ) {}

  getModel(modelKey: string): LanguageModel {
    const config = MODELS[modelKey] || MODELS["sonnet-4"];

    if (!config) {
      // Shouldn't happen since we have a fallback above, but TypeScript needs this
      const anthropic = createAnthropic({ apiKey: this.anthropicApiKey });
      return anthropic(MODELS["sonnet-4"]!.modelId);
    }

    if (config.provider === "anthropic") {
      const anthropic = createAnthropic({ apiKey: this.anthropicApiKey });
      return anthropic(config.modelId);
    }

    if (config.provider === "deepseek") {
      const deepseek = createDeepSeek({ apiKey: this.deepseekApiKey });
      return deepseek(config.modelId);
    }

    // Fallback to Anthropic
    const anthropic = createAnthropic({ apiKey: this.anthropicApiKey });
    return anthropic(MODELS["sonnet-4"]!.modelId);
  }

  getAvailableModels(): Record<string, ModelConfig> {
    return { ...MODELS };
  }

  isProviderConfigured(provider: "anthropic" | "deepseek"): boolean {
    if (provider === "anthropic") {
      return !!this.anthropicApiKey;
    }
    if (provider === "deepseek") {
      return !!this.deepseekApiKey;
    }
    return false;
  }
}
