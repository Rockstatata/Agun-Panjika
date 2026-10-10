# Serial merge review — 11 October 2026 (Asia/Dhaka)

Verified main: `735e1a420bd7ddb50dcc40f11fbcc370b98cb315`. README #1 and design system #2 were already manually merged. PR preparation did not merge or enable auto-merge on any PR.

## Manual order

Merge #3 → #4 → #5 → #6 → #7 → #8 → #9, then the separate regression-harness PR. Use **Create a merge commit** to retain the shared ancestry. Keep every PR's base as main; do not merge the full preview or old Soft Earth history. Recheck the next PR after each manual merge. README #10 is independent and contains README plus four genuine preview screenshots only.

| PR | Branch | Verified head | Predecessor | Serial simulation |
| --- | --- | --- | --- | --- |
| [3](https://github.com/Rockstatata/Agun-Panjika/pull/3) | `feat/navigation-state` | `5473168` | #2 | Clean |
| [4](https://github.com/Rockstatata/Agun-Panjika/pull/4) | `feat/3d-geospatial-experience` | `41e1071` | #3 | Clean |
| [5](https://github.com/Rockstatata/Agun-Panjika/pull/5) | `feat/charts-calendar-polish` | `13c0f41` | #4 | Clean |
| [6](https://github.com/Rockstatata/Agun-Panjika/pull/6) | `feat/map-exploration` | `7b051ce` | #5 | Clean |
| [7](https://github.com/Rockstatata/Agun-Panjika/pull/7) | `feat/loading-reliability` | `cbbb934` | #6 | Clean |
| [8](https://github.com/Rockstatata/Agun-Panjika/pull/8) | `feat/accessibility-performance` | `770c247` | #7 | Clean |
| [9](https://github.com/Rockstatata/Agun-Panjika/pull/9) | `feat/demo-storytelling` | `c2cc8a7` | #8 | Clean |

Earlier stages are ancestors of each subsequent branch. Until their predecessors merge, later PR diffs include those earlier features; they become feature-specific after the predecessor is merged. No branches were deleted, histories rewritten, force-pushes issued or original main files removed.

## Conflict resolutions

- Navigation's focusable main/skip link and persistent state preserve the premium header and mission banner.
- The geographic globe preserves the mission hero and combined preview grouping.
- All added navigation, calendar, chart and request/recovery styles are retained.
- Sensor story arrays and checkbox transformations share the persistent URL setter.
- Map exploration's geographic selection, clamped week, layers and retry coexist with static-source URL state, scientific provenance and a keyboard-focusable fallback table.
- Reliability's request statuses, offline notice and retryable error boundary coexist with lazy routes and Suspense.
- DemoTour and sensor series selections coexist with all preceding upgrades.

The final implementation was compared with `preview/agun-v2`. Remaining source differences are import/CSS block ordering and placement of request/status controls; the required features are retained and verified through browser flows. Preview-only QA scripts, package test dependencies and historical evidence are isolated in the following regression PR, preserving the current README and application sources.

## Verification

- Fresh npm install, typecheck and build passed on every updated feature branch.
- Python: 50 passed, 9 optional raw-input cases skipped per branch.
- Original feature heads and predecessor ancestry checked; synthetic merge-tree simulation of every sequential merge produces each expected feature tree with no conflict. No ref was changed by simulation.
- Pipeline, existing tests, exported scientific data and deployment files are byte-identical to main. CSV files, weather/forecast JSON and RSS/CAP bytes also match through HTTP/browser downloads.
- Production integration: all 10 browser groups passed, including 42 route/theme/language/viewport captures, navigation/history/filter persistence, geographic interaction/fallback, charts/calendar/local geography, fault/retry/race handling, guided-demo restore, PNG/CSV/PDF/clipboard/audio and cached offline reload.
- Zero document overflow, page/console exceptions, unexpected alerts or axe WCAG 2A/AA/2.1AA findings in the 42 views.
- Representative desktop dark and mobile light screenshots were visually inspected.
- Local artifacts: `E:/projects/NASA SpaceApp/agun-upgrade-qa/github-readme-audit/serial-integration/`.

To repeat browser checks, build and start a production preview at the URL printed by Vite, then run `UPGRADE_OFFLINE=1 npm run test:upgrade -- http://127.0.0.1:4185 <output-directory>` from web. In PowerShell, set `$env:UPGRADE_OFFLINE = '1'` before the npm command. Offline coverage requires a production preview, not the dev server. Install Chromium with `npx playwright install chromium` if missing.

## Soft Earth

The original `preview/agun-v2` and `feat/soft-earth-globe-home` remain untouched. Its four additional commits are `ba5e933`, `ee84a32`, `71c348b`, `62c129d`. Only after all eight underlying upgrades have been manually integrated, fetch main, create `feat/soft-earth-globe-main`, apply only that delta, resolve any integration differences, run the scientific and Soft Earth browser checks, and open its clean main-targeted PR. The regression-harness PR should precede that step so the Soft Earth-specific QA changes have their baseline. No full Soft Earth/preview PR is opened now.

## Known limits

The 11 inherited npm advisories remain (3 moderate, 7 high, 1 critical). Nine Python cases need absent raw/intermediate detections. Native OS share sheets, physical printing, physical devices and assistive-technology sessions were not exercised; browser checks are not accessibility certification. Branch CI is not configured by the existing main-only daily workflow; local passes do not claim remote CI success. Later main-side edits or alternate merge strategies can require further integration checks.


Latest main CI at `735e1a4` [failed](https://github.com/Rockstatata/Agun-Panjika/actions/runs/38073014721) in: Run pipeline. Downstream checks/deployment were skipped by that workflow; the failure also predates these conflict-resolution pushes. Root cause is not established by step metadata. Local feature and browser passes do not resolve or override that remote failure. Scientific regeneration and deployment were not changed in this task.

Current machine-readable evidence: [serial-integration.json](upgrade-progress/serial-integration.json). Current combined screenshots: [desktop](upgrade-progress/screenshots/serial-home-desktop.png), [mobile](upgrade-progress/screenshots/serial-home-mobile.png). They show the integrated original eight upgrades, before the separate Soft Earth delta.
