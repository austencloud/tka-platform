// Simple test to verify the evaluation framework works
import fs from 'fs';
import path from 'path';

const PROJECT_ROOT = process.cwd();

console.log('=== TIKA Evaluation Test ===');
console.log('Project root:', PROJECT_ROOT);

// Check if the scenarios file exists
const scenariosPath = path.join(
  PROJECT_ROOT,
  'src/lib/features/learn/tika/evaluation/scenarios/baseline-scenarios.ts'
);
console.log('Scenarios file exists:', fs.existsSync(scenariosPath));

// Check if knowledge graph exists
const graphPath = path.join(
  PROJECT_ROOT,
  'src/lib/features/learn/tika/knowledge/semantic-graph.ts'
);
console.log('Knowledge graph exists:', fs.existsSync(graphPath));

// Check if glossary exists
const glossaryPath = path.join(PROJECT_ROOT, 'mcp-server/data/tka-glossary.json');
console.log('Glossary exists:', fs.existsSync(glossaryPath));

if (fs.existsSync(glossaryPath)) {
  const glossary = JSON.parse(fs.readFileSync(glossaryPath, 'utf-8'));
  console.log('Glossary terms:', Object.keys(glossary).length);
}

// Check if letter types exist
const typesPath = path.join(PROJECT_ROOT, 'mcp-server/data/letter-types.json');
console.log('Letter types exists:', fs.existsSync(typesPath));

if (fs.existsSync(typesPath)) {
  const types = JSON.parse(fs.readFileSync(typesPath, 'utf-8'));
  console.log('Letter types:', Object.keys(types).length);
}

// Try to check if dev server is running
console.log('\n=== Checking Dev Server ===');
try {
  const response = await fetch('http://localhost:5173/api/tika/ask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      question: 'What is alpha?',
      userId: 'test',
      completedConcepts: ['1.1', '1.2'],
      language: 'en'
    })
  });

  if (response.ok) {
    const data = await response.json();
    console.log('Dev server: RUNNING');
    console.log('Test response latency:', data.latencyMs + 'ms');
    console.log('Tools called:', data.toolsCalled?.map(t => t.name).join(', ') || 'None');
    console.log('Response preview:', data.explanation?.slice(0, 100) + '...');
  } else {
    console.log('Dev server: ERROR -', response.status);
  }
} catch (err) {
  console.log('Dev server: NOT RUNNING or error');
  console.log('Error:', err.message);
}

console.log('\n=== Test Complete ===');
