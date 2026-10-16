import { measure, isBinary } from './complexity.js';
import { languageOf } from './filters.js';
import type { AnalyzeOptions, Commit, Concentration, Coupling, FileMetrics, Report, SourceFile } from './types.js';

const BUGFIX = /\b(fix(e[sd]|ing)?|bugs?|bugfix|hotfix|regression|crash(es|ed)?|broken|revert)\b/i;

export function isBugfix(subject: string): boolean {
  return BUGFIX.test(subject);
}

const BOT = /\[bot\]|^(dependabot|renovate|greenkeeper|github-actions|snyk-bot|allcontributors)\b/i;

/** Automated commits (dependency bumps, release bots) say nothing about who knows the code. */
export function isBot(author: string): boolean {
  return BOT.test(author);
}

export interface AnalyzeInput {
  commits: Commit[];
  files: SourceFile[];
  repo?: Partial<Report['repo']>;
  version?: string;
}

interface Acc {
  commits: number;
  added: number;
  deleted: number;
  bugfixes: number;
  lastChanged: number;
  authors: Map<string, number>;
}

function logNorm(value: number, max: number): number {
  return max > 0 ? Math.log1p(value) / Math.log1p(max) : 0;
}

export function analyze(input: AnalyzeInput, opts: AnalyzeOptions = {}): Report {
  const maxCouplingFiles = opts.maxCouplingFiles ?? 30;
  const commits = input.commits.filter((c) => !isBot(c.author));
  const minShared = opts.minCouplingShared ?? 3;

  const measured = new Map<string, { loc: number; complexity: number }>();
  for (const f of input.files) {
    if (isBinary(f.content)) continue;
    measured.set(f.path, measure(f.content));
  }

  // Stable, privacy-friendly aliases ranked by activity.
  const authorCommits = new Map<string, number>();
  for (const c of commits) authorCommits.set(c.author, (authorCommits.get(c.author) ?? 0) + 1);
  const alias = new Map<string, string>();
  [...authorCommits.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .forEach(([name], i) => alias.set(name, opts.anonymize ? `dev-${i + 1}` : name));

  const acc = new Map<string, Acc>();
  const pairCounts = new Map<string, number>();
  let bugfixCommits = 0;
  let firstCommit = Infinity;
  let lastCommit = 0;

  for (const c of commits) {
    firstCommit = Math.min(firstCommit, c.time);
    lastCommit = Math.max(lastCommit, c.time);
    const fix = isBugfix(c.subject);
    if (fix) bugfixCommits++;
    const touched = [...new Set(c.files.map((f) => f.path).filter((p) => measured.has(p)))];
    for (const ch of c.files) {
      if (!measured.has(ch.path)) continue;
      let a = acc.get(ch.path);
      if (!a) {
        a = { commits: 0, added: 0, deleted: 0, bugfixes: 0, lastChanged: 0, authors: new Map() };
        acc.set(ch.path, a);
      }
      a.added += ch.added;
      a.deleted += ch.deleted;
    }
    for (const p of touched) {
      const a = acc.get(p)!;
      a.commits++;
      if (fix) a.bugfixes++;
      a.lastChanged = Math.max(a.lastChanged, c.time);
      const who = alias.get(c.author)!;
      a.authors.set(who, (a.authors.get(who) ?? 0) + 1);
    }
    if (touched.length > 1 && touched.length <= maxCouplingFiles) {
      touched.sort();
      for (let i = 0; i < touched.length; i++) {
        for (let j = i + 1; j < touched.length; j++) {
          const key = `${touched[i]}\n${touched[j]}`;
          pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1);
        }
      }
    }
  }

  let maxCommits = 0;
  let maxComplexity = 0;
  for (const [path, m] of measured) {
    maxCommits = Math.max(maxCommits, acc.get(path)?.commits ?? 0);
    maxComplexity = Math.max(maxComplexity, m.complexity);
  }

  const files: FileMetrics[] = [];
  for (const [path, m] of measured) {
    const a = acc.get(path);
    let topAuthor = '';
    let top = 0;
    for (const [who, n] of a?.authors ?? []) {
      if (n > top) [topAuthor, top] = [who, n];
    }
    const commits = a?.commits ?? 0;
    files.push({
      path,
      language: languageOf(path),
      loc: m.loc,
      complexity: m.complexity,
      commits,
      added: a?.added ?? 0,
      deleted: a?.deleted ?? 0,
      bugfixes: a?.bugfixes ?? 0,
      authors: a?.authors.size ?? 0,
      topAuthor,
      topAuthorShare: commits ? top / commits : 0,
      lastChanged: a?.lastChanged ?? 0,
      score: Math.round(100 * logNorm(commits, maxCommits) * logNorm(m.complexity, maxComplexity)),
    });
  }
  files.sort((x, y) => y.score - x.score || y.commits - x.commits || x.path.localeCompare(y.path));

  const couplings: Coupling[] = [];
  for (const [key, shared] of pairCounts) {
    if (shared < minShared) continue;
    const [a, b] = key.split('\n');
    const avg = ((acc.get(a)?.commits ?? 0) + (acc.get(b)?.commits ?? 0)) / 2;
    const degree = avg ? shared / avg : 0;
    if (degree >= 0.5) couplings.push({ a, b, shared, degree: Math.round(degree * 100) / 100 });
  }
  couplings.sort((x, y) => y.shared * y.degree - x.shared * x.degree || x.a.localeCompare(y.a));

  const totalLoc = files.reduce((s, f) => s + f.loc, 0);

  return {
    tool: { name: 'repoheat', version: input.version ?? '0.0.0' },
    generatedAt: new Date().toISOString(),
    repo: {
      name: input.repo?.name ?? 'repository',
      branch: input.repo?.branch ?? '',
      head: input.repo?.head ?? '',
      scope: input.repo?.scope ?? '',
      since: opts.since ?? input.repo?.since ?? '',
      firstCommit: firstCommit === Infinity ? 0 : firstCommit,
      lastCommit,
    },
    totals: {
      files: files.length,
      loc: totalLoc,
      commits: commits.length,
      authors: authorCommits.size,
      bugfixCommits,
    },
    busFactor: busFactor(files),
    concentration: concentration(files, totalLoc),
    files,
    couplings: couplings.slice(0, 100),
  };
}

