import type { FileMetrics, Report } from '../types.js';

export const pct = (n: number) => `${Math.round(n * 100)}%`;

export const num = (n: number) => n.toLocaleString('en-US');

export function window(report: Report): string {
  const s = report.repo.since;
  if (!s || s === 'all time') return 'all time';
  return s.replace(/\s*ago$/, '').replace(/^/, 'last ');
}

export function headline(report: Report): string {
  const c = report.concentration;
  if (!c.files) return 'No changes found in the analysed window.';
  const share = c.locShare < 0.01 ? '<1%' : pct(c.locShare);
  return `Half of all changes land in ${share} of the code (${c.files} file${c.files === 1 ? '' : 's'}).`;
}

/** Hot files mostly written by one person: bus-factor risk where it hurts most. */
export function knowledgeRisks(report: Report, limit = 5): FileMetrics[] {
  return report.files
    .filter((f) => f.score >= 30 && f.commits >= 3 && f.topAuthorShare >= 0.8 && report.totals.authors > 1)
    .slice(0, limit);
}

export function hotspots(report: Report, limit: number): FileMetrics[] {
  return report.files.filter((f) => f.score > 0 && f.commits >= 2).slice(0, limit);
}

export function bugfixRate(report: Report): number {
  return report.totals.commits ? report.totals.bugfixCommits / report.totals.commits : 0;
}

export function busFactorText(report: Report): string {
  return report.busFactor === null ? 'shared' : String(report.busFactor);
}

/** The main author, or "shared" when nobody wrote most of the changes. */
export function owner(f: FileMetrics): string {
  if (!f.topAuthor) return '';
  return f.topAuthorShare > 0.5 ? f.topAuthor : 'shared';
}
