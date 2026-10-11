# feat/3d-geospatial-experience

## Current Status
- Status: implemented, independently tested, pushed and integrated into preview/agun-v2.
- Base: origin/main `eef030f663fc8f2918d7c9a07da76ef68bd5a1ce`; independent worktree `agun-globe`.
- Updated: 2026-10-10 (Asia/Dhaka).
- Current task: final documentation; no implementation work remains in this feature.

## Completed Work
Lazy orthographic Canvas Earth with Natural Earth land, true FIRMS coordinates, polygon-based region linking, weekly/year filtering, pointer and keyboard rotation/zoom, Mercator fallback.

## Files Changed
- `web/package-lock.json`
- `web/package.json`
- `web/public/geo/README.md`
- `web/public/geo/land.json`
- `web/src/components/EarthCanvas.tsx`
- `web/src/components/Globe.css`
- `web/src/components/GlobePanel.tsx`
- `web/src/lib/spatial.ts`
- `web/src/screens/Home.tsx`

## Tests Executed
- Automated pass: npm run typecheck; npm run build.
- Automated pass: isolated Python suite, 50 passed and 9 skipped. Skips require absent raw/intermediate detections.parquet; no scientific exports regenerated.
- Automated pass: 28 independent Playwright views across seven routes, desktop light/dark English and mobile English/Bangla; no page exceptions, app alerts or document overflow.
- Feature interaction evidence: WebGL disabled: globe zoom, keyboard rotation, pointer drag, 2D switch and real archived period. Final preview also verifies a projected real point selects a district.
- Automated pass: pipeline/, tests/, web/public/data/ and .github/ byte-identical to origin/main.
- Code review: React hooks, cleanup, lazy loading, localization, semantic controls and data contracts inspected.

## Regression Checks
All original screens remain available. Scientific calculations and exported datasets are unchanged. Dedicated combined-preview tests exercise downloads, print, share, offline and cross-feature flows; see preview docs/UPGRADE_REGRESSION.md.

## Visual Review
- Captures: `E:/projects/NASA SpaceApp/agun-upgrade-qa/3d-geospatial-experience/`.
- Representative captures visually inspected; screenshots are evidence of rendering, not a claim that every browser or physical mobile device was tested.
- Local startup: `cd E:/projects/NASA SpaceApp/agun-globe/web` then `npm run dev -- --host 127.0.0.1 --port 5274 --strictPort`.
- Local URL: http://127.0.0.1:5274/ (when started). These worktrees already have installed shared dependencies; fresh checkouts require npm ci.

## Git History
- Branch: `feat/3d-geospatial-experience`.
- Implementation source commits (chronological):
  - `0e331961bd7b871a96359d1c14dd8dd9e1903ac7` ? feat(3d-geospatial-experience): add a lazy geographic sphere with real FIRMS points and 2D fallback

- Implementation commits pushed successfully; final documentation push recorded in preview Git manifest.
- Integrated by cherry-pick only into preview/agun-v2; conflicts resolved there. main remains unchanged.

## Known Issues
- Nine raw-input Python tests skip; native operating-system file sharing is unavailable in headless Chromium.
- External map tiles/fonts require network. Offline mode supports previously visited same-origin resources.
- Existing npm dependency audit has 11 vulnerabilities (3 moderate, 7 high, 1 critical); all affected versions match the baseline. Package migration is still required before a release claim.

## Next Steps
Review the combined preview; any merge into main requires the user's explicit later instruction.