/**
 * Fewest people who, between them, are the majority author of more than half
 * of the recently changed code. `null` when ownership is too spread out for
 * any small group to reach half: knowledge is shared, which is healthy.
 */
export function busFactor(files: FileMetrics[]): number | null {
  const owned = new Map<string, number>();
  let total = 0;
  for (const f of files) {
    if (!f.commits) continue;
    total += f.loc;
    if (f.topAuthorShare > 0.5) owned.set(f.topAuthor, (owned.get(f.topAuthor) ?? 0) + f.loc);
  }
  let sum = 0;
  let n = 0;
  for (const loc of [...owned.values()].sort((a, b) => b - a)) {
    sum += loc;
    n++;
    if (sum > total / 2) return n;
  }
  return null;
}

/** "Half of your changes happen in X% of your code." */
export function concentration(files: FileMetrics[], totalLoc: number): Concentration {
  const changed = files.filter((f) => f.commits > 0).sort((a, b) => b.commits - a.commits || b.loc - a.loc);
  const totalTouches = changed.reduce((s, f) => s + f.commits, 0);
  let touches = 0;
  let loc = 0;
  let n = 0;
  for (const f of changed) {
    if (touches >= totalTouches / 2) break;
    touches += f.commits;
    loc += f.loc;
    n++;
  }
  return { changeShare: 0.5, files: n, locShare: totalLoc ? loc / totalLoc : 0 };
}
