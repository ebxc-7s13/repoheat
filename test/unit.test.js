import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  analyze,
  busFactor,
  createFilter,
  globToRegExp,
  isBot,
  isBugfix,
  isTestFile,
  languageOf,
  measure,
  parseLog,
} from '../dist/index.js';
import { truncatePath } from '../dist/report/terminal.js';
import { renderMarkdown } from '../dist/report/markdown.js';
import { renderHtml } from '../dist/report/html.js';

const commit = (author, subject, paths, time = 1_700_000_000) => ({
  hash: Math.random().toString(16).slice(2),
  author,
  time,
  subject,
  files: paths.map((path) => ({ path, added: 5, deleted: 2 })),
});

const nested = (depth) => Array.from({ length: depth }, (_, i) => '  '.repeat(i) + 'x').join('\n');

describe('measure', () => {
  it('counts logical indentation with 2-space code', () => {
    assert.deepEqual(measure('a\n  b\n    c\n\n  d\n'), { loc: 4, complexity: 4 });
  });
  it('counts logical indentation with 4-space code', () => {
    assert.deepEqual(measure('a\n    b\n        c\n'), { loc: 3, complexity: 3 });
  });
  it('treats each tab as one level', () => {
    assert.deepEqual(measure('a\n\tb\n\t\tc'), { loc: 3, complexity: 3 });
  });
  it('is not thrown off by JSDoc alignment', () => {
    const src = '/**\n * doc\n */\nfunction f() {\n    if (x) {\n        y();\n    }\n}\n';
    assert.equal(measure(src).complexity, 1 * 0 + 4);
  });
});

describe('globToRegExp', () => {
  const t = (glob, path) => globToRegExp(glob).test(path);
  it('matches names at any depth', () => {
    assert.ok(t('*.ts', 'src/a/b.ts'));
    assert.ok(t('legacy', 'src/legacy/old.js'));
    assert.ok(!t('*.ts', 'src/a/b.tsx'));
  });
  it('anchors patterns with a slash', () => {
    assert.ok(t('src/gen', 'src/gen/x.ts'));
    assert.ok(!t('src/gen', 'lib/src/gen/x.ts'));
    assert.ok(t('/docs', 'docs/a.md'));
  });
  it('supports ** across directories', () => {
    assert.ok(t('**/*.test.ts', 'a/b/c.test.ts'));
    assert.ok(t('src/**/*.ts', 'src/x.ts'));
    assert.ok(t('src/**/*.ts', 'src/a/b/x.ts'));
  });
  it('escapes regex characters', () => {
    assert.ok(t('a+b.(js)', 'a+b.(js)'));
    assert.ok(!t('a.js', 'abjs'));
  });
});

describe('filters', () => {
  it('detects languages', () => {
    assert.equal(languageOf('src/app.tsx'), 'TypeScript');
    assert.equal(languageOf('Dockerfile'), 'Docker');
    assert.equal(languageOf('README.md'), 'Other');
  });
  it('detects tests', () => {
    for (const p of ['test/a.js', 'src/a.test.ts', 'pkg/a_test.go', 'tests/test_x.py', 'src/__tests__/a.js']) {
      assert.ok(isTestFile(p), p);
    }
    assert.ok(!isTestFile('src/testing-library.ts'));
  });
  it('skips vendored, generated, lock and test files by default', () => {
    const f = createFilter();
    assert.ok(f('src/index.ts'));
    for (const p of ['node_modules/x/index.js', 'dist/a.js', 'package-lock.json', 'a.min.js', 'README.md', 'src/a.spec.ts']) {
      assert.ok(!f(p), p);
    }
  });
  it('honours include, exclude, includeTests and allFiles', () => {
    assert.ok(createFilter({ includeTests: true })('src/a.spec.ts'));
    assert.ok(createFilter({ allFiles: true })('README.md'));
    assert.ok(!createFilter({ allFiles: true })('node_modules/a.js'));
    assert.ok(!createFilter({ exclude: ['src/legacy'] })('src/legacy/a.ts'));
    const only = createFilter({ include: ['packages/api/**'] });
    assert.ok(only('packages/api/src/a.ts'));
    assert.ok(!only('packages/web/src/a.ts'));
  });
});

describe('commit classification', () => {
  it('recognises bug fixes', () => {
    for (const s of ['fix: crash on load', 'Fixes #12', 'hotfix login', 'Revert "feat: x"', 'fix(deps): bump']) {
      assert.ok(isBugfix(s), s);
    }
    for (const s of ['feat: add prefix option', 'docs: fixture notes', 'refactor parser']) {
      assert.ok(!isBugfix(s), s);
    }
  });
  it('recognises bots', () => {
    assert.ok(isBot('dependabot[bot]'));
    assert.ok(isBot('renovate[bot]'));
    assert.ok(isBot('github-actions'));
    assert.ok(!isBot('Ada Lovelace'));
  });
});

