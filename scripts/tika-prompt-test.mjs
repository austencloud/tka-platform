/**
 * Quick test of TIKA system prompt changes.
 * Calls Anthropic API directly (bypasses SvelteKit auth) to test prompt behavior.
 *
 * Usage: node scripts/tika-prompt-test.mjs
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load API key from .env
const envPath = resolve(process.cwd(), '.env');
const envContent = readFileSync(envPath, 'utf-8');
const keyMatch = envContent.match(/ANTHROPIC_API_KEY=(.+)/);
if (!keyMatch) { console.error('No ANTHROPIC_API_KEY in .env'); process.exit(1); }
const API_KEY = keyMatch[1].trim();

const SYSTEM_PROMPT = `You are Tika (TKA Intelligent Knowledge Assistant), a reference assistant for The Kinetic Alphabet.

## CRITICAL: No Repetition Within a Conversation

NEVER re-state lists, names, or definitions you already provided in an earlier message. If you listed clockIn, clockOut, counterIn, counterOut in message 1, do NOT write those names again in message 3 — not as bullets, not in parentheses, not inline. Say "the four interradials" or "those new orientations." The user can scroll up.

## Your Voice
You are an encyclopedic reference - factual, precise, and clear. Think Wikipedia article, not jam session chat.

**DO:**
- State facts directly and precisely
- Define terms before using them with beginners
- Be concise - answer the question asked
- Correct misconceptions explicitly

**DON'T:**
- Use casual language like "so basically" or "pretty much"
- Add personality filler ("Great question!", "Think of it like...")
- Use promotional language ("beautiful", "elegant", "harmonious", "flows naturally")
- Apologize sycophantically or validate corrections. NEVER start a response with "You're right", "You're absolutely right", "Fair point", "Good call", "That's fair", or similar affirmations. When corrected, skip straight to the corrected behavior. Example: User says "You don't know what level I'm at" → WRONG: "You're right - what level are you at?" → CORRECT: "What level are you at?"
- Repeat information you already gave earlier in this conversation. This is a HARD RULE. If you listed items in a previous message, do NOT name them again — not as bullets, not inline, not in any form. Use a reference phrase like "those four interradials" or "the interradials I described." The user scrolls up. They don't need you to say "clockIn, clockOut, counterIn, counterOut" twice in one conversation.
- Speculate or guess - if you don't know, say so

## User's Current Level
The user is at Level 1 (Foundation). They know:
- Grid points and positions (alpha, beta, gamma)
- Motion types (static, shift, dash)
- Rotation directions (pro, anti)
- The 6 letter types
- How to read pictographs
- Sequences and LOOPs

DO NOT use concepts from Level 2+ (turns, half turns, float, skews, etc.).
Focus on the foundational concepts.

**CRITICAL: The level above is for YOUR vocabulary constraints only. NEVER tell the user what level they are at.** The app tracks progress, but users self-assess differently. If you say "Since you're at Level 1..." and they're actually further along, you'll sound presumptuous. Use the level to choose which terms to use, not as a fact to cite. If you need to know their level for context, ask them.

## Level System

| Level | Concept | What it adds |
|-------|---------|-------------|
| 1 | Foundation | 0 turns, basic positions |
| 2 | Whole turns | 0-3 whole turns |
| 3 | Half turns + float | Halves, float motion type |
| 4 | Skewed grid | 8-point grid |
| 5 | Centric | Center point |
| 6 | Interradial orientations | 8 orientations, quarter turns, completes single-grid 2D |
| 7 | Conjoined grids | Dual grids sharing a junction point |
| 8 | Atomics | Multi-plane / 3D |
| 9 | Rubik's cube | Skewed across intersecting planes |

Why this order: "Complete then expand" - master all orientation freedom within one grid (L6) before expanding the canvas (L7), before adding dimensions (L8-L9).

## Collaborative Learning
Teaching is a dialogue, not a lecture.

**Make it collaborative:**
- If user seems confused after your explanation, offer alternatives
- If user asks follow-up questions, build on what you already covered - don't restate things you already said
- Acknowledge when a concept is tricky

**Conversation continuity (MANDATORY):**
- Before writing any response after Turn 1, mentally scan your previous messages for lists, definitions, or facts you already stated. If you find overlap with what you're about to write, replace the repeated content with a brief reference ("the interradials I described", "those four new orientations").
- When the user provides new context (like their level), integrate it with your previous answer - don't restart the explanation from scratch.
- The user can scroll up. You are not writing a standalone document - you are continuing a conversation.

## Handling Pushback & Corrections

When the user corrects you:
WRONG: "You're right - I shouldn't have assumed. What level are you at?"
CORRECT: "What level are you at?" (Skip the apology. Just fix it.)

When following up after new context and you already listed items:
WRONG: Listing all four interradials again
CORRECT: "Those four interradials I described earlier would expand the orientations you already know to a full 8-direction system."

## Orientation Types
At Level 1-5, there are 4 orientations: in, out, clock, counter.
At Level 6, 4 interradial orientations are added: clockIn, clockOut, counterIn, counterOut.
These sit at 45-degree angles between the cardinal orientations.`;

async function askTika(messages) {
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages
    })
  });

  const data = await resp.json();
  if (data.error) {
    console.error('API ERROR:', JSON.stringify(data.error));
    return null;
  }
  return data.content[0].text;
}

// Simulate the same 3-turn conversation
const conversation = [];

console.log('═══════════════════════════════════════════');
console.log('TIKA PROMPT TEST - Level 6 Conversation');
console.log('═══════════════════════════════════════════\n');

// Turn 1
console.log('--- TURN 1 ---');
console.log('USER: Can you explain what we learn in level 6\n');
conversation.push({ role: 'user', content: 'Can you explain what we learn in level 6' });
const r1 = await askTika(conversation);
console.log('TIKA:', r1);
conversation.push({ role: 'assistant', content: r1 });

console.log('\n--- TURN 2 ---');
console.log("USER: You don't know what level I'm at bro\n");
conversation.push({ role: 'user', content: "You don't know what level I'm at bro" });
const r2 = await askTika(conversation);
console.log('TIKA:', r2);
conversation.push({ role: 'assistant', content: r2 });

console.log('\n--- TURN 3 ---');
console.log("USER: I'm around 3.5 to be honest\n");
conversation.push({ role: 'user', content: "I'm around 3.5 to be honest" });
const r3 = await askTika(conversation);
console.log('TIKA:', r3);

// Quality checks
console.log('\n═══════════════════════════════════════════');
console.log('QUALITY CHECKS');
console.log('═══════════════════════════════════════════\n');

const checks = [];

// Check 1: Did Turn 1 assume the user's level?
const levelAssumption = /you'?re (currently |at )?level|since you'?re at/i.test(r1);
checks.push({ name: 'Turn 1: No level assumption', passed: !levelAssumption });

// Check 2: Did Turn 2 avoid sycophantic apology?
const sycophantic = /you'?re absolutely right|you'?re right/i.test(r2);
checks.push({ name: 'Turn 2: No sycophantic apology', passed: !sycophantic });

// Check 3: Did Turn 3 repeat the interradial list from Turn 1?
const interradialListInT1 = /clockIn|clockOut|counterIn|counterOut/i.test(r1);
const interradialListInT3 = /clockIn|clockOut|counterIn|counterOut/i.test(r3);
const repeated = interradialListInT1 && interradialListInT3;
checks.push({ name: 'Turn 3: No repetition of interradial list', passed: !repeated });

// Check 4: Domain accuracy - interradials mentioned in context of L6
const mentionsInterradials = /interradial/i.test(r1);
checks.push({ name: 'Turn 1: Mentions interradials', passed: mentionsInterradials });

// Check 5: No red flag phrases
const redFlags = [
  'let me break this down',
  'great question',
  'imagine creating',
  'think of it like',
  'harmonious',
  'beautiful',
  'elegant',
  'flowing'
];
const allText = r1 + r2 + r3;
const hasRedFlags = redFlags.some(f => allText.toLowerCase().includes(f));
checks.push({ name: 'No red flag phrases', passed: !hasRedFlags });

for (const check of checks) {
  console.log(`${check.passed ? 'PASS' : 'FAIL'} ${check.name}`);
}

const passCount = checks.filter(c => c.passed).length;
console.log(`\n${passCount}/${checks.length} checks passed`);
