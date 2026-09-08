/**
 * TikaModelProvider - Multi-provider model configuration
 *
 * Manages AI model selection across Anthropic and DeepSeek providers.
 */

import { createAnthropic } from "@ai-sdk/anthropic";
import { createDeepSeek } from "@ai-sdk/deepseek";
import type { LanguageModel } from "ai";
import {
  getTikaModelDefinition,
  TIKA_MODELS,
} from "../domain/tika-model-catalog";

export interface ModelConfig {
  provider: "anthropic" | "deepseek";
  modelId: string;
}

export class TikaModelProvider {
  constructor(
    private anthropicApiKey: string,
    private deepseekApiKey: string
  ) {}

  getModel(modelKey: string): LanguageModel {
    const config = getTikaModelDefinition(modelKey);

    if (!config) {
      throw new Error(`Unknown TIKA model: ${modelKey}`);
    }

    if (config.provider === "anthropic") {
      const anthropic = createAnthropic({ apiKey: this.anthropicApiKey });
      return anthropic(config.modelId);
    }

    const deepseek = createDeepSeek({ apiKey: this.deepseekApiKey });
    return deepseek(config.modelId);
  }

  getAvailableModels(): Record<string, ModelConfig> {
    return Object.fromEntries(
      TIKA_MODELS.map(({ id, provider, modelId }) => [
        id,
        { provider, modelId },
      ])
    );
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
