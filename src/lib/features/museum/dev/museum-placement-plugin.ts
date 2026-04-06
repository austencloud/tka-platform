import { writeFileSync } from 'fs';
import { resolve } from 'path';
import type { Plugin } from 'vite';

const PLACEMENTS_PATH = 'src/lib/features/museum/data/museum-manual-placements.ts';

export function museumPlacementPlugin(): Plugin {
  return {
    name: 'museum-placement-writer',
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
            const { content } = JSON.parse(body);
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
