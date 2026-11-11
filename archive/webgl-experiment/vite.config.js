import { defineConfig } from 'vite';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve, sep } from 'node:path';

// Dev-only: lets src/previs.js save rendered frames into ./ai-brief/ (never part of the production build).
const previsSave = () => ({
  name: 'gss-previs-save',
  apply: 'serve',
  configureServer(server) {
    server.middlewares.use('/__save', (req, res) => {
      if (req.method !== 'POST') {
        res.statusCode = 405;
        return res.end();
      }
      const rel = new URL(req.url, 'http://local').searchParams.get('path') || '';
      const root = resolve('ai-brief');
      const target = resolve(root, rel);
      if (!target.startsWith(root + sep) || !/\.(png|jpg|webp)$/i.test(target)) {
        res.statusCode = 400;
        return res.end('bad path');
      }
      const chunks = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', () => {
        let buf = Buffer.concat(chunks);
        if (buf.toString('utf8', 0, 11) === 'data:image/') buf = Buffer.from(buf.toString('utf8').split(',')[1], 'base64');
        mkdirSync(dirname(target), { recursive: true });
        writeFileSync(target, buf);
        res.end('ok');
      });
    });
  },
});

export default defineConfig({ plugins: [previsSave()] });
