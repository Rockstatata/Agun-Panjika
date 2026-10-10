# Agun Panjika Upgrade Progress

## Current Status
- Active branch: preview/agun-v2.
- Base commit: eef030f663fc8f2918d7c9a07da76ef68bd5a1ce.
- Last updated: 2026-10-10 (Asia/Dhaka).
- Current task: baseline verification and independent feature implementation.

## Feature Status
| Feature | Status | Branch | Source commit | Tests | Preview |
|---|---|---|---|---|---|
| charts-calendar-polish | Branch checks and chart/calendar interactions passed | feat/charts-calendar-polish | 39aa0389a3e7c08b1a3edffe6d7c92cec8462327 | build, typecheck, pytest, 28 views, keyboard/table checks | Cherry-picked; additive CSS conflict resolved |
| 3d-geospatial-experience | Branch checks and globe interactions passed | feat/3d-geospatial-experience | 0e331961bd7b871a96359d1c14dd8dd9e1903ac7 | build, typecheck, pytest, 28 views, WebGL-disabled interaction | Cherry-picked; Home integration retains hero and globe |
| navigation-state | Branch and interaction checks passed | feat/navigation-state | 7d231b032889493141421e559588eb5c2d9bae00 | build, typecheck, pytest, 28 views, back/reload/filter checks | Cherry-picked; App conflict resolved retaining design + focus |
| ui-design-system | Implemented, branch tests passed; integration QA pending | feat/ui-design-system | dde89c7ae329025a6d4485217b0b53c35a458b90 | build, typecheck, pytest, 28 browser views | Cherry-picked |

## Evidence
Baseline screenshots and browser results: sibling `agun-upgrade-qa/baseline`. Each phase has its own evidence directory and detailed document under docs/upgrade-progress.

## Git and review
Original main remains in `../Agun-Panjika`. Combined preview runs from this checkout with `cd web; npm run dev -- --host 127.0.0.1 --port 5270`. Each individual feature has a sibling worktree and can be served on a different available port. Branch switching is unnecessary; all versions can coexist.

## Remaining Work
All eight feature acceptance checks, integration QA, scientific-data integrity review, export/offline/fallback tests, performance measurement and final regression matrix.

Baseline Python: 50 passed, 9 skipped (raw pipeline inputs absent). Design integration: typecheck/build, 50 passed/9 skipped, 7 route screenshots passed.
