#!/usr/bin/env node
// Builds the website: copies docs/ and generates a heatmap gallery of popular repos.
//
//   node scripts/build-site.mjs [--out _site] [--only owner/name,...] [--work <dir>]
//
// Requires `npm run build` first. Repos are shallow-cloned, so this needs network and git.
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { scan } from '../dist/index.js';
import { renderHtml } from '../dist/report/html.js';

const { values } = parseArgs({
  options: {
    out: { type: 'string', default: '_site' },
    only: { type: 'string' },
    work: { type: 'string', default: join(tmpdir(), 'repoheat-gallery') },
  },
});

const root = resolve(import.meta.dirname, '..');
const out = resolve(values.out);
const work = resolve(values.work);
const SINCE = '12 months ago';
// Clone a little further back than we analyse, so the shallow boundary commit
// (which looks like it adds every file) falls outside the window.
const CLONE_SINCE = '14 months ago';

let entries = JSON.parse(readFileSync(join(root, 'scripts/gallery.json'), 'utf8'));
if (values.only) {
  const only = new Set(values.only.split(','));
  entries = entries.filter((e) => only.has(e.repo));
}

rmSync(out, { recursive: true, force: true });
cpSync(join(root, 'docs'), out, { recursive: true });
mkdirSync(join(out, 'gallery'), { recursive: true });
mkdirSync(work, { recursive: true });

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const pct = (n) => `${Math.round(n * 100)}%`;
const slug = (repo) => repo.replace('/', '-').toLowerCase();

function clone(repo) {
  const dir = join(work, slug(repo));
  if (existsSync(join(dir, '.git'))) {
    execFileSync('git', ['-C', dir, 'fetch', '-q', `--shallow-since=${CLONE_SINCE}`, 'origin'], { stdio: 'inherit' });
    execFileSync('git', ['-C', dir, 'reset', '-q', '--hard', 'FETCH_HEAD'], { stdio: 'inherit' });
  } else {
    execFileSync(
      'git',
      ['clone', '-q', '--single-branch', '--no-tags', `--shallow-since=${CLONE_SINCE}`, `https://github.com/${repo}.git`, dir],
      { stdio: 'inherit' },
    );
  }
  return dir;
}

const cards = [];
for (const entry of entries) {
  const started = Date.now();
  try {
    const dir = clone(entry.repo);
    const report = scan({ cwd: dir, since: SINCE, exclude: entry.exclude, anonymize: true });
    report.repo.name = entry.repo;
    const file = `${slug(entry.repo)}.html`;
    writeFileSync(join(out, 'gallery', file), renderHtml(report));
    if (entry.repo === 'vitejs/vite') writeFileSync(join(out, 'demo.html'), renderHtml(report));
    cards.push({ entry, report, file });
    console.log(`✓ ${entry.repo}: ${report.totals.commits} commits, ${report.totals.files} files (${((Date.now() - started) / 1000).toFixed(1)}s)`);
  } catch (err) {
    // One broken repo must not take the whole site down.
    console.error(`✗ ${entry.repo}: ${err.message}`);
  }
}

const heat = (score) =>
  score >= 80 ? '#dc2626' : score >= 60 ? '#ea580c' : score >= 40 ? '#f59e0b' : score >= 20 ? '#2b3b57' : '#1c2638';

const cardHtml = ({ entry, report, file }) => {
  const top = report.files.filter((f) => f.score > 0 && f.commits >= 2);
  const hottest = top[0];
  const c = report.concentration;
  const strip = top
    .slice(0, 24)
    .map((f) => `<i style="background:${heat(f.score)};flex:${Math.max(1, Math.sqrt(f.loc))}" title="${esc(f.path)} · ${f.score}"></i>`)
    .join('');
  return `<a class="card" href="${file}">
  <div class="top"><b>${esc(entry.repo)}</b><span class="lang">${esc(entry.language)}</span></div>
  <div class="strip">${strip}</div>
  <div class="head">Half of all changes land in <em>${c.locShare < 0.01 ? '&lt;1%' : pct(c.locShare)}</em> of the code</div>
  ${hottest ? `<div class="hot"><span>Hottest</span><code>${esc(hottest.path)}</code><b>${hottest.score}</b></div>` : ''}
  <div class="meta">${report.totals.commits.toLocaleString('en-US')} commits · ${report.totals.authors.toLocaleString('en-US')} authors · bus factor ${report.busFactor ?? 'shared'} · ${pct(report.totals.commits ? report.totals.bugfixCommits / report.totals.commits : 0)} fixes</div>
  <div class="open">Open heatmap →</div>
</a>`;
};

