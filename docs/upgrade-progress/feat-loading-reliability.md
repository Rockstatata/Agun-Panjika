# feat/loading-reliability

## Current Status
- Status: implemented, independently tested, pushed and integrated into preview/agun-v2.
- Base: origin/main `eef030f663fc8f2918d7c9a07da76ef68bd5a1ce`; independent worktree `agun-reliability`.
- Updated: 2026-10-10 (Asia/Dhaka).
- Current task: final documentation; no implementation work remains in this feature.

## Completed Work
Hide old data before new selections render, suppress late responses, explicit skeleton/error/retry, bounded promise cache, timeout and JSON metadata validation, offline notice, export/clipboard failures. Fixed duplicate citation keys and CORS font access.

## Files Changed
- `web/index.html`
- `web/src/App.tsx`
- `web/src/components/RequestStatus.tsx`
- `web/src/components/ShareButton.tsx`
- `web/src/index.css`
- `web/src/lib/data.ts`
- `web/src/screens/Borders.tsx`
- `web/src/screens/Home.tsx`
- `web/src/screens/MapScreen.tsx`
- `web/src/screens/Method.tsx`
- `web/src/screens/OutlookScreen.tsx`
- `web/src/screens/Panjika.tsx`
- `web/src/screens/Sensors.tsx`

## Tests Executed
- Automated pass: npm run typecheck; npm run build.
- Automated pass: isolated Python suite, 50 passed and 9 skipped. Skips require absent raw/intermediate detections.parquet; no scientific exports regenerated.
- Automated pass: 28 independent Playwright views across seven routes, desktop light/dark English and mobile English/Bangla; no page exceptions, app alerts or document overflow.
- Feature interaction evidence: Injected delayed region switch, manifest 503/retry and invalid JSON. Follow-up isolated Method/PNG test has zero console errors. Final preview checks CSV byte parity, PNG, clipboard denial and share denial.
- Automated pass: pipeline/, tests/, web/public/data/ and .github/ byte-identical to origin/main.
- Code review: React hooks, cleanup, lazy loading, localization, semantic controls and data contracts inspected.

## Regression Checks
All original screens remain available. Scientific calculations and exported datasets are unchanged. Dedicated combined-preview tests exercise downloads, print, share, offline and cross-feature flows; see preview docs/UPGRADE_REGRESSION.md.

## Visual Review
- Captures: `E:/projects/NASA SpaceApp/agun-upgrade-qa/loading-reliability/`.
- Representative captures visually inspected; screenshots are evidence of rendering, not a claim that every browser or physical mobile device was tested.
- Local startup: `cd E:/projects/NASA SpaceApp/agun-reliability/web` then `npm run dev -- --host 127.0.0.1 --port 5277 --strictPort`.
- Local URL: http://127.0.0.1:5277/ (when started). These worktrees already have installed shared dependencies; fresh checkouts require npm ci.

## Git History
- Branch: `feat/loading-reliability`.
- Implementation source commits (chronological):
  - `4098c571e68574378d0bd6afac7a421408133374` - feat(loading-reliability): prevent stale scientific views and add explicit request and export recovery
  - `854d476243123dcdd6778b73cd7e6c41f19aa789` - fix(reliability): make export fonts readable and citation keys unique

- Implementation commits pushed successfully; final documentation push recorded in preview Git manifest.
- Integrated by cherry-pick only into preview/agun-v2; conflicts resolved there. main remains unchanged.

## Known Issues
- Nine raw-input Python tests skip; native operating-system file sharing is unavailable in headless Chromium.
- External map tiles/fonts require network. Offline mode supports previously visited same-origin resources.
- Existing npm dependency audit has 11 vulnerabilities (3 moderate, 7 high, 1 critical); all affected versions match the baseline. Package migration is still required before a release claim.

## Next Steps
Review the combined preview; any merge into main requires the user's explicit later instruction.
