<div align="center">

<img src="docs/assets/logo.svg" width="72" height="72" alt="">

# repoheat

**Find the files that cause most of your bugs.**<br>
One command. Any language. Nothing leaves your machine.

[![npm](https://img.shields.io/npm/v/repoheat?color=f97316)](https://www.npmjs.com/package/repoheat)
[![CI](https://github.com/ebxc-7s13/repoheat/actions/workflows/ci.yml/badge.svg)](https://github.com/ebxc-7s13/repoheat/actions/workflows/ci.yml)
[![zero dependencies](https://img.shields.io/badge/dependencies-0-success)](package.json)
[![license](https://img.shields.io/github/license/ebxc-7s13/repoheat)](LICENSE)

```bash
npx repoheat
```

<a href="https://ebxc-7s13.github.io/repoheat/demo.html"><img src="docs/assets/screenshot.png" alt="repoheat heatmap of the Vite repository: each rectangle is a file sized by lines of code and coloured by how hot it is" width="900"></a>

<sub>The Vite codebase, last 12 months. <a href="https://ebxc-7s13.github.io/repoheat/demo.html"><b>Open the interactive demo →</b></a> · <a href="https://ebxc-7s13.github.io/repoheat/gallery/"><b>See React, Django, Rails and more →</b></a></sub>

</div>

---

Every codebase has a few files that everyone is scared to touch. They are big, they are tangled, and they change all the time. That is where bugs pile up, where new features get slow, and where refactoring pays off most.

**repoheat finds them for you.** It reads your git history, measures how complex every file is, and shows you the **hotspots**: complex code that keeps changing. You get a ranked list in your terminal and an interactive heatmap you can explore and share.

## Quick start

Run it inside any git repository. No install, no config, no account:

```bash
npx repoheat
```

```text
 [repoheat] vite main @ 928e721b3
   last 12 months · 600 commits · 168 authors · 302 files · 59,031 lines

   Half of all changes land in 45% of the code (26 files).
   Bus factor shared   Bug-fix commits 52%

   HOTSPOT                                 score commits complexity  fixes  owner
   ██████████ …/src/node/plugins/css.ts       95      55     11,270     32  shared
   █████████░ …/vite/src/node/config.ts       92      68      5,193     26  shared
   ████████░░ …/vite/src/node/build.ts        83      53      3,725     23  dev-1 51%
   ████████░░ …/vite/src/node/utils.ts        76      44      2,699     24  shared
   ███████░░░ …/src/node/server/index.ts      74      39      2,637     18  shared

   Knowledge risk hot files that mostly one person understands
   ! …/src/node/server/transformRequest.ts  dev-1 wrote 83% of changes

   Hidden coupling files that keep changing together
   ⇄ packages/vite/src/client/client.ts + …/vite/types/customEvent.d.ts  4× · 50%

   → Interactive heatmap: ./repoheat.html
```

Then open `repoheat.html` (or add `--open`) to explore the map.

Prefer a global install? `npm i -g repoheat`, then run `repoheat` anywhere. You can also run the latest code straight from GitHub with `npx github:ebxc-7s13/repoheat`. Requires Node 18.3+ and git.

## What you get

| | |
|---|---|
| 🔥 **Hotspots** | Files ranked by churn × complexity. Fix these first. |
| 🗺️ **Interactive heatmap** | A zoomable treemap of the whole repo. Size is lines of code, colour is heat. Switch between hotspots, churn, complexity, bug fixes, ownership and recency. |
| 🐛 **Bug magnets** | How many commits that touched each file were bug fixes (`fix`, `hotfix`, `revert`...). |
| 🚌 **Bus factor & knowledge risk** | Which hot files are understood by only one person. |
| ⇄ **Hidden coupling** | Files that always change together, even though nothing in the code says so. |
| 📸 **Share image** | One click exports a PNG of the heatmap for your team chat, slides or socials. |
| 🤖 **AI-agent ready** | `--md` writes a summary you can drop into `AGENTS.md`/`CLAUDE.md` so coding agents tread carefully in hot files. |

It works for **every language** (40+ recognised out of the box) because complexity is measured from indentation, a language-agnostic method described in Adam Tornhill's *Your Code as a Crime Scene*.

## Usage

```bash
npx repoheat [path] [options]
```

| Option | Description |
|---|---|
| `-s, --since <when>` | Time window, e.g. `"6 months ago"` or `2024-01-01`. Default: last 12 months (all history for young repos). |
| `-n, --top <n>` | Number of hotspots to list. Default `10`. |
| `-o, --out <file>` | Where to write the heatmap. Default `repoheat.html`. |
| `--open` | Open the heatmap in your browser. |
| `--no-html` | Skip the heatmap. |
| `--json` | Print the full report as JSON. |
| `--md` | Print a Markdown summary (PR comments, CI, AI agents). |
| `-i, --include <glob>` | Only analyse matching files. Repeatable. |
| `-x, --exclude <glob>` | Skip matching files. Repeatable. |
| `--include-tests` | Also analyse test files (skipped by default). |
| `--all-files` | Analyse every tracked file, not only source code. |
| `--anonymize` | Replace author names with `dev-1`, `dev-2`... before sharing. |
| `--max-commits <n>` | Only read the most recent `n` commits. |

### Recipes

```bash
# Scope to one package in a monorepo
npx repoheat packages/api --open

# Look at a longer period, ignore generated code
npx repoheat --since "2 years ago" -x "**/generated/**" -x "src/legacy"

# Give your AI coding agent a map of the danger zones
npx repoheat --md > HOTSPOTS.md

# Share a heatmap publicly without exposing names
npx repoheat --anonymize --open

# Pipe the data anywhere
npx repoheat --json | jq '.files[:5] | map({path, score})'
```

Add a `.repoheatignore` file (gitignore-style globs) to the repo root to always skip paths.

## GitHub Action

Put the hotspot report on every CI run, plus the interactive heatmap as an artifact:

```yaml
# .github/workflows/repoheat.yml
name: repoheat
on:
  push:
    branches: [main]
jobs:
  heat:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0 # full history is needed
      - uses: ebxc-7s13/repoheat@v0
        with:
          since: 6 months ago
```

Inputs: `path`, `since`, `top`, `args`, `upload-report`, and `version` (run a specific npm release instead of the action's own code). [View on the GitHub Marketplace](https://github.com/marketplace/actions/repoheat).

## How it works

| Metric | How it's computed |
|---|---|
| **Churn** | Number of commits that touched the file in the time window. Merge commits and bots (Dependabot, Renovate, `[bot]` accounts) are ignored. |
| **Complexity** | Sum of the logical indentation of every line. Deeply nested code is harder to change in any language. Correlates well with cyclomatic complexity and needs no parser. |
| **Hotspot score** | `log(churn) × log(complexity)`, normalised to 0–100 for this repo. The hottest file in your repo scores ~100, so scores are relative and not comparable between repos. |
| **Bug fixes** | Commits whose subject matches `fix`, `bug`, `hotfix`, `regression`, `crash`, `broken` or `revert`. |
| **Ownership** | Share of a file's commits by its most active author (uses `.mailmap`). |
| **Bus factor** | The fewest people who are the majority author of more than half of the recently changed code. "Shared" means no small group owns it, which is good. |
| **Coupling** | Pairs of files changed together in at least 3 commits and in at least half of their changes. Commits touching more than 30 files (mass renames, formatting) are ignored. |
| **Concentration** | The share of the codebase that receives half of all changes. |

Vendored code, build output, lock files, minified files and tests are skipped by default.

## Privacy

repoheat runs `git` locally and reads files from disk. **It makes no network requests**: no telemetry, no uploads, no account. The HTML report is a single self-contained file with no external scripts, fonts or trackers, so it opens offline and you decide who sees it.

## FAQ

<details>
<summary><b>My tests aren't in the report.</b></summary>

Tests change together with the code they cover, so they would crowd out the files you care about. Pass `--include-tests` to bring them back.
</details>

<details>
<summary><b>Is a hotspot bad?</b></summary>

Not by itself. A hotspot is where your team spends its time. A hotspot that is also complex, full of bug fixes or owned by one person is where a refactor or more tests pay off most.
</details>

<details>
<summary><b>Does it work on huge repos?</b></summary>

Yes. It reads history with a single `git log` call. The Vite repo (600 commits/year, 1,600 files) takes under 3 seconds. For very large monorepos, scope to a folder or use `--max-commits`.
</details>

<details>
<summary><b>Why is my history empty in CI?</b></summary>

CI checkouts are shallow by default. Use `actions/checkout` with `fetch-depth: 0`.
</details>

## How it compares

| | repoheat | [code-maat](https://github.com/adamtornhill/code-maat) | [code-complexity](https://github.com/simonrenoult/code-complexity) | [CodeScene](https://codescene.com) |
|---|:-:|:-:|:-:|:-:|
| One command, no install | ✅ `npx` | ❌ Java + manual git export | ✅ | ❌ hosted |
| Any language | ✅ | ✅ | partial (some metrics are JS/TS only) | ✅ |
| Interactive visual map | ✅ | ❌ | ❌ | ✅ |
| Ownership, bus factor, coupling | ✅ | ✅ | ❌ | ✅ |
| Runs fully offline | ✅ | ✅ | ✅ | ❌ |
| Free & open source | ✅ | ✅ | ✅ | ❌ commercial |

CodeScene and code-maat are the deeper, more established tools. repoheat aims to be the fastest way to get the answer and to share it.

## Gallery

The [hotspot gallery](https://ebxc-7s13.github.io/repoheat/gallery/) shows heatmaps of React, Vue, Svelte, Vite, Tailwind, Express, Django, Flask, FastAPI, Rails, Gin, Ollama, Tokio and uv. A scheduled GitHub Action rebuilds it every week. Want another project in it? Add it to [`scripts/gallery.json`](scripts/gallery.json) and open a PR.

## Share your heatmap 🔥

Ran repoheat on your project? Post the image in [Discussions → Show and tell](https://github.com/ebxc-7s13/repoheat/discussions). The best ones get featured here.

## Contributing

Contributions are very welcome. See [CONTRIBUTING.md](CONTRIBUTING.md). Good first issues are labelled [`good first issue`](https://github.com/ebxc-7s13/repoheat/labels/good%20first%20issue).

## License

[MIT](LICENSE)
