import type { DecisionRequest } from "./village-llm-types";

/**
 * Builds concise prompts from entity/world context.
 * Prompts are kept short (~200 tokens) for fast local inference.
 */
export function buildIdlePrompt(request: DecisionRequest): string {
	const { entityContext: ctx, worldContext: world } = request;
	const p = ctx.personality;

	const nearbyList = world.nearbyEntities
		.slice(0, 5)
		.map((e) => `${e.name} (${e.state}, ${e.sequenceCount} seqs, ${e.distance.toFixed(1)}m away)`)
		.join(", ");

	const recentList = ctx.recentEvents.length > 0
		? ctx.recentEvents.slice(-3).join(". ") + "."
		: "Nothing notable recently.";

	return `You are ${ctx.name}, a ${ctx.phase} flow artist in a village of ${world.populationSize} spinners.

Personality: sociability=${p.sociability.toFixed(2)}, creativity=${p.creativity.toFixed(2)}, patience=${p.patience.toFixed(2)}, curiosity=${p.curiosity.toFixed(2)}, ego=${p.ego.toFixed(2)}
You know ${ctx.knownSequenceCount} sequences. You spin ${ctx.propType ?? "nothing"}. Style: ${ctx.effectAffinity}.

Recent: ${recentList}

Nearby: ${nearbyList || "nobody"}

Season: ${world.currentSeason}

You're idle. What do you do next?
Reply with ONE word only: seek, wander, perform, or invent.`;
}

export function buildNegotiatePrompt(request: DecisionRequest, partnerName: string): string {
	const { entityContext: ctx } = request;
	const p = ctx.personality;

	return `You are ${ctx.name}, a ${ctx.phase} flow artist. ego=${p.ego.toFixed(2)}, patience=${p.patience.toFixed(2)}, sociability=${p.sociability.toFixed(2)}.
You know ${ctx.knownSequenceCount} sequences.

You just met ${partnerName}. Do you teach them, socialize casually, or refuse to engage?
Reply with ONE word only: teach, socialize, or refuse.`;
}
