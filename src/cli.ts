#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { parseArgs } from 'node:util';
import { GitError } from './git.js';
import { scan, version } from './index.js';
import { renderHtml } from './report/html.js';
import { renderMarkdown } from './report/markdown.js';
import { renderTerminal } from './report/terminal.js';

const HELP = `
repoheat: find the files that cause most of your bugs.

Usage
  npx repoheat [path] [options]

Options
  -s, --since <when>     Time window: "6 months ago", "2024-01-01"...
                         (default: last 12 months, or all history for small repos)
  -n, --top <n>          Number of hotspots to list (default: 10)
  -o, --out <file>       Where to write the interactive map (default: repoheat.html)
      --no-html          Don't write the interactive map
      --open             Open the interactive map in your browser
      --json             Print the full report as JSON
      --md               Print a Markdown summary (PR comments, CI, AI agents)
  -i, --include <glob>   Only analyse matching files (repeatable)
  -x, --exclude <glob>   Skip matching files (repeatable, also reads .repoheatignore)
      --include-tests    Also analyse test files (skipped by default)
      --all-files        Analyse every tracked file, not only source code
      --anonymize        Replace author names with dev-1, dev-2... before sharing
      --max-commits <n>  Only read the most recent n commits
  -h, --help             Show this help
  -v, --version          Show the version

Examples
  npx repoheat                        Analyse the current repo
  npx repoheat packages/api --open    Scope to a folder and open the map
  npx repoheat --since "2 years ago" -x "**/*.test.ts"
  npx repoheat --md > HOTSPOTS.md     Hand your hotspots to an AI coding agent
`;

function openInBrowser(file: string): void {
  const [cmd, args] =
    process.platform === 'win32'
      ? ['cmd', ['/c', 'start', '""', file]]
      : process.platform === 'darwin'
        ? ['open', [file]]
        : ['xdg-open', [file]];
  try {
    spawn(cmd, args as string[], { detached: true, stdio: 'ignore', windowsHide: true }).on('error', () => {}).unref();
  } catch {
    // Opening the browser is a convenience; the path is already printed.
  }
}

function main(argv: string[]): number {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      since: { type: 'string', short: 's' },
      top: { type: 'string', short: 'n' },
      out: { type: 'string', short: 'o' },
      'no-html': { type: 'boolean' },
      open: { type: 'boolean' },
      json: { type: 'boolean' },
      md: { type: 'boolean' },
      include: { type: 'string', short: 'i', multiple: true },
      exclude: { type: 'string', short: 'x', multiple: true },
      'all-files': { type: 'boolean' },
      'include-tests': { type: 'boolean' },
      anonymize: { type: 'boolean' },
      'max-commits': { type: 'string' },
      help: { type: 'boolean', short: 'h' },
      version: { type: 'boolean', short: 'v' },
    },
  });

  if (values.help) {
    process.stdout.write(HELP);
    return 0;
  }
  if (values.version) {
    process.stdout.write(version() + '\n');
    return 0;
  }

  const top = values.top ? Number.parseInt(values.top, 10) : 10;
  if (!Number.isFinite(top) || top < 1) throw new UsageError('--top must be a positive number');
  const maxCommits = values['max-commits'] ? Number.parseInt(values['max-commits'], 10) : undefined;
  if (maxCommits !== undefined && !(maxCommits > 0)) throw new UsageError('--max-commits must be a positive number');

  const report = scan({
    cwd: positionals[0],
    since: values.since,
    include: values.include,
    exclude: values.exclude,
    allFiles: values['all-files'],
    includeTests: values['include-tests'],
    anonymize: values.anonymize,
    maxCommits,
  });

  const machine = values.json || values.md;
  const wantHtml = !values['no-html'] && (!machine || values.out !== undefined || values.open);
  let htmlPath: string | undefined;
  if (wantHtml && report.totals.files > 0) {
    const out = resolve(values.out ?? 'repoheat.html');
    writeFileSync(out, renderHtml(report));
    const rel = relative(process.cwd(), out);
    htmlPath = !rel || isAbsolute(rel) || rel.startsWith('..') ? out : `.${sep}${rel}`;
    if (values.open) openInBrowser(out);
  }

  if (values.json) process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  else if (values.md) process.stdout.write(renderMarkdown(report, { top }));
  else {
    const color = useColor(process.env, Boolean(process.stdout.isTTY));
    process.stdout.write(
      renderTerminal(report, { color, top, width: process.stdout.columns, htmlPath }) +
        '\n',
    );
  }
  return 0;
}

class UsageError extends Error {}

/** NO_COLOR (no-color.org) always wins; FORCE_COLOR=0/false turns colour off, any other value on. */
function useColor(env: NodeJS.ProcessEnv, isTTY: boolean): boolean {
  if (env.NO_COLOR) return false;
  if (env.FORCE_COLOR !== undefined) return env.FORCE_COLOR !== '0' && env.FORCE_COLOR !== 'false';
  return isTTY && env.TERM !== 'dumb';
}

try {
  process.exitCode = main(process.argv.slice(2));
} catch (err) {
  const known = err instanceof GitError || err instanceof UsageError || (err as { code?: string }).code?.startsWith('ERR_PARSE_ARGS');
  process.stderr.write(`repoheat: ${known ? (err as Error).message : (err as Error).stack}\n`);
  if (!(err instanceof GitError)) process.stderr.write('Run `repoheat --help` for usage.\n');
  process.exitCode = 1;
}