const updated = new Date().toISOString().slice(0, 10);
writeFileSync(
  join(out, 'gallery', 'index.html'),
  `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Hotspot gallery · repoheat</title>
<meta name="description" content="Where do the bugs live in React, Django, Rails, Vue and more? Hotspot heatmaps of popular open-source projects, updated every week.">
<meta property="og:title" content="Where the bugs live in popular open-source projects">
<meta property="og:description" content="Hotspot heatmaps of React, Django, Rails, Vue and more, updated weekly by repoheat.">
<meta property="og:image" content="https://ebxc-7s13.github.io/repoheat/assets/social-preview.png">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="../assets/logo.svg">
<link rel="manifest" href="../manifest.webmanifest">
<meta name="theme-color" content="#0b0f17">
<style>
:root { --bg:#0b0f17; --panel:#121826; --line:#263043; --text:#e6eaf2; --muted:#8b95a8; --accent:#f97316; color-scheme: dark; }
* { box-sizing: border-box; }
body { margin:0; background:var(--bg); color:var(--text); font:15px/1.5 ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
.wrap { max-width:1180px; margin:0 auto; padding:0 16px 60px; }
nav { display:flex; align-items:center; gap:10px; padding:20px 0; font-weight:700; }
nav a { color:var(--text); text-decoration:none; display:flex; align-items:center; gap:10px; }
nav img { width:28px; height:28px; }
nav .sp { flex:1; }
nav .gh { border:1px solid var(--line); padding:6px 12px; border-radius:9px; background:var(--panel); font-weight:600; }
h1 { font-size:clamp(30px,5vw,46px); letter-spacing:-.03em; line-height:1.1; margin:30px 0 10px; }
h1 em { font-style:normal; color:var(--accent); }
.lead { color:var(--muted); font-size:18px; margin:0 0 30px; max-width:720px; }
.grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(320px, 1fr)); gap:14px; }
.card { display:flex; flex-direction:column; gap:10px; background:var(--panel); border:1px solid var(--line); border-radius:14px; padding:18px; color:var(--text); text-decoration:none; transition: border-color .15s, transform .15s; }
.card:hover { border-color:var(--accent); transform: translateY(-2px); }
.top { display:flex; align-items:center; gap:8px; }
.top b { font-size:17px; flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; }
.lang { font-size:12px; color:var(--muted); border:1px solid var(--line); border-radius:99px; padding:1px 8px; }
.strip { display:flex; gap:2px; height:34px; border-radius:6px; overflow:hidden; }
.strip i { display:block; min-width:3px; }
.head { font-weight:650; }
.head em { font-style:normal; color:var(--accent); }
.hot { display:flex; gap:8px; align-items:baseline; font-size:13px; min-width:0; }
.hot span { color:var(--muted); }
.hot code { flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; direction:rtl; text-align:left; font-family: ui-monospace, "Cascadia Code", Menlo, Consolas, monospace; }
.hot b { color:#f97316; }
.meta { color:var(--muted); font-size:13px; }
.open { color:var(--accent); font-weight:650; font-size:14px; margin-top:auto; }
.cta { margin-top:40px; background:var(--panel); border:1px solid var(--line); border-radius:14px; padding:22px; display:flex; gap:16px; align-items:center; flex-wrap:wrap; }
.cta code { font:600 18px ui-monospace, "Cascadia Code", Menlo, Consolas, monospace; background:var(--bg); border:1px solid var(--line); border-radius:10px; padding:10px 16px; }
.cta p { margin:0; flex:1; min-width:240px; color:var(--muted); }
.cta p b { color:var(--text); }
footer { color:var(--muted); font-size:13px; margin-top:30px; }
footer a { color:var(--accent); }
</style>
</head>
<body>
<div class="wrap">
<nav><a href="../"><img src="../assets/logo.svg" alt="">repoheat</a><span class="sp"></span><a class="gh" href="https://github.com/ebxc-7s13/repoheat">★ Star on GitHub</a></nav>
<h1>Where do the bugs live in <em>popular open source</em>?</h1>
<p class="lead">Hotspot heatmaps of well-known projects: complex files that keep changing, over the last 12 months. Updated every week. Click a project to explore its map.</p>
<div class="grid">
${cards.map(cardHtml).join('\n')}
</div>
<div class="cta"><p><b>See your own codebase like this.</b> Runs locally in seconds, any language, nothing is uploaded.</p><code>npx repoheat</code></div>
<footer>Updated ${updated}. Author names are anonymized. Want a project added? <a href="https://github.com/ebxc-7s13/repoheat/edit/main/scripts/gallery.json">Edit gallery.json</a> and open a pull request.</footer>
</div>
</body>
</html>
`,
);

console.log(`\nSite written to ${out} (${cards.length}/${entries.length} gallery repos)`);
if (cards.length === 0 && entries.length > 0) process.exitCode = 1;
