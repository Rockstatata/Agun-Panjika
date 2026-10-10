# feat/navigation-state

## Current Status
- Status: implemented, independently tested, pushed and integrated into preview/agun-v2.
- Base: origin/main `eef030f663fc8f2918d7c9a07da76ef68bd5a1ce`; independent worktree `agun-navigation`.
- Updated: 2026-10-10 (Asia/Dhaka).
- Current task: final documentation; no implementation work remains in this feature.

## Completed Work
Four primary destinations and More; preserved hash routes, region/year/week/sensors/kilns/ranges, URL/history/local storage, language/theme. Fixed UTF-8 identity and lazy section scrolling.

## Files Changed
- `web/src/App.tsx`
- `web/src/components/Navigation.tsx`
- `web/src/index.css`
- `web/src/lib/router.ts`
- `web/src/screens/MapScreen.tsx`
- `web/src/screens/Method.tsx`
- `web/src/screens/Sensors.tsx`

## Tests Executed
- Automated pass: npm run typecheck; npm run build.
- Automated pass: isolated Python suite, 50 passed and 9 skipped. Skips require absent raw/intermediate detections.parquet; no scientific exports regenerated.
- Automated pass: 28 independent Playwright views across seven routes, desktop light/dark English and mobile English/Bangla; no page exceptions, app alerts or document overflow.
- Feature interaction evidence: Legacy links, carried filters, sensor selection, back/reload, mobile More, downloads/validation section destinations, Escape.
- Automated pass: pipeline/, tests/, web/public/data/ and .github/ byte-identical to origin/main.
- Code review: React hooks, cleanup, lazy loading, localization, semantic controls and data contracts inspected.

## Regression Checks
All original screens remain available. Scientific calculations and exported datasets are unchanged. Dedicated combined-preview tests exercise downloads, print, share, offline and cross-feature flows; see preview docs/UPGRADE_REGRESSION.md.

## Visual Review
- Captures: `E:/projects/NASA SpaceApp/agun-upgrade-qa/navigation-state/`.
- Representative captures visually inspected; screenshots are evidence of rendering, not a claim that every browser or physical mobile device was tested.
- Local startup: `cd E:/projects/NASA SpaceApp/agun-navigation/web` then `npm run dev -- --host 127.0.0.1 --port 5273 --strictPort`.
- Local URL: http://127.0.0.1:5273/ (when started). These worktrees already have installed shared dependencies; fresh checkouts require npm ci.

## Git History
- Branch: `feat/navigation-state`.
- Implementation source commits (chronological):
  - `7d231b032889493141421e559588eb5c2d9bae00` ? feat(navigation-state): preserve shareable filters and simplify desktop and mobile navigation
  - `b86f52b16b7c6567c8d1b0d90d04fa9efe1ec121` ? fix(navigation): preserve UTF-8 identity and await lazy section destinations

- Implementation commits pushed successfully; final documentation push recorded in preview Git manifest.
- Integrated by cherry-pick only into preview/agun-v2; conflicts resolved there. main remains unchanged.

## Known Issues
- Nine raw-input Python tests skip; native operating-system file sharing is unavailable in headless Chromium.
- External map tiles/fonts require network. Offline mode supports previously visited same-origin resources.
- Existing npm dependency audit has 11 vulnerabilities (3 moderate, 7 high, 1 critical); all affected versions match the baseline. Package migration is still required before a release claim.

## Next Steps
Review the combined preview; any merge into main requires the user's explicit later instruction.
