# Contributing to repoheat

Thanks for helping! Bug reports, ideas and pull requests are all welcome.

## Setup

```bash
git clone https://github.com/ebxc-7s13/repoheat.git
cd repoheat
npm install
npm test          # builds with tsc, then runs node:test
node dist/cli.js  # run repoheat on itself
```

You need Node 18.3+ and git. There are no runtime dependencies, and we'd like to keep it that way.

## Project layout

| Path | What it does |
|---|---|
| `src/git.ts` | Runs `git` and parses `git log --numstat`. |
| `src/complexity.ts` | Indentation-based complexity. |
| `src/filters.ts` | Language detection, default excludes, glob matching. |
| `src/analyze.ts` | Pure function: commits + files → report. Most logic lives here and is easy to unit test. |
| `src/report/` | Terminal, Markdown and HTML renderers. |
| `assets/report.html` | The interactive heatmap (vanilla JS, no build step). The report data is injected into it. |
| `test/` | Unit tests and end-to-end CLI tests that build throwaway git repos. |
| `docs/` | The website (GitHub Pages). |
| `scripts/build-site.mjs` | Builds the website plus the gallery of popular repos listed in `scripts/gallery.json`. Try `npm run site -- --only expressjs/express`. |

To work on the heatmap, generate a report and refresh it in your browser after each edit:

```bash
npm run build && node dist/cli.js --open
```

## Pull requests

- Keep PRs focused, and add a test for any behaviour change.
- Run `npm test` before pushing. CI runs on Linux, macOS and Windows with Node 18, 20 and 22.
- For visual changes to the heatmap, include a screenshot in light and dark mode.

## Ideas we'd love help with

- More languages in `src/filters.ts`
- Better default excludes for popular frameworks
- Trend over time (is a hotspot cooling down?)
- Comparing two branches or time windows

By contributing you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md).
