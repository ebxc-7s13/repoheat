export interface FileChange {
  path: string;
  added: number;
  deleted: number;
}

export interface Commit {
  hash: string;
  author: string;
  time: number;
  subject: string;
  files: FileChange[];
}

export interface SourceFile {
  path: string;
  content: string;
}

export interface FileMetrics {
  path: string;
  language: string;
  /** Non-blank lines in the current version of the file. */
  loc: number;
  /** Indentation-based complexity: sum of logical indent levels of every line. */
  complexity: number;
  /** Number of commits that touched the file in the analysed window. */
  commits: number;
  added: number;
  deleted: number;
  /** Commits whose message looks like a bug fix (fix, bug, hotfix, revert...). */
  bugfixes: number;
  authors: number;
  topAuthor: string;
  /** Share (0..1) of the file's commits made by its top author. */
  topAuthorShare: number;
  /** Unix seconds of the most recent change, 0 if untouched in the window. */
  lastChanged: number;
  /** Hotspot score 0..100: high churn x high complexity. */
  score: number;
}

export interface Coupling {
  a: string;
  b: string;
  /** Commits that changed both files. */
  shared: number;
  /** shared / average revisions of the two files (0..1). */
  degree: number;
}

export interface Concentration {
  /** Share of all file changes covered (fixed at 0.5). */
  changeShare: number;
  /** Number of files that receive that share of changes. */
  files: number;
  /** Share of the codebase (by LOC) those files represent. */
  locShare: number;
}

export interface Report {
  tool: { name: string; version: string };
  generatedAt: string;
  repo: {
    name: string;
    branch: string;
    head: string;
    scope: string;
    since: string;
    firstCommit: number;
    lastCommit: number;
  };
  totals: {
    files: number;
    loc: number;
    commits: number;
    authors: number;
    bugfixCommits: number;
  };
  /** Fewest people who are majority authors of over half the changed code; null when knowledge is widely shared. */
  busFactor: number | null;
  concentration: Concentration;
  /** Every analysed file, sorted by hotspot score (desc). */
  files: FileMetrics[];
  couplings: Coupling[];
}

export interface AnalyzeOptions {
  since?: string;
  anonymize?: boolean;
  /** Commits touching more files than this are ignored for coupling (bulk refactors, formatting). */
  maxCouplingFiles?: number;
  minCouplingShared?: number;
}
