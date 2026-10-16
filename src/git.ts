import { spawnSync } from 'node:child_process';
import type { Commit } from './types.js';

const RECORD = '\u001e';
const FIELD = '\u001f';

export class GitError extends Error {}

export function git(cwd: string, args: string[]): string {
  const res = spawnSync('git', ['-c', 'core.quotepath=off', ...args], {
    cwd,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 1024,
    windowsHide: true,
  });
  if (res.error) {
    const code = (res.error as NodeJS.ErrnoException).code;
    throw new GitError(code === 'ENOENT' ? 'git was not found on your PATH.' : res.error.message);
  }
  if (res.status !== 0) throw new GitError(res.stderr.trim() || `git ${args[0]} failed`);
  return res.stdout;
}

export function repoRoot(cwd: string): string {
  try {
    return git(cwd, ['rev-parse', '--show-toplevel']).trim();
  } catch {
    throw new GitError(`Not a git repository: ${cwd}\nRun repoheat inside a git repo, or pass a path to one.`);
  }
}

/**
 * Path of `cwd` relative to the repo root, as git sees it ("packages/api").
 * Asking git avoids path mismatches from symlinks or Windows short names.
 */
export function repoPrefix(cwd: string): string {
  return git(cwd, ['rev-parse', '--show-prefix']).trim().replace(/\/$/, '');
}

export function currentBranch(root: string): string {
  try {
    return git(root, ['rev-parse', '--abbrev-ref', 'HEAD']).trim();
  } catch {
    return '';
  }
}

export function headSha(root: string): string {
  try {
    return git(root, ['rev-parse', '--short', 'HEAD']).trim();
  } catch {
    return '';
  }
}

export function trackedFiles(root: string): string[] {
  return git(root, ['ls-files', '-z']).split('\0').filter(Boolean);
}

export function parseLog(out: string): Commit[] {
  const commits: Commit[] = [];
  for (const record of out.split(RECORD)) {
    if (!record.trim()) continue;
    const [header, ...rest] = record.split('\n');
    const [hash, author, time, ...subject] = header.split(FIELD);
    const files = [];
    for (const line of rest) {
      const m = /^(\d+|-)\t(\d+|-)\t(.+)$/.exec(line);
      if (!m) continue;
      files.push({
        path: m[3],
        added: m[1] === '-' ? 0 : Number(m[1]),
        deleted: m[2] === '-' ? 0 : Number(m[2]),
      });
    }
    commits.push({ hash, author, time: Number(time), subject: subject.join(FIELD), files });
  }
  return commits;
}

export function readLog(root: string, opts: { since?: string; maxCommits?: number } = {}): Commit[] {
  const args = [
    'log',
    '--no-merges',
    '--no-renames',
    '--numstat',
    `--format=${RECORD}%H${FIELD}%aN${FIELD}%at${FIELD}%s`,
  ];
  if (opts.since) args.push(`--since=${opts.since}`);
  if (opts.maxCommits) args.push(`--max-count=${opts.maxCommits}`);
  try {
    return parseLog(git(root, args));
  } catch (err) {
    // A brand-new repository has no HEAD yet.
    if (/does not have any commits|bad default revision/i.test(String(err))) return [];
    throw err;
  }
}
