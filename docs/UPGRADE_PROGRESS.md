# Agun Panjika Upgrade Progress

## Current Status
- Active branch: preview/agun-v2.
- Base commit: eef030f663fc8f2918d7c9a07da76ef68bd5a1ce.
- Last updated: 2026-10-10 (Asia/Dhaka).
- Current task: baseline verification and independent feature implementation.

## Feature Status
| Feature | Status | Branch | Source commit | Tests | Preview |
|---|---|---|---|---|---|

## Evidence
Baseline screenshots and browser results: sibling `agun-upgrade-qa/baseline`. Each phase has its own evidence directory and detailed document under docs/upgrade-progress.

## Git and review
Original main remains in `../Agun-Panjika`. Combined preview runs from this checkout with `cd web; npm run dev -- --host 127.0.0.1 --port 5270`. Each individual feature has a sibling worktree and can be served on a different available port. Branch switching is unnecessary; all versions can coexist.

## Remaining Work
All eight feature acceptance checks, integration QA, scientific-data integrity review, export/offline/fallback tests, performance measurement and final regression matrix.
