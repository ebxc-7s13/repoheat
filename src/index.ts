import { existsSync, readFileSync, statSync } from 'node:fs';
import { basename, join, relative, resolve, sep } from 'node:path';
import { analyze } from './analyze.js';
import { createFilter, type FilterOptions } from './filters.js';
import { currentBranch, headSha, readLog, repoRoot, trackedFiles } from './git.js';
import type { AnalyzeOptions, Report, SourceFile } from './types.js';

export * from './types.js';
export { analyze, isBot, isBugfix, busFactor, concentration } from './analyze.js';
export { measure } from './complexity.js';
export { createFilter, globToRegExp, isTestFile, languageOf } from './filters.js';
export { parseLog } from './git.js';

export const DEFAULT_SINCE = '12 months ago';
/** Below this many commits in the default window, fall back to the whole history. */
const MIN_COMMITS = 20;
const MAX_FILE_BYTES = 1024 * 1024;

export interface ScanOptions extends AnalyzeOptions, FilterOptions {
  /** Directory to analyse. Any folder inside a git repo; subfolders scope the analysis. */
  cwd?: string;
  maxCommits?: number;
}

export function version(): string {
  try {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
    return pkg.version;
  } catch {
    return '0.0.0';
  }
}

function ignoreFile(root: string): string[] {
  const file = join(root, '.repoheatignore');
  if (!existsSync(file)) return [];
  return readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));
}

export function scan(opts: ScanOptions = {}): Report {
  const target = resolve(opts.cwd ?? process.cwd());
  const root = resolve(repoRoot(target));
  let scope = relative(root, target).split(sep).join('/');
  if (scope.startsWith('..')) scope = '';

  const filter = createFilter({ ...opts, exclude: [...(opts.exclude ?? []), ...ignoreFile(root)] });
  const inScope = (p: string) => (!scope || p.startsWith(scope + '/')) && filter(p);

  const files: SourceFile[] = [];
  for (const path of trackedFiles(root)) {
    if (!inScope(path)) continue;
    const abs = join(root, path);
    try {
      if (statSync(abs).size > MAX_FILE_BYTES) continue;
      files.push({ path, content: readFileSync(abs, 'utf8') });
    } catch {
      // Deleted or unreadable in the working tree; skip it.
    }
  }

  let since = opts.since ?? DEFAULT_SINCE;
  let commits = readLog(root, { since, maxCommits: opts.maxCommits });
  if (!opts.since && commits.length < MIN_COMMITS) {
    commits = readLog(root, { maxCommits: opts.maxCommits });
    since = 'all time';
  }
  commits = commits
    .map((c) => ({ ...c, files: c.files.filter((f) => inScope(f.path)) }))
    .filter((c) => c.files.length > 0);

  return analyze(
    {
      commits,
      files,
      repo: { name: basename(root), branch: currentBranch(root), head: headSha(root), scope, since },
      version: version(),
    },
    { ...opts, since },
  );
}
