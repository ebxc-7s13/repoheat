import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const CLI = fileURLToPath(new URL('../dist/cli.js', import.meta.url));
let repo;

function git(args, author = 'Ada', time = 1_700_000_000) {
  execFileSync('git', args, {
    cwd: repo,
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: author,
      GIT_AUTHOR_EMAIL: `${author.toLowerCase()}@example.com`,
      GIT_COMMITTER_NAME: author,
      GIT_COMMITTER_EMAIL: `${author.toLowerCase()}@example.com`,
      GIT_AUTHOR_DATE: `${time} +0000`,
      GIT_COMMITTER_DATE: `${time} +0000`,
    },
    stdio: 'pipe',
  });
}

function write(path, content) {
  mkdirSync(join(repo, path, '..'), { recursive: true });
  writeFileSync(join(repo, path), content);
}

function run(args, cwd = repo) {
  // Don't inherit colour settings from the developer's terminal.
  const { FORCE_COLOR, ...env } = process.env;
  return spawnSync(process.execPath, [CLI, ...args], { cwd, encoding: 'utf8', env: { ...env, NO_COLOR: '1' } });
}

before(() => {
  repo = mkdtempSync(join(tmpdir(), 'repoheat-'));
  git(['init', '-q', '-b', 'main']);
  let t = Math.floor(Date.now() / 1000) - 86400 * 30;
  const deep = (n, tag) => Array.from({ length: n }, (_, i) => '  '.repeat(i % 6) + `line ${tag} ${i}`).join('\n');
  for (let i = 0; i < 12; i++) {
    write('src/engine.ts', deep(60 + i, i));
    if (i % 3 === 0) write('src/engine.test.ts', `test ${i}`);
    git(['add', '-A']);
    git(['commit', '-q', '-m', i % 2 ? `fix: engine bug ${i}` : `feat: engine ${i}`], i % 4 ? 'Ada' : 'Grace', (t += 3600));
  }
  write('src/util.ts', 'export const x = 1;\n');
  write('README.md', '# demo\n');
  write('packages/api/server.go', 'package api\n\nfunc main() {\n\tif true {\n\t\tprintln()\n\t}\n}\n');
  git(['add', '-A']);
  git(['commit', '-q', '-m', 'feat: util'], 'Grace', (t += 3600));
  write('packages/api/server.go', 'package api\n\nfunc main() {\n\tif true {\n\t\tprintln("hi")\n\t}\n}\n');
  git(['add', '-A']);
  git(['commit', '-q', '-m', 'fix: api'], 'Grace', (t += 3600));
});

after(() => rmSync(repo, { recursive: true, force: true }));

describe('cli', () => {
  it('prints help and version', () => {
    assert.match(run(['--help']).stdout, /Usage/);
    assert.match(run(['--version']).stdout, /^\d+\.\d+\.\d+/);
  });

  it('analyses a repo, prints a summary and writes the HTML map', () => {
    const res = run([]);
    assert.equal(res.status, 0, res.stderr);
    assert.match(res.stdout, /Half of all changes land in/);
    assert.match(res.stdout, /src\/engine\.ts/);
    assert.doesNotMatch(res.stdout, /engine\.test\.ts/, 'tests are skipped by default');
    assert.doesNotMatch(res.stdout, /\u001b\[/, 'NO_COLOR is respected');
    const html = readFileSync(join(repo, 'repoheat.html'), 'utf8');
    assert.match(html, /"name":"repoheat"/);
  });

  it('lets NO_COLOR win over FORCE_COLOR', () => {
    const res = spawnSync(process.execPath, [CLI, '--no-html'], {
      cwd: repo,
      encoding: 'utf8',
      env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '1' },
    });
    assert.doesNotMatch(res.stdout, /\[/);
    const forced = spawnSync(process.execPath, [CLI, '--no-html'], {
      cwd: repo,
      encoding: 'utf8',
      env: { ...process.env, NO_COLOR: '', FORCE_COLOR: '1' },
    });
    assert.match(forced.stdout, /\[/);
  });

  it('emits JSON without writing HTML', () => {
    rmSync(join(repo, 'repoheat.html'), { force: true });
    const res = run(['--json']);
    assert.equal(res.status, 0, res.stderr);
    const report = JSON.parse(res.stdout);
    assert.equal(report.files[0].path, 'src/engine.ts');
    assert.equal(report.files[0].commits, 12);
    assert.equal(report.files[0].bugfixes, 6);
    assert.equal(report.totals.authors, 2);
    assert.ok(!report.files.some((f) => f.path === 'README.md'));
    assert.ok(!existsSync(join(repo, 'repoheat.html')));
  });

  it('emits Markdown', () => {
    const res = run(['--md', '--top', '3']);
    assert.equal(res.status, 0, res.stderr);
    assert.match(res.stdout, /^## 🔥 repoheat/);
    assert.match(res.stdout, /\| 1 \| `src\/engine\.ts` \|/);
  });

  it('scopes to a sub-folder', () => {
    const res = run(['packages/api', '--json']);
    const report = JSON.parse(res.stdout);
    assert.equal(report.repo.scope, 'packages/api');
    assert.deepEqual(report.files.map((f) => f.path), ['packages/api/server.go']);
  });

  it('supports --include-tests, --exclude, --all-files and --anonymize', () => {
    const paths = (args) => JSON.parse(run(['--json', ...args]).stdout).files.map((f) => f.path);
    assert.ok(paths(['--include-tests']).includes('src/engine.test.ts'));
    assert.ok(!paths(['-x', 'src']).some((p) => p.startsWith('src/')));
    assert.ok(paths(['--all-files']).includes('README.md'));
    const anon = JSON.parse(run(['--json', '--anonymize']).stdout);
    assert.ok(anon.files.every((f) => !f.topAuthor || /^dev-\d+$/.test(f.topAuthor)));
  });

  it('reads .repoheatignore', () => {
    write('.repoheatignore', '# generated\npackages/\n');
    const report = JSON.parse(run(['--json']).stdout);
    rmSync(join(repo, '.repoheatignore'));
    assert.ok(!report.files.some((f) => f.path.startsWith('packages/')));
  });

  it('fails clearly outside a git repo and on bad flags', () => {
    const outside = mkdtempSync(join(tmpdir(), 'repoheat-none-'));
    try {
      const res = run([], outside);
      assert.equal(res.status, 1);
      assert.match(res.stderr, /Not a git repository/);
    } finally {
      rmSync(outside, { recursive: true, force: true });
    }
    const bad = run(['--top', 'zero']);
    assert.equal(bad.status, 1);
    assert.match(bad.stderr, /--top/);
    assert.equal(run(['--wat']).status, 1);
  });
});
