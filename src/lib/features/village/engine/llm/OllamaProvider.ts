import type { IInferenceProvider } from "./village-llm-types";

/**
 * Direct HTTP inference to local Ollama instance.
 * Falls back gracefully if Ollama isn't running.
 */
export class OllamaProvider implements IInferenceProvider {
	readonly name = "ollama" as const;
	private baseUrl = "http://localhost:11434";
	private model = "llama3.1:8b";

	async infer(prompt: string): Promise<string> {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), 5000);

		try {
			const response = await fetch(`${this.baseUrl}/api/generate`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					model: this.model,
					prompt,
					stream: false,
					options: {
						temperature: 0.7,
						num_predict: 30,
					},
				}),
				signal: controller.signal,
			});

			const data = await response.json();
			// qwen3 may put content in "thinking" field instead of "response"
			const text = data.response || data.thinking || "";
			return text.trim().toLowerCase();
		} finally {
			clearTimeout(timeout);
		}
	}

	async isAvailable(): Promise<boolean> {
		try {
			const controller = new AbortController();
			const timeout = setTimeout(() => controller.abort(), 2000);
			const response = await fetch(`${this.baseUrl}/api/tags`, {
				signal: controller.signal,
			});
			clearTimeout(timeout);
			return response.ok;
		} catch {
			return false;
		}
	}
}
