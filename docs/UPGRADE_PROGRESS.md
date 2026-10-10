# Agun Panjika Upgrade Progress

> Historical evidence for `preview/agun-v2` at `c56486e`, captured on 2026-10-10. Branch heads, main status and localhost servers described below are that audit snapshot. For the current serial integration and manual PR order, see [SERIAL_MERGE_REVIEW.md](SERIAL_MERGE_REVIEW.md). This document does not claim those servers are currently running.

## Current Status
- Active branch: preview/agun-v2.
- Verified base and untouched main: eef030f663fc8f2918d7c9a07da76ef68bd5a1ce.
- Updated: 2026-10-10 (Asia/Dhaka).
- Implementation: all eight independent feature branches complete, documented and pushed.
- Current task: ready for user review. Ten production browser test groups pass, including offline and failure recovery. See UPGRADE_REGRESSION.md for exact evidence and limitations.
- No main merges, production publishing or deployment workflow edits.

## Feature Status
| Feature | Branch | Initial source | Follow-up source | Branch head including documentation |
|---|---|---|---|---|
| ui-design-system | feat/ui-design-system | `dde89c7ae329025a6d4485217b0b53c35a458b90` | `58c856079c352451d0c4b90ca5cf1e900f333d33` | `568d31a069df4f3bf147624b60735ede9f03f695` |
| navigation-state | feat/navigation-state | `7d231b032889493141421e559588eb5c2d9bae00` | `b86f52b16b7c6567c8d1b0d90d04fa9efe1ec121` | `d9ae2c1261d01b5a358b3096d9c583fea57967de` |
| 3d-geospatial-experience | feat/3d-geospatial-experience | `0e331961bd7b871a96359d1c14dd8dd9e1903ac7` | None | `67c8d980d6d049101b0363f0867756624c2a768a` |
| charts-calendar-polish | feat/charts-calendar-polish | `39aa0389a3e7c08b1a3edffe6d7c92cec8462327` | `6faeaa0be25bed28f9ac39eca16238792fb1838b` | `3af5d2e40367ec17d996e36cd4d78387741276e9` |
| map-exploration | feat/map-exploration | `8c577919745df3e0e3565e2e72fe2036875ea69c` | None | `c78103b7aa6ea3443d0dbf97425f331f8da597ec` |
| loading-reliability | feat/loading-reliability | `4098c571e68574378d0bd6afac7a421408133374` | `854d476243123dcdd6778b73cd7e6c41f19aa789` | `aa9c85967f2c9a0918ecfee1fd2daceaffe29e81` |
| accessibility-performance | feat/accessibility-performance | `10cdacd5fcb5f47f6c02da55dee7075346aecb73` | None | `01c78ac3d5ea2db7ce18440e771a5ae38edcb195` |
| demo-storytelling | feat/demo-storytelling | `fd3023a9d17fdaa73383ec45a0a53b629c62bfcf` | None | `b4fa0ba5e178ab48ec0d52531c6a273d2b6bb8ce` |

All feature branches passed typecheck, production build, 50 Python tests (9 raw-input skips), and 28 independent browser captures. Each feature's detailed document lists its interaction checks. All were cherry-picked into preview in the requested phase order; the four final fixes followed in navigation, charts, reliability, design order. Documentation commits were then cherry-picked in phase order. Exact history: [Git manifest](upgrade-progress/git-manifest.json).

## Completed Work
- Premium navy/ivory scientific design with English/Bangla and light/dark support.
- Four primary destinations, all original routes, shareable persistent filters and browser history.
- Lazy geographic sphere using real FIRMS coordinates; rotation/zoom, district selection and 2D mode work without WebGL.
- Calendar week/year selection, keyboard inspection, table alternatives and a clear sensor comparison story.
- Real hotspot clusters, choropleth, static-source layers, geographic focus and map recovery.
- Visible loading/errors/retries, stale-response prevention, JSON validation, bounded cache and export error handling.
- Responsive/accessibility refinement, deferred route bundles, reduced motion and corrected dark printing.
- Optional seven-step bilingual demo with restored user filters on Finish/Exit/Escape.

## Regression and scientific safeguards
Typecheck and build pass. Python: 50 passed, 9 skipped. The 42-view production route suite covers 360/390/768/1280/1440, both themes and languages with zero overflow, page exceptions, console errors or axe findings. Tested actions include exports, PDF, clipboard, geographic selection, local calendar, audio, history, demo restore, network/JSON failure recovery, tile retry, weather feeds and offline cached reload.

Pipeline, tests, scientific data, and .github workflows are byte-identical to origin/main. CSV and alert/weather exports were also compared byte for byte through HTTP. Acquisition times, FRP and per-point confidence are not fabricated.

## Visual Review
Representative independent and combined captures inspected for typography, contrast, spacing, charts, maps and Bangla. Complete phase and final capture sets remain in the sibling agun-upgrade-qa directory. Selected before/after screenshots are committed in [screenshots](upgrade-progress/screenshots/).

## Review and startup
- Combined development preview: http://127.0.0.1:5270/?lang=en&theme=dark#/home?r=bgd&y=2024&w=14
- Combined production preview: http://127.0.0.1:4175/?lang=en&theme=dark#/home?r=bgd&y=2024&w=14
- Original base: http://127.0.0.1:5272/?lang=en&theme=dark#/home?r=bgd&y=2024&w=14
- Independent design feature: http://127.0.0.1:5271/?lang=en&theme=dark#/home?r=bgd&y=2024&w=14
- Exact worktree/branch commands: [Local preview guide](UPGRADE_PREVIEW.md).

## Remaining and Known Issues
- Implementation work complete; user review and any later merge decision remain.
- Nine Python tests skip because raw/intermediate inputs are absent.
- Native operating-system share sheets and physical printing are not available in headless Chromium; PNG download and browser PDF are verified.
- Offline support is for cached same-origin pages/data; third-party fonts and map tiles require network.
- npm audit: 11 pre-existing vulnerabilities, including one critical in the existing MapLibre stack; all affected versions match the original lockfile. Resolve these before claiming release readiness.
- Automated axe checks are not a full accessibility certification. Physical device, assistive technology and heap-profiler testing were not performed.

## Files Changed
App shell, shared navigation/router state, theme CSS, scientific screen presentation, geographic components/helpers, request/recovery UI, demo, and preview-only QA scripts/docs. No scientific pipeline, test, exported-data or deployment files changed.

## Tests Executed
- npm run typecheck: passed.
- npm run build: passed.
- Isolated python -m pytest -q: 50 passed, 9 skipped, zero failures.
- Production npm run test:upgrade with UPGRADE_OFFLINE=1: 10 groups passed; 42 route/theme/language/viewport captures.
- Before/after production performance: three fresh browser contexts per version; raw timings and bundles recorded.
- Remote feature heads, original main SHA and protected-path parity verified.
- Machine-readable final evidence: [QA results](upgrade-progress/qa-results.json).

## Git History
Feature implementation and documentation SHAs are in the table and Git manifest. The combined preview contains the ordered cherry-picks, final regression harness and review evidence. Original and all independent worktrees are clean. No implementation work remains; any main merge is reserved for a later explicit user instruction.
