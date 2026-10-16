import { readFileSync } from 'node:fs';
import type { Report } from '../types.js';

const PLACEHOLDER = '/*__REPOHEAT_DATA__*/null';

export function renderHtml(report: Report): string {
  const template = readFileSync(new URL('../../assets/report.html', import.meta.url), 'utf8');
  // Escape "<" so file paths or author names can never close the <script> tag.
  const data = JSON.stringify(report).replace(/</g, '\\u003c');
  const title = `${report.repo.name} · repoheat`.replace(/[<&>"]/g, (c) => `&#${c.charCodeAt(0)};`);
  return template.replace('__REPOHEAT_TITLE__', title).replace(PLACEHOLDER, () => data);
}
