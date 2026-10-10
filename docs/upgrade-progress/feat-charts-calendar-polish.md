# feat/charts-calendar-polish

> Historical independent-feature evidence from the original preview audit. The implementation SHAs and main/merge status below describe that snapshot. For current branch heads, preservation checks and manual dependencies, see [the serial review](../SERIAL_MERGE_REVIEW.md).

## Current Status
- Status: implemented, independently tested, pushed and integrated into preview/agun-v2.
- Base: origin/main `eef030f663fc8f2918d7c9a07da76ef68bd5a1ce`; independent worktree `agun-charts`.
- Updated: 2026-10-10 (Asia/Dhaka).
- Current task: final documentation; no implementation work remains in this feature.

## Completed Work
Calendar mouse/keyboard week/year selection, selected-week details, sensor comparison story, keyboard chart inspection, annual table, observed/estimated/bridged/mixed source labels.

## Files Changed
- `web/src/components/AnnualChart.tsx`
- `web/src/components/CalendarHeatmap.tsx`
- `web/src/index.css`
- `web/src/screens/Panjika.tsx`
- `web/src/screens/Sensors.tsx`

## Tests Executed
- Automated pass: npm run typecheck; npm run build.
- Automated pass: isolated Python suite, 50 passed and 9 skipped. Skips require absent raw/intermediate detections.parquet; no scientific exports regenerated.
- Automated pass: 28 independent Playwright views across seven routes, desktop light/dark English and mobile English/Bangla; no page exceptions, app alerts or document overflow.
- Feature interaction evidence: Calendar click and Arrow/Enter selection, table alternatives, harmonisation shortcut and annual tooltip. Follow-up table keyboard focus and source labels typechecked/built.
- Automated pass: pipeline/, tests/, web/public/data/ and .github/ byte-identical to origin/main.
- Code review: React hooks, cleanup, lazy loading, localization, semantic controls and data contracts inspected.

## Regression Checks
All original screens remain available. Scientific calculations and exported datasets are unchanged. Dedicated combined-preview tests exercise downloads, print, share, offline and cross-feature flows; see preview docs/UPGRADE_REGRESSION.md.

## Visual Review
- Captures: `E:/projects/NASA SpaceApp/agun-upgrade-qa/charts-calendar-polish/`.
- Representative captures visually inspected; screenshots are evidence of rendering, not a claim that every browser or physical mobile device was tested.
- Local startup: `cd E:/projects/NASA SpaceApp/agun-charts/web` then `npm run dev -- --host 127.0.0.1 --port 5275 --strictPort`.
- Local URL: http://127.0.0.1:5275/ (when started). These worktrees already have installed shared dependencies; fresh checkouts require npm ci.

## Git History
- Branch: `feat/charts-calendar-polish`.
- Implementation source commits (chronological):
  - `39aa0389a3e7c08b1a3edffe6d7c92cec8462327` - feat(charts-calendar-polish): add precise calendar selection and accessible scientific chart exploration
  - `6faeaa0be25bed28f9ac39eca16238792fb1838b` - fix(charts): label mixed sources and support keyboard table scrolling

- Implementation commits pushed successfully; final documentation push recorded in preview Git manifest.
- Integrated by cherry-pick only into preview/agun-v2; conflicts resolved there. main remains unchanged.

## Known Issues
- Nine raw-input Python tests skip; native operating-system file sharing is unavailable in headless Chromium.
- External map tiles/fonts require network. Offline mode supports previously visited same-origin resources.
- Existing npm dependency audit has 11 vulnerabilities (3 moderate, 7 high, 1 critical); all affected versions match the baseline. Package migration is still required before a release claim.

## Next Steps
Review the combined preview; any merge into main requires the user's explicit later instruction.
