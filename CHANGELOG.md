# Changelog

## 0.1.2

- First release on npm: `npx repoheat` now works everywhere.
- `NO_COLOR` always disables colour, even when `FORCE_COLOR` is set; `FORCE_COLOR=0` turns colour off.

## 0.1.1

- GitHub Action now builds and runs its own code, so it works without the npm package. Pass `version` to run a specific npm release instead.
- Fix folder scoping on Windows when paths use 8.3 short names.
- New weekly hotspot gallery and installable website.

## 0.1.0

First release.

- Hotspot ranking from git churn × indentation complexity, for any language
- Interactive, self-contained HTML heatmap with zoom, search, six colour modes and PNG export
- Bug-fix counts, ownership, bus factor, knowledge risk and change coupling
- Terminal, `--json` and `--md` output
- Folder scoping, include/exclude globs, `.repoheatignore`, `--anonymize`
- GitHub Action that writes the report to the job summary
