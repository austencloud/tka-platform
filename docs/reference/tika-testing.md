# TIKA Testing - Programmatic Interaction

## Quick Health Check (No Options Needed)
```bash
node scripts/tika/test-run.mjs
```
Sends a single test question, shows latency + tools called + response preview.

## Full Validator (Structural)
```bash
node --import tsx scripts/tika-validator.ts [options]
```
- `--category <name>` - Run specific category
- `--limit <n>` - First N scenarios
- `--stop-on <n>` - Stop after N consecutive failures
- `--dry-run` - Preview without running
- **Requires dev server on localhost:5173**

## Full Evaluator (With Opus Review)
```bash
npx tsx scripts/tika/evaluate.ts [options]
```
- `--category <letter|position|type|motion>` - Filter
- `--level <1-4>` - Difficulty filter
- `--with-opus` - Opus review of responses
- `--dry-run` - Show scenarios only
- Output: `scripts/tika/reports/`

## Manual API Call
```bash
curl -X POST http://localhost:5173/api/tika/ask \
  -H "Content-Type: application/json" \
  -d '{"question":"What is alpha?","userId":"test-user","language":"en"}'
```
Returns SSE stream. Parse `data: ` lines, JSON each.

## Key Files
- API route: `src/routes/api/tika/ask/+server.ts`
- System prompt: `src/lib/features/tika/ai/system-prompts.ts`
- Tools: `src/lib/features/tika/services/implementations/TikaToolExecutor.ts`
- Scenarios: `src/lib/features/tika/evaluation/scenarios/beginner-scenarios.ts`
- Components: `src/lib/features/tika/components/TikaConversation.svelte`

## SSE Response Format
```
data: {"type":"text-delta","textDelta":"Some text"}
data: {"type":"tool-input-available","toolName":"get_letter_explanation","input":{"letter":"A"}}
data: {"type":"tool-output-available","output":{"inlinePictograph":{"letter":"A",...}}}
data: [DONE]
```
