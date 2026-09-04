/** Opt-in inference smoke using TIKA's real prompt and read-only tools. */
import assert from "node:assert/strict";
import { createServer } from "vite";
import { streamText, stepCountIs, type ToolSet } from "ai";
import { deriveUserOverlay } from "@tka/domain";
import { TikaModelProvider } from "../../src/lib/features/tika/services/tika-model-provider";

assert(
  process.argv.includes("--live"),
  "Pass --live to run billed synthetic inference."
);
assert(process.env.ANTHROPIC_API_KEY, "ANTHROPIC_API_KEY is required");
const modelKey =
  process.argv.find((arg) => arg.startsWith("--model="))?.slice(8) ?? "haiku";
const server = await createServer({
  server: { middlewareMode: true, hmr: false, watch: null },
  appType: "custom",
  logLevel: "error",
});
try {
  const { _createTikaTools } = await server.ssrLoadModule(
    "/src/routes/api/tika/ask/+server.ts"
  );
  const { buildSystemPrompt } = await server.ssrLoadModule(
    "/src/lib/features/tika/ai/system-prompts.ts"
  );
  const registry = _createTikaTools("synthetic-no-persistence", []);
  // These tools only read local domain data. No account or progress writer is exposed.
  const tools: ToolSet = Object.fromEntries(
    [
      "get_term_definition",
      "compare_positions",
      "answer_common_question",
      "find_app_feature",
    ].map((name) => [name, registry[name]])
  );
  const provider = new TikaModelProvider(process.env.ANTHROPIC_API_KEY, "");
  const result = streamText({
    model: provider.getModel(modelKey),
    system: buildSystemPrompt(deriveUserOverlay([]), "en"),
    prompt:
      "Please use the glossary tool to define the TKA term pro. Keep the answer to two sentences.",
    tools,
    stopWhen: stepCountIs(3),
    maxOutputTokens: 512,
    maxRetries: 0,
    abortSignal: AbortSignal.timeout(30_000),
  });
  const wire = await result.toUIMessageStreamResponse().text();
  const text = await result.text;
  const steps = await result.steps;
  const toolNames = steps.flatMap((step) =>
    step.toolCalls.map((call) => call.toolName)
  );
  const lookups = steps.flatMap((step) =>
    step.toolResults.map((tool) => ({
      name: tool.toolName,
      input: tool.input,
      output: tool.output,
    }))
  );
  console.log(JSON.stringify({ lookups }));
  assert(
    toolNames.includes("get_term_definition"),
    "The glossary tool must actually be called"
  );
  assert(
    lookups.some(
      (lookup) => !JSON.stringify(lookup.output).includes("not found")
    ),
    "A domain lookup must succeed"
  );
  assert(text.trim().length > 0, "TIKA must answer after executing the tool");
  assert(
    wire.includes('"type":"text-delta"'),
    "Browser stream must contain text deltas"
  );
  assert(
    !wire.includes('"type":"error"'),
    "Browser stream must not hide a provider error"
  );
  console.log(
    JSON.stringify({
      model: modelKey,
      pass: true,
      toolNames,
      text,
      usage: await result.totalUsage,
    })
  );
} catch (cause) {
  console.log(
    JSON.stringify({
      model: modelKey,
      pass: false,
      error: cause instanceof Error ? cause.name : "UnknownError",
    })
  );
  process.exitCode = 1;
} finally {
  await server.close();
}
