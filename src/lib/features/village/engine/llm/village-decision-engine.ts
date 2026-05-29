import type {
	DecisionRequest,
	DecisionResponse,
	IInferenceProvider,
	InferenceProvider,
	EntityContext,
	WorldContext,
	IdleAction,
} from "./village-llm-types";
import type { VillageEntity } from "../../domain/village-types";
import { OllamaProvider } from "./ollama-provider";
import { DeterministicProvider } from "./deterministic-provider";
import { VillageEventLog } from "./village-event-log";
import { buildIdlePrompt } from "./prompt-builder";

const VALID_IDLE_ACTIONS: Set<string> = new Set(["seek", "wander", "perform", "invent"]);
const DECISION_COOLDOWN_TICKS = 5; // min ticks between LLM calls per entity

/**
 * Orchestrates LLM-driven entity decisions.
 *
 * Fire-and-forget async: entity stays in current state while inference runs.
 * When response arrives, it's queued and applied at next tick.
 *
 * Falls back to DeterministicProvider when Ollama is unavailable.
 */
export class VillageDecisionEngine {
	private ollamaProvider = new OllamaProvider();
	private deterministicProvider = new DeterministicProvider();
	private activeProvider: IInferenceProvider;

	readonly eventLog = new VillageEventLog();
	readonly pendingDecisions = new Map<string, DecisionResponse>();
	private inflight = new Set<string>(); // entity IDs with pending inference
	private lastDecisionTick = new Map<string, number>();
	private _debugLog: string[] = [];
	private _enabled = false;

	constructor() {
		this.activeProvider = this.deterministicProvider;
	}

	get enabled(): boolean {
		return this._enabled;
	}

	get providerName(): InferenceProvider {
		return this.activeProvider.name;
	}

	get debugLog(): readonly string[] {
		return this._debugLog;
	}

	async setEnabled(enabled: boolean): Promise<void> {
		this._enabled = enabled;
		if (enabled) {
			const ollamaUp = await this.ollamaProvider.isAvailable();
			this.activeProvider = ollamaUp ? this.ollamaProvider : this.deterministicProvider;
			this.log(`LLM ${ollamaUp ? "enabled (Ollama)" : "enabled (deterministic fallback - Ollama not running)"}`);
		} else {
			this.activeProvider = this.deterministicProvider;
			this.log("LLM disabled - using deterministic decisions");
		}
	}

	isLLMActive(): boolean {
		return this._enabled && this.activeProvider.name === "ollama";
	}

	requestIdleDecision(
		entity: VillageEntity,
		nearbyEntities: VillageEntity[],
		currentSeason: string,
		populationSize: number,
		currentTick: number,
	): void {
		if (this.inflight.has(entity.id)) return;

		// Cooldown check
		const lastTick = this.lastDecisionTick.get(entity.id) ?? 0;
		if (currentTick - lastTick < DECISION_COOLDOWN_TICKS) return;

		this.inflight.add(entity.id);
		this.lastDecisionTick.set(entity.id, currentTick);

		const request: DecisionRequest = {
			entityId: entity.id,
			decisionType: "idle",
			entityContext: this.buildEntityContext(entity),
			worldContext: this.buildWorldContext(entity, nearbyEntities, currentSeason, populationSize, currentTick),
		};

		const prompt = buildIdlePrompt(request);

		this.activeProvider.infer(prompt).then((raw) => {
			const action = this.parseIdleAction(raw);
			this.pendingDecisions.set(entity.id, {
				action,
				reasoning: raw,
			});
			this.inflight.delete(entity.id);

			if (this.activeProvider.name === "ollama") {
				this.log(`${entity.identity.name}: "${raw}" → ${action}`);
			}
		}).catch((err) => {
			this.inflight.delete(entity.id);
			// Fallback to deterministic on error
			this.pendingDecisions.set(entity.id, {
				action: Math.random() < 0.5 ? "seek" : "wander",
				reasoning: `error: ${err}`,
			});
		});
	}

	consumeDecision(entityId: string): DecisionResponse | null {
		const decision = this.pendingDecisions.get(entityId);
		if (decision) {
			this.pendingDecisions.delete(entityId);
		}
		return decision ?? null;
	}

	reset(): void {
		this.pendingDecisions.clear();
		this.inflight.clear();
		this.lastDecisionTick.clear();
		this.eventLog.clear();
		this._debugLog = [];
	}

	private parseIdleAction(raw: string): IdleAction {
		// Extract first valid action word from response
		const cleaned = raw.replace(/[^a-z\s]/g, "").trim();
		const words = cleaned.split(/\s+/);
		for (const word of words) {
			if (VALID_IDLE_ACTIONS.has(word)) return word as IdleAction;
		}
		// Default fallback
		return "wander";
	}

	private buildEntityContext(entity: VillageEntity): EntityContext {
		return {
			name: entity.identity.name,
			phase: entity.lifecycle.phase,
			role: entity.identity.role,
			personality: { ...entity.personality },
			knownSequenceCount: entity.knowledge.knownSequences.size,
			propType: entity.prop.heldProp?.propType ?? null,
			effectAffinity: entity.effect.affinity,
			recentEvents: this.eventLog.getEvents(entity.id),
		};
	}

	private buildWorldContext(
		entity: VillageEntity,
		nearby: VillageEntity[],
		currentSeason: string,
		populationSize: number,
		tick: number,
	): WorldContext {
		return {
			nearbyEntities: nearby
				.filter((e) => e.id !== entity.id && e.social.state !== "passing")
				.slice(0, 5)
				.map((e) => ({
					name: e.identity.name,
					id: e.id,
					state: e.social.state,
					distance: Math.sqrt(
						(e.transform.x - entity.transform.x) ** 2 +
						(e.transform.z - entity.transform.z) ** 2,
					),
					sequenceCount: e.knowledge.knownSequences.size,
				})),
			currentSeason,
			populationSize,
			tick,
		};
	}

	private log(message: string): void {
		const timestamp = new Date().toLocaleTimeString();
		this._debugLog.push(`[${timestamp}] ${message}`);
		if (this._debugLog.length > 50) this._debugLog.shift();
	}
}
