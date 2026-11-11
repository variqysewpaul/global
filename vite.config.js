import { defineConfig } from 'vite';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Development only: lets a page POST a picture of its 3D canvas to .snaps/ (see SecurityScene.snap in src/scene), so a render can
// be looked at without a screenshot tool or a visible browser window. Not part of the production build.
const snapshots = () => ({
  name: 'dev-snapshots',
  apply: 'serve',
  configureServer(server) {
    server.middlewares.use('/__save', (req, res) => {
      const name = (new URL(req.url, 'http://x').searchParams.get('name') || 'snap.jpg').replace(/[^\w.-]/g, '');
      const chunks = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', () => {
        mkdirSync('.snaps', { recursive: true });
        writeFileSync(resolve('.snaps', name), Buffer.concat(chunks));
        res.end('ok');
      });
    });
  },
});

export default defineConfig({
  plugins: [snapshots()],
  // The 3D scene (three.js and the studio code, ~145 kB gzipped) is its own chunk, fetched after the page's copy, and only on
  // devices that will draw it on a real graphics chip; the size warning is about the page's first load, which it is not part of.
  build: { chunkSizeWarningLimit: 700 },
});
