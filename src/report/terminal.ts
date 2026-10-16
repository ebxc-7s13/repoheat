import type { Report } from '../types.js';
import { bugfixRate, busFactorText, headline, hotspots, knowledgeRisks, num, owner, pct, window } from './format.js';

export interface TerminalOptions {
  color?: boolean;
  top?: number;
  width?: number;
  htmlPath?: string;
}

export function renderTerminal(report: Report, opts: TerminalOptions = {}): string {
  const useColor = opts.color ?? false;
  const paint = (code: string) => (s: string) => (useColor ? `\u001b[${code}m${s}\u001b[0m` : s);
  const bold = paint('1');
  const dim = paint('2');
  const red = paint('38;5;196');
  const orange = paint('38;5;208');
  const yellow = paint('38;5;220');
  const cyan = paint('36');
  const heat = (score: number) => (score >= 70 ? red : score >= 40 ? orange : score >= 15 ? yellow : dim);
  const badge = useColor ? '\u001b[1;38;5;231;48;5;202m repoheat \u001b[0m' : '[repoheat]';

  const width = Math.max(70, Math.min(opts.width ?? 100, 140));
  const out: string[] = [''];
  const r = report.repo;
  const where = [r.branch && r.head ? `${r.branch} @ ${r.head}` : r.head, r.scope && `scope ${r.scope}/`]
    .filter(Boolean)
    .join(' · ');
  out.push(` ${badge} ${bold(r.name)} ${dim(where)}`);
  out.push(
    dim(
      `   ${window(report)} · ${num(report.totals.commits)} commits · ${num(report.totals.authors)} authors · ` +
        `${num(report.totals.files)} files · ${num(report.totals.loc)} lines`,
    ),
  );
  out.push('');

  const top = hotspots(report, opts.top ?? 10);
  if (report.totals.files === 0) {
    out.push('   No source files found. Try --all-files or --include "<glob>".', '');
    return out.join('\n');
  }
  if (top.length === 0) {
    out.push('   No changes to analyse in this window. Try --since "3 years ago".', '');
    return out.join('\n');
  }

  out.push(`   ${bold(headline(report))}`);
  out.push(
    `   ${dim('Bus factor')} ${bold(busFactorText(report))}   ${dim('Bug-fix commits')} ${bold(pct(bugfixRate(report)))}`,
  );
  out.push('');

  const barW = 10;
  const cols = 6 + 8 + 11 + 7;
  const ownerW = 22;
  const pathW = Math.max(24, width - barW - cols - ownerW - 8);
  out.push(
    dim(
      `   ${'HOTSPOT'.padEnd(barW + 1 + pathW)} ${'score'.padStart(5)} ${'commits'.padStart(7)} ${'complexity'.padStart(10)} ${'fixes'.padStart(6)}  owner`,
    ),
  );
  for (const f of top) {
    const filled = Math.max(1, Math.round((f.score / 100) * barW));
    const bar = heat(f.score)('█'.repeat(filled)) + dim('░'.repeat(barW - filled));
    const who = owner(f);
    const ownerCell = who === 'shared' ? dim('shared') : who ? `${truncate(who, ownerW - 6)} ${dim(pct(f.topAuthorShare))}` : '';
    out.push(
      `   ${bar} ${truncatePath(f.path, pathW).padEnd(pathW)} ${heat(f.score)(String(f.score).padStart(5))} ` +
        `${num(f.commits).padStart(7)} ${num(f.complexity).padStart(10)} ${num(f.bugfixes).padStart(6)}  ${ownerCell}`,
    );
  }

  const risks = knowledgeRisks(report);
  if (risks.length) {
    out.push('', `   ${bold('Knowledge risk')} ${dim('hot files that mostly one person understands')}`);
    for (const f of risks) {
      out.push(`   ${orange('!')} ${truncatePath(f.path, pathW + 10)}  ${dim(`${f.topAuthor} wrote ${pct(f.topAuthorShare)} of changes`)}`);
    }
  }

  if (report.couplings.length) {
    out.push('', `   ${bold('Hidden coupling')} ${dim('files that keep changing together')}`);
    for (const c of report.couplings.slice(0, 5)) {
      const half = Math.floor((width - 30) / 2);
      out.push(
        `   ${cyan('⇄')} ${truncatePath(c.a, half)} ${dim('+')} ${truncatePath(c.b, half)}  ${dim(`${c.shared}× · ${pct(c.degree)}`)}`,
      );
    }
  }

  out.push('');
  if (opts.htmlPath) out.push(`   ${bold('→')} Interactive heatmap: ${cyan(opts.htmlPath)}`, '');
  return out.join('\n');
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1) + '…';
}

/** Shortens a path from the left, keeping whole trailing segments: "…/node/plugins/css.ts". */
export function truncatePath(p: string, n: number): string {
  if (p.length <= n) return p;
  const parts = p.split('/');
  let out = parts.pop()!;
  if (out.length + 2 > n) return '…' + out.slice(out.length - n + 1);
  while (parts.length && parts[parts.length - 1].length + out.length + 3 <= n) out = `${parts.pop()}/${out}`;
  return `…/${out}`;
}
