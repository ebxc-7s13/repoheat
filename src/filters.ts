const LANGUAGES: Record<string, string> = {
  js: 'JavaScript', jsx: 'JavaScript', mjs: 'JavaScript', cjs: 'JavaScript',
  ts: 'TypeScript', tsx: 'TypeScript', mts: 'TypeScript', cts: 'TypeScript',
  vue: 'Vue', svelte: 'Svelte', astro: 'Astro',
  py: 'Python', pyi: 'Python', ipynb: 'Python',
  rb: 'Ruby', erb: 'Ruby', rake: 'Ruby',
  php: 'PHP', twig: 'PHP',
  java: 'Java', kt: 'Kotlin', kts: 'Kotlin', scala: 'Scala', groovy: 'Groovy', gradle: 'Groovy',
  go: 'Go', rs: 'Rust', zig: 'Zig', nim: 'Nim', v: 'V',
  c: 'C', h: 'C', cc: 'C++', cpp: 'C++', cxx: 'C++', hpp: 'C++', hh: 'C++', hxx: 'C++',
  m: 'Objective-C', mm: 'Objective-C', swift: 'Swift',
  cs: 'C#', fs: 'F#', vb: 'Visual Basic',
  dart: 'Dart', lua: 'Lua', pl: 'Perl', pm: 'Perl', r: 'R', jl: 'Julia',
  ex: 'Elixir', exs: 'Elixir', erl: 'Erlang', hrl: 'Erlang',
  clj: 'Clojure', cljs: 'Clojure', cljc: 'Clojure', hs: 'Haskell', elm: 'Elm', ml: 'OCaml', mli: 'OCaml',
  sol: 'Solidity', sh: 'Shell', bash: 'Shell', zsh: 'Shell', fish: 'Shell', ps1: 'PowerShell',
  sql: 'SQL', graphql: 'GraphQL', gql: 'GraphQL', proto: 'Protobuf',
  css: 'CSS', scss: 'CSS', sass: 'CSS', less: 'CSS', styl: 'CSS',
  html: 'HTML', htm: 'HTML', haml: 'HTML', liquid: 'HTML', hbs: 'HTML',
  tf: 'Terraform', hcl: 'Terraform', cmake: 'CMake',
};

const SPECIAL_NAMES: Record<string, string> = {
  dockerfile: 'Docker', makefile: 'Make', rakefile: 'Ruby', gemfile: 'Ruby', justfile: 'Make',
};

/** Paths that are almost never hand-written code. Applied even with --all-files. */
const ALWAYS_EXCLUDE = [
  'node_modules/', 'vendor/', 'third_party/', 'third-party/', 'bower_components/',
  'dist/', 'build/', 'out/', '.next/', '.nuxt/', '.svelte-kit/', '.turbo/', 'coverage/',
  '__snapshots__/', '.yarn/', 'Pods/', 'target/', '__pycache__/', '.venv/', 'venv/',
  '*.min.js', '*.min.css', '*.map', '*.lock', 'package-lock.json', 'pnpm-lock.yaml',
  'go.sum', 'bun.lockb', 'npm-shrinkwrap.json', '*.snap', '*.pb.go', '*_pb2.py', '*.generated.*',
];

export function languageOf(path: string): string {
  const name = path.slice(path.lastIndexOf('/') + 1).toLowerCase();
  if (SPECIAL_NAMES[name]) return SPECIAL_NAMES[name];
  const dot = name.lastIndexOf('.');
  if (dot <= 0) return 'Other';
  return LANGUAGES[name.slice(dot + 1)] ?? 'Other';
}

export function isSourceFile(path: string): boolean {
  return languageOf(path) !== 'Other';
}

/**
 * Converts a gitignore-flavoured glob to a RegExp.
 * `*` matches within a segment, `**` across segments, a pattern without a
 * slash matches at any depth, and a matching directory matches its contents.
 */
export function globToRegExp(glob: string): RegExp {
  let g = glob.trim().replace(/\\/g, '/');
  if (g.endsWith('/')) g = g.slice(0, -1);
  const anchored = g.startsWith('/') || (g.includes('/') && !g.startsWith('**/'));
  if (g.startsWith('/')) g = g.slice(1);
  let re = '';
  for (let i = 0; i < g.length; i++) {
    const ch = g[i];
    if (ch === '*' && g[i + 1] === '*') {
      if (g[i + 2] === '/') {
        re += '(?:.*/)?';
        i += 2;
      } else {
        re += '.*';
        i += 1;
      }
    } else if (ch === '*') {
      re += '[^/]*';
    } else if (ch === '?') {
      re += '[^/]';
    } else {
      re += ch.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    }
  }
  return new RegExp((anchored ? '^' : '(?:^|/)') + re + '(?:/.*)?$');
}

const TEST_PATTERNS = [
  'test/', 'tests/', '__tests__/', '__mocks__/', 'spec/', 'specs/', 'e2e/', 'testdata/', 'fixtures/',
  '*.test.*', '*.spec.*', '*_test.*', '*_spec.*', 'test_*.py', '*Test.java', '*Tests.cs', '*Test.kt',
].map(globToRegExp);

export function isTestFile(path: string): boolean {
  return TEST_PATTERNS.some((r) => r.test(path));
}

export interface FilterOptions {
  include?: string[];
  exclude?: string[];
  allFiles?: boolean;
  /** Tests churn alongside the code they cover, so they are skipped by default. */
  includeTests?: boolean;
}

export function createFilter(opts: FilterOptions = {}): (path: string) => boolean {
  const always = ALWAYS_EXCLUDE.map(globToRegExp);
  const exclude = (opts.exclude ?? []).filter(Boolean).map(globToRegExp);
  const include = (opts.include ?? []).filter(Boolean).map(globToRegExp);
  return (path: string) => {
    if (always.some((r) => r.test(path))) return false;
    if (exclude.some((r) => r.test(path))) return false;
    if (!opts.includeTests && isTestFile(path)) return false;
    if (include.length > 0) return include.some((r) => r.test(path));
    return opts.allFiles ? true : isSourceFile(path);
  };
}
