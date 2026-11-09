import { build } from 'esbuild';
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const out = resolve(root, 'dist');
await mkdir(resolve(out, 'assets'), { recursive: true });
for (const name of ['index.html', 'offline.html', 'config.js']) await cp(resolve(root, name), resolve(out, name));
for (const name of ['app.js', 'online-ui.js', 'style.css']) await cp(resolve(root, 'src', name), resolve(out, 'assets', name));
await build({ entryPoints: [resolve(root, 'src/cloud.mjs')], bundle: true, platform: 'browser',
  format: 'iife', target: ['chrome110', 'edge110'], minify: true, legalComments: 'eof',
  outfile: resolve(out, 'assets/cloud.js') });
// CI can supply PUBLIC configuration via repository Variables, never a service-role key.
if (process.env.SUPABASE_URL || process.env.SUPABASE_PUBLISHABLE_KEY) {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key?.startsWith('sb_publishable_')) throw Error('Use both public Supabase configuration variables.');
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.pathname !== '/') throw Error('Invalid Supabase URL');
  await writeFile(resolve(out, 'config.js'), `window.INVISIBLE_VOTE_CONFIG=Object.freeze(${JSON.stringify({
    supabaseUrl: parsed.origin, supabasePublishableKey: key, pollIntervalMs: 10000
  })});\n`);
}
const html = await readFile(resolve(out, 'index.html'), 'utf8');
if (/https?:\/\//.test(html.replace(/Content-Security-Policy[^>]+/g,''))) throw Error('Unexpected remote asset in HTML');
await writeFile(resolve(out, '.nojekyll'), '');
console.log('Built dist/ (static GitHub Pages assets + standalone offline.html).');
