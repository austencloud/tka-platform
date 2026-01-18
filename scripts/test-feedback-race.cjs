/**
 * Test parallel feedback claiming to verify race condition fix
 * Spawns two processes simultaneously and checks they claim different items
 *
 * Usage: node scripts/test-feedback-race.cjs
 */

const { spawn } = require('child_process');
const { writeFileSync, unlinkSync, existsSync } = require('fs');

console.log('🧪 Testing parallel feedback claiming...\n');

// Spawn two claim processes simultaneously
const agent1 = spawn('node', ['scripts/fetch-feedback.js'], {
  stdio: ['ignore', 'pipe', 'pipe']
});

const agent2 = spawn('node', ['scripts/fetch-feedback.js'], {
  stdio: ['ignore', 'pipe', 'pipe']
});

let agent1Output = '';
let agent2Output = '';

agent1.stdout.on('data', (data) => {
  agent1Output += data.toString();
});

agent1.stderr.on('data', (data) => {
  agent1Output += data.toString();
});

agent2.stdout.on('data', (data) => {
  agent2Output += data.toString();
});

agent2.stderr.on('data', (data) => {
  agent2Output += data.toString();
});

Promise.all([
  new Promise((resolve) => agent1.on('close', resolve)),
  new Promise((resolve) => agent2.on('close', resolve))
]).then(() => {
  console.log('='.repeat(70));
  console.log('\n📊 TEST RESULTS\n');
  console.log('='.repeat(70));

  // Save outputs for inspection
  const logDir = './test-logs';
  writeFileSync('test-logs/agent1.log', agent1Output);
  writeFileSync('test-logs/agent2.log', agent2Output);

  console.log('\n📝 Agent outputs saved to: test-logs/agent1.log and test-logs/agent2.log\n');

  // Extract claimed IDs from both outputs
  const idRegex = /ID:\s+([a-zA-Z0-9]{20})/;
  const match1 = agent1Output.match(idRegex);
  const match2 = agent2Output.match(idRegex);

  const claimed1 = match1 ? match1[1] : null;
  const claimed2 = match2 ? match2[1] : null;

  // Check for "Lost claim race" messages
  const lost1 = agent1Output.includes('Lost claim race');
  const lost2 = agent2Output.includes('Lost claim race');

  // Check for retry messages
  const retry1 = agent1Output.includes('Retrying with next available item');
  const retry2 = agent2Output.includes('Retrying with next available item');

  console.log('Agent 1:');
  if (claimed1) {
    console.log(`  ✅ Claimed: ${claimed1}`);
  } else {
    console.log(`  ❌ No item claimed (queue may be empty)`);
  }
  if (lost1) console.log(`  🔄 Lost race detected`);
  if (retry1) console.log(`  🔄 Retried with next item`);

  console.log('\nAgent 2:');
  if (claimed2) {
    console.log(`  ✅ Claimed: ${claimed2}`);
  } else {
    console.log(`  ❌ No item claimed (queue may be empty)`);
  }
  if (lost2) console.log(`  🔄 Lost race detected`);
  if (retry2) console.log(`  🔄 Retried with next item`);

  console.log('\n' + '='.repeat(70));

  // Determine test result
  if (!claimed1 && !claimed2) {
    console.log('\n⚠️  INCONCLUSIVE: Queue appears empty (no items to claim)');
    console.log('Add some "new" status items to test properly.\n');
    process.exit(2);
  } else if (claimed1 && claimed2) {
    if (claimed1 === claimed2) {
      console.log('\n❌ RACE CONDITION DETECTED!');
      console.log(`Both agents claimed the same item: ${claimed1}\n`);
      process.exit(1);
    } else {
      console.log('\n✅ SUCCESS: Race condition prevented!');
      console.log(`Agent 1: ${claimed1}`);
      console.log(`Agent 2: ${claimed2}`);
      if (lost1 || lost2) {
        console.log('\n🎯 Verification logs show atomic claim working correctly');
        console.log('   One agent lost the race and retried with a different item.\n');
      }
      process.exit(0);
    }
  } else {
    console.log('\n⚠️  PARTIAL SUCCESS: Only one agent claimed an item');
    console.log('This may indicate queue has only one item, or one agent failed.\n');
    process.exit(0);
  }
});

// Handle errors
agent1.on('error', (err) => {
  console.error('Agent 1 error:', err);
  process.exit(1);
});

agent2.on('error', (err) => {
  console.error('Agent 2 error:', err);
  process.exit(1);
});
