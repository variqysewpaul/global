#!/usr/bin/env node
// Turn a video into a scroll-scrubbable image sequence.
//
//   node scripts/make-frames.mjs path/to/arrival.mp4 --name van --fps 30 --width 1920
//
// Writes public/frames/<name>/f0001.webp ... + manifest.json, which src/sequence.js picks up automatically.
// Needs ffmpeg on PATH (winget install Gyan.FFmpeg) or set FFMPEG=C:\path\to\ffmpeg.exe
import { spawnSync } from 'node:child_process';
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const args = process.argv.slice(2);
const input = args.find((a) => !a.startsWith('--'));
const opt = (k, d) => {
  const i = args.indexOf(`--${k}`);
  return i >= 0 ? args[i + 1] : d;
};
if (!input) {
  console.log('usage: node scripts/make-frames.mjs <video> [--name van] [--fps 30] [--width 1920] [--start 0] [--end 10] [--quality 78] [--focusX 0.5]');
  process.exit(1);
}
const name = opt('name', 'van');
const fps = Number(opt('fps', 30));
const width = Number(opt('width', 1920));
const quality = Number(opt('quality', 78));
const ffmpeg = process.env.FFMPEG || 'ffmpeg';
const ffprobe = process.env.FFPROBE || (process.env.FFMPEG ? process.env.FFMPEG.replace(/ffmpeg(\.exe)?$/i, 'ffprobe$1') : 'ffprobe');

const probe = spawnSync(ffprobe, ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0:s=x', input], { encoding: 'utf8' });
if (probe.error || probe.status !== 0) {
  console.error('Could not run ffprobe. Install ffmpeg (winget install Gyan.FFmpeg) or set FFMPEG / FFPROBE.');
  process.exit(1);
}
const [vw, vh] = probe.stdout.trim().split('x').map(Number);
const outW = Math.min(width, vw);
const outH = Math.round(((vh * outW) / vw) / 2) * 2;

const dir = resolve('public', 'frames', name);
rmSync(dir, { recursive: true, force: true });
mkdirSync(dir, { recursive: true });

const trim = [];
if (opt('start')) trim.push('-ss', opt('start'));
if (opt('end')) trim.push('-to', opt('end'));
const r = spawnSync(
  ffmpeg,
  ['-v', 'error', '-y', ...trim, '-i', input, '-vf', `fps=${fps},scale=${outW}:${outH}:flags=lanczos`, '-c:v', 'libwebp', '-quality', String(quality), '-compression_level', '4', join(dir, 'f%04d.webp')],
  { stdio: 'inherit' },
);
if (r.status !== 0) {
  console.error('ffmpeg failed.');
  process.exit(1);
}
const count = readdirSync(dir).filter((f) => f.endsWith('.webp')).length;
writeFileSync(join(dir, 'manifest.json'), JSON.stringify({ count, fps, width: outW, height: outH, ext: 'webp', pad: 4, focusX: Number(opt('focusX', 0.5)), focusY: Number(opt('focusY', 0.5)) }, null, 2));
console.log(`${count} frames at ${outW}x${outH} -> public/frames/${name}/  (~${(count / fps).toFixed(1)}s of footage)`);
