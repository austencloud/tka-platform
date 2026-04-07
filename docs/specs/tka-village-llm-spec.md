# TKA Village: LLM-Driven Entity Decisions

> **Scope:** Replace 5 probability rolls in SocialSystem with genuine character decisions via local LLM. Everything mechanical stays deterministic. The LLM only handles the *why*, not the *how*.

---

## Architecture

The LLM doesn't replace the simulation. It replaces exactly 5 decision points in SocialSystem:

1. **Idle decision:** What to do when idle — wander, seek, perform, invent?
2. **Partner selection:** Who to approach when seeking?
3. **Teaching negotiation:** When approaching a partner — teach, learn, socialize, or refuse?
4. **Gift decision:** Whether to spontaneously gift a sequence during socializing?
5. **Performance duration:** How long to perform before stopping?

Everything mechanical stays deterministic: decay ticks, teaching proficiency increments, movement interpolation, lifecycle aging.

### Async Pattern

LLM calls are fire-and-forget. The entity keeps doing whatever they're doing while inference runs. When the response comes back (200-800ms), it's applied at the next tick. If the model is slow, the entity just lingers — looks like contemplation.

```
Entity enters "idle" state
  → SocialSystem checks: LLM enabled?
    → YES: fire async inference, entity stays "idle" until response
    → NO: existing probability rolls (deterministic fallback)
  → Response arrives: apply decision (seek, wander, perform, etc.)
```

### Three Inference Providers

1. **Ollama local** (free, ~200-500ms latency) — qwen3:8b or llama3.1:8b
2. **Helix agents** (routes to best available model) — via MCP
3. **Deterministic fallback** — current probability-based system

Toggle in VillageControls panel.

---

## Decision Engine

### VillageDecisionEngine

Pure TypeScript, no Svelte. Lives in `engine/llm/`.

```typescript
interface DecisionRequest {
  entityId: string;
  decisionType: "idle" | "partner" | "negotiate" | "gift" | "performance";
  entityContext: EntityContext;
  worldContext: WorldContext;
}

interface EntityContext {
  name: string;
  phase: string;
  personality: { learnSpeed: number; sociability: number; creativity: number; patience: number; curiosity: number; ego: number };
  knownSequenceCount: number;
  propType: string | null;
  effectAffinity: string;
  recentInteractions: string[]; // last 5 events involving this entity
}

interface WorldContext {
  nearbyEntities: { name: string; state: string; distance: number }[];
  currentSeason: string;
  populationSize: number;
  tick: number;
}

interface DecisionResponse {
  action: string;        // "seek" | "wander" | "perform" | "invent" | "teach" | "refuse" | "gift" | etc.
  targetEntityId?: string;
  reasoning?: string;    // for debug log
}
```

### Prompt Template

```
You are {name}, a {phase} flow arts practitioner in a village of spinners.

Personality: sociability={sociability}, creativity={creativity}, patience={patience}, curiosity={curiosity}, ego={ego}
You know {knownSequenceCount} sequences. You spin {propType}. Your effect style is {effectAffinity}.

Recent events: {recentInteractions}

Nearby: {nearbyEntities}

Season: {currentSeason}

You are currently idle. What do you do?
Options: seek (find someone to teach/learn), wander (explore), perform (show off a sequence), invent (try creating something new)

Respond with ONLY the action word. No explanation.
```

### Event Log

Each entity tracks last 10 events for prompt context:

```typescript
interface VillageEventLog {
  entityLogs: Map<string, string[]>; // entityId → last 10 event descriptions
  addEvent(entityId: string, description: string): void;
}
```

Events logged: "Taught Reed a sequence", "Learned from Ember", "Watched Flint perform", "Soot's prop broke", "Reed died nearby"

---

## Inference Providers

### OllamaProvider

Direct HTTP to localhost:11434.

```typescript
class OllamaProvider {
  private model = "qwen3:8b";

  async infer(prompt: string): Promise<string> {
    const response = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.model,
        prompt,
        stream: false,
        options: { temperature: 0.7, num_predict: 20 },
      }),
    });
    const data = await response.json();
    return data.response.trim().toLowerCase();
  }
}
```

### DeterministicProvider

Wraps the existing probability rolls in the same interface. Always available as fallback.

### HelixProvider

Uses the helix-agents MCP `think` tool for single-shot inference.

---

## Integration Points in SocialSystem

### 1. handleIdle — replace roll with LLM decision

Current:
```typescript
const roll = Math.random();
if (roll < inventionChance) entity.social.state = "inventing";
else if (roll < 0.2) entity.social.state = "performing";
else if (roll < 0.6 + sociability) entity.social.state = "seeking";
else this.startWandering(entity);
```

LLM-enabled:
```typescript
if (this.decisionEngine?.isEnabled()) {
  this.decisionEngine.requestDecision({
    entityId: entity.id,
    decisionType: "idle",
    entityContext: this.buildEntityContext(entity),
    worldContext: this.buildWorldContext(entity, world),
  }).then(response => {
    this.pendingDecisions.set(entity.id, response);
  });
  return; // entity stays idle until response arrives
}
// ... existing probability rolls as fallback
```

At tick start, apply pending decisions:
```typescript
for (const [entityId, decision] of this.pendingDecisions) {
  const entity = world.entities.find(e => e.id === entityId);
  if (!entity || entity.social.state !== "idle") continue;
  this.applyDecision(entity, decision, world);
  this.pendingDecisions.delete(entityId);
}
```

---

## Files

| File | Action |
|------|--------|
| `engine/llm/VillageDecisionEngine.ts` | CREATE: orchestrates decision requests |
| `engine/llm/OllamaProvider.ts` | CREATE: direct Ollama HTTP inference |
| `engine/llm/DeterministicProvider.ts` | CREATE: wraps existing probability rolls |
| `engine/llm/VillageEventLog.ts` | CREATE: per-entity event history |
| `engine/llm/village-llm-types.ts` | CREATE: interfaces |
| `engine/llm/prompt-builder.ts` | CREATE: builds prompts from entity/world context |
| `engine/systems/SocialSystem.ts` | MODIFY: wire decision engine into handleIdle |
| `engine/VillageOrchestrator.ts` | MODIFY: create and wire decision engine |
| `components/VillageControls.svelte` | MODIFY: LLM toggle, provider selector, debug log |
| `VillageLabTab.svelte` | MODIFY: wire events to event log |

---

## Success Metric

Deterministic village feels like an aquarium. LLM village feels like a soap opera. Both produce valid cultural evolution. The difference is whether you care about the characters.
