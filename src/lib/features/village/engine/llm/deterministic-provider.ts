import type { IInferenceProvider } from "./village-llm-types";

/**
 * Wraps the existing probability-based decision system in the
 * IInferenceProvider interface. Always available. No LLM needed.
 *
 * This is the default when Ollama isn't running or the user
 * toggles LLM mode off. Decisions are based on personality
 * floats encoded in the prompt - we parse them back out and
 * roll against them, producing the same behavior as the
 * original SocialSystem probability rolls.
 */
export class DeterministicProvider implements IInferenceProvider {
	readonly name = "deterministic" as const;

	async infer(prompt: string): Promise<string> {
		// Extract personality values from prompt
		const sociability = this.extractFloat(prompt, "sociability");
		const creativity = this.extractFloat(prompt, "creativity");
		const hasSequences = prompt.includes("know 0 sequences") ? false : true;
		const canInvent = !prompt.includes("know 0 sequences") && !prompt.includes("know 1 sequence");

		// Same probability distribution as original SocialSystem.handleIdle
		const roll = Math.random();
		const inventionChance = canInvent ? creativity * 0.005 * 10 : 0;

		if (canInvent && roll < inventionChance) return "invent";
		if (hasSequences && roll < 0.2) return "perform";
		if (roll < 0.6 + sociability * 0.3) return "seek";
		return "wander";
	}

	async isAvailable(): Promise<boolean> {
		return true;
	}

	private extractFloat(text: string, key: string): number {
		const match = text.match(new RegExp(`${key}=([\\d.]+)`));
		return match?.[1] ? parseFloat(match[1]) : 0.5;
	}
}
