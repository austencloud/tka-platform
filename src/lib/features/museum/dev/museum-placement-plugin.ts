import { writeFileSync } from 'fs';
import { resolve } from 'path';
import type { Plugin } from 'vite';

const PLACEMENTS_PATH = 'src/lib/features/museum/data/museum-manual-placements.ts';

export function museumPlacementPlugin(): Plugin {
  return {
    name: 'museum-placement-writer',
    handleHotUpdate({ file }: { file: string }) {
      if (file.includes('museum-manual-placements')) {
        // Suppress HMR - the placement was already added to the live scene
        return [];
      }
      return undefined;
    },
    configureServer(server) {
      server.middlewares.use('/__museum-placements', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end('Method not allowed');
          return;
        }

        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
          try {
            // Persister sends raw TypeScript content as text/plain,
            // or JSON { content: "..." } - handle both
            let content: string;
            try {
              const parsed = JSON.parse(body);
              content = parsed.content;
            } catch {
              content = body;
            }
            const fullPath = resolve(process.cwd(), PLACEMENTS_PATH);
            writeFileSync(fullPath, content, 'utf-8');
            res.statusCode = 200;
            res.end('OK');
          } catch (err) {
            console.error('[museum-placement-plugin] Write failed:', err);
            res.statusCode = 500;
            res.end('Write failed');
          }
        });
      });
    },
  };
}
