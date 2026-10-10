# feat/accessibility-performance

## Current Status
- Status: implemented, independently tested, pushed and integrated into preview/agun-v2.
- Base: origin/main `eef030f663fc8f2918d7c9a07da76ef68bd5a1ce`; independent worktree `agun-accessibility`.
- Updated: 2026-10-10 (Asia/Dhaka).
- Current task: final documentation; no implementation work remains in this feature.

## Completed Work
Lazy route chunks, minimum touch sizes, local table scrolling, Bangla line height, reduced motion, responsive sizing, live system-theme subscription, dark print ink, memoized tooltip context.

## Files Changed
- `web/src/App.tsx`
- `web/src/components/CalendarHeatmap.tsx`
- `web/src/components/Outlook.tsx`
- `web/src/components/Tooltip.tsx`
- `web/src/index.css`
- `web/src/lib/useWidth.ts`
- `web/src/screens/MapScreen.tsx`
- `web/src/screens/Method.tsx`
- `web/src/screens/OutlookScreen.tsx`
- `web/src/screens/Sensors.tsx`

## Tests Executed
- Automated pass: npm run typecheck; npm run build.
- Automated pass: isolated Python suite, 50 passed and 9 skipped. Skips require absent raw/intermediate detections.parquet; no scientific exports regenerated.
- Automated pass: 28 independent Playwright views across seven routes, desktop light/dark English and mobile English/Bangla; no page exceptions, app alerts or document overflow.
- Feature interaction evidence: 35 axe/responsive route checks across 360/390/768/1280/1440: zero violations. All 28 branch screenshots render. Final combined 42-view checks cover both themes and languages.
- Automated pass: pipeline/, tests/, web/public/data/ and .github/ byte-identical to origin/main.
- Code review: React hooks, cleanup, lazy loading, localization, semantic controls and data contracts inspected.

## Regression Checks
All original screens remain available. Scientific calculations and exported datasets are unchanged. Dedicated combined-preview tests exercise downloads, print, share, offline and cross-feature flows; see preview docs/UPGRADE_REGRESSION.md.

## Visual Review
- Captures: `E:/projects/NASA SpaceApp/agun-upgrade-qa/accessibility-performance/`.
- Representative captures visually inspected; screenshots are evidence of rendering, not a claim that every browser or physical mobile device was tested.
- Local startup: `cd E:/projects/NASA SpaceApp/agun-accessibility/web` then `npm run dev -- --host 127.0.0.1 --port 5278 --strictPort`.
- Local URL: http://127.0.0.1:5278/ (when started). These worktrees already have installed shared dependencies; fresh checkouts require npm ci.

## Git History
- Branch: `feat/accessibility-performance`.
- Implementation source commits (chronological):
  - `10cdacd5fcb5f47f6c02da55dee7075346aecb73` - feat(accessibility-performance): split route bundles and improve keyboard, touch, contrast and print accessibility

- Implementation commits pushed successfully; final documentation push recorded in preview Git manifest.
- Integrated by cherry-pick only into preview/agun-v2; conflicts resolved there. main remains unchanged.

## Known Issues
- Nine raw-input Python tests skip; native operating-system file sharing is unavailable in headless Chromium.
- External map tiles/fonts require network. Offline mode supports previously visited same-origin resources.
- Existing npm dependency audit has 11 vulnerabilities (3 moderate, 7 high, 1 critical); all affected versions match the baseline. Package migration is still required before a release claim.

## Next Steps
Review the combined preview; any merge into main requires the user's explicit later instruction.
