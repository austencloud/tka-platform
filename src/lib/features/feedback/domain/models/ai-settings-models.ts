/**
 * AI Settings Models
 *
 * Types and constants for AI-powered feedback analysis configuration.
 */

export type AIProviderType = "ollama" | "claude" | "openai";

export interface OllamaSettings {
  baseUrl: string;
  modelId: string;
}

export interface ClaudeSettings {
  modelId: string;
}

export interface OpenAISettings {
  modelId: string;
}

export interface AIAnalysisSettings {
  enabled: boolean;
  defaultProvider: AIProviderType;
  ollama: OllamaSettings;
  claude: ClaudeSettings;
  openai: OpenAISettings;
  maxClarificationRounds: number;
  generateClaudeCodePrompts: boolean;
}

export const CLAUDE_MODELS = [
  { id: "claude-sonnet-4-20250514", name: "Claude Sonnet 4" },
  { id: "claude-3-5-sonnet-20241022", name: "Claude 3.5 Sonnet" },
  { id: "claude-3-haiku-20240307", name: "Claude 3 Haiku (Fast)" },
] as const;

export const OPENAI_MODELS = [
  { id: "gpt-4o", name: "GPT-4o" },
  { id: "gpt-4o-mini", name: "GPT-4o Mini (Fast)" },
  { id: "gpt-4-turbo", name: "GPT-4 Turbo" },
] as const;

export const DEFAULT_AI_SETTINGS: AIAnalysisSettings = {
  enabled: false,
  defaultProvider: "ollama",
  ollama: {
    baseUrl: "http://localhost:11434",
    modelId: "llama3.2",
  },
  claude: {
    modelId: "claude-sonnet-4-20250514",
  },
  openai: {
    modelId: "gpt-4o-mini",
  },
  maxClarificationRounds: 2,
  generateClaudeCodePrompts: true,
};