describe('parseLog', () => {
  it('parses records, numstat lines and binary files', () => {
    const RS = '\u001e';
    const US = '\u001f';
    const out =
      `${RS}abc${US}Ada${US}1700000000${US}fix: things\n\n3\t1\tsrc/a.ts\n-\t-\tlogo.png\n` +
      `${RS}def${US}Grace${US}1700000100${US}feat: more\n\n10\t0\tsrc/b.ts\n`;
    const commits = parseLog(out);
    assert.equal(commits.length, 2);
    assert.deepEqual(commits[0].files, [
      { path: 'src/a.ts', added: 3, deleted: 1 },
      { path: 'logo.png', added: 0, deleted: 0 },
    ]);
    assert.equal(commits[1].author, 'Grace');
    assert.equal(commits[1].time, 1700000100);
  });
});

describe('analyze', () => {
  const files = [
    { path: 'src/hot.ts', content: nested(30) },
    { path: 'src/simple.ts', content: 'a\nb\nc' },
    { path: 'src/big-but-stable.ts', content: nested(40) },
    { path: 'src/pair-a.ts', content: nested(5) },
    { path: 'src/pair-b.ts', content: nested(5) },
  ];
  const commits = [
    ...Array.from({ length: 8 }, (_, i) => commit('Ada', i % 2 ? 'fix: hot path' : 'feat: hot', ['src/hot.ts'], 1_700_000_000 + i)),
    commit('Grace', 'feat', ['src/simple.ts']),
    commit('Grace', 'feat', ['src/simple.ts']),
    commit('Ada', 'feat', ['src/big-but-stable.ts']),
    ...Array.from({ length: 4 }, () => commit('Grace', 'feat: pair', ['src/pair-a.ts', 'src/pair-b.ts'])),
    commit('dependabot[bot]', 'chore: bump', ['src/hot.ts']),
  ];
  const report = analyze({ commits, files, repo: { name: 'demo' }, version: '1.2.3' });

  it('ranks churn x complexity first', () => {
    assert.equal(report.files[0].path, 'src/hot.ts');
    assert.ok(report.files[0].score >= 90);
    const stable = report.files.find((f) => f.path === 'src/big-but-stable.ts');
    assert.ok(stable.score < report.files[0].score);
  });
  it('counts commits, bug fixes and ownership', () => {
    const hot = report.files[0];
    assert.equal(hot.commits, 8, 'bot commits are ignored');
    assert.equal(hot.bugfixes, 4);
    assert.equal(hot.topAuthor, 'Ada');
    assert.equal(hot.topAuthorShare, 1);
    assert.equal(report.totals.authors, 2);
    assert.equal(report.totals.commits, 15);
  });
  it('finds change coupling', () => {
    assert.deepEqual(report.couplings, [{ a: 'src/pair-a.ts', b: 'src/pair-b.ts', shared: 4, degree: 1 }]);
  });
  it('computes concentration and bus factor', () => {
    // 19 file-changes: hot.ts (8) alone is under half, so a pair file joins it.
    assert.equal(report.concentration.files, 2);
    assert.ok(report.concentration.locShare > 0 && report.concentration.locShare < 1);
    assert.equal(report.busFactor, 1);
  });
  it('anonymizes authors', () => {
    const anon = analyze({ commits, files }, { anonymize: true });
    const names = new Set(anon.files.map((f) => f.topAuthor).filter(Boolean));
    assert.deepEqual([...names].sort(), ['dev-1', 'dev-2']);
  });
  it('handles an empty history', () => {
    const empty = analyze({ commits: [], files });
    assert.equal(empty.totals.commits, 0);
    assert.ok(empty.files.every((f) => f.score === 0));
    assert.equal(empty.busFactor, null);
  });
});

describe('busFactor', () => {
  const f = (topAuthor, share, loc) => ({ topAuthor, topAuthorShare: share, loc, commits: 3 });
  it('returns null when nobody owns most of the code', () => {
    assert.equal(busFactor([f('a', 0.3, 100), f('b', 0.4, 100)]), null);
  });
  it('counts the fewest majority owners covering half the code', () => {
    assert.equal(busFactor([f('a', 0.9, 60), f('b', 0.9, 30), f('c', 0.9, 10)]), 1);
    assert.equal(busFactor([f('a', 0.9, 40), f('b', 0.9, 35), f('c', 0.9, 25)]), 2);
  });
});

describe('renderers', () => {
  const report = analyze({
    commits: [commit('A|B', 'fix', ['src/a|b.ts']), commit('A|B', 'fix', ['src/a|b.ts'])],
    files: [{ path: 'src/a|b.ts', content: nested(4) }],
    repo: { name: '<script>alert(1)</script>' },
  });
  it('escapes pipes in markdown tables', () => {
    const md = renderMarkdown(report);
    assert.match(md, /`src\/a\\\|b\.ts`/);
  });
  it('cannot break out of the HTML script tag', () => {
    const html = renderHtml(report);
    assert.ok(!html.includes('<script>alert(1)</script>'));
    assert.ok(html.includes('&#60;script&#62;alert(1)&#60;/script&#62; · repoheat'));
    assert.ok(!html.includes('/*__REPOHEAT_DATA__*/null'));
  });
  it('truncates long paths from the left on segment boundaries', () => {
    assert.equal(truncatePath('packages/vite/src/node/plugins/css.ts', 24), '…/node/plugins/css.ts');
    assert.equal(truncatePath('short.ts', 24), 'short.ts');
  });
});
