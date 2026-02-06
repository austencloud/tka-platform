/**
 * ITikaModelProvider - Contract for Multi-Provider Model Configuration
 *
 * Manages AI model selection across multiple providers (Anthropic, DeepSeek).
 */

import type { LanguageModel } from "ai";

export interface ModelConfig {
  provider: "anthropic" | "deepseek";
  modelId: string;
}

export interface ITikaModelProvider {
  /**
   * Get a language model instance by key.
   * Falls back to sonnet-4 if key not found.
   *
   * @param modelKey - Model key (e.g., "sonnet-4", "deepseek")
   * @returns Language model instance
   */
  getModel(modelKey: string): LanguageModel;

  /**
   * Get available model configurations.
   */
  getAvailableModels(): Record<string, ModelConfig>;

  /**
   * Check if the API key for a provider is configured.
   *
   * @param provider - Provider name
   * @returns True if configured
   */
  isProviderConfigured(provider: "anthropic" | "deepseek"): boolean;
}
