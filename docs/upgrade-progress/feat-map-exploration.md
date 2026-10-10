# feat/map-exploration

## Current Status
- Base: independently created from origin/main eef030f663fc8f2918d7c9a07da76ef68bd5a1ce.
- Updated: 2026-10-10 (Asia/Dhaka).
- Implemented: add regional hotspot clusters, scientific layers and graceful map recovery

## Tests Executed
- npm run typecheck and npm run build: passed.
- Isolated Python environment, python -m pytest -q: passed; missing raw-data tests skipped (see phase pytest evidence).
- Playwright: 28 route/theme/language/viewport captures, no page errors, app alerts or document overflow.
- Pipeline, historical scientific JSON and deployment workflow: byte-identical to origin/main (git diff --exit-code).
- React review: hooks, cleanup, lazy resources, localized labels and semantic controls reviewed.

## Visual Review
- Screenshots and machine-readable results: E:\projects\NASA SpaceApp\agun-upgrade-qa\map-exploration.
- Desktop light/dark, mobile English and mobile Bangla inspected.
- Each feature is independently served by Vite during verification; start with cd web; npm run dev -- --host 127.0.0.1 --port 5271 (choose an unused port).

## Git History
- Branch: feat/map-exploration.
- Commit: obtain exact SHA with git log -1; consolidated source SHA is recorded in preview UPGRADE_PROGRESS.md after cherry-pick.
- Push and integration: finish script records verified remote push and ordered preview integration.

## Known Issues
- Raw pipeline inputs are unavailable; those tests skip without regenerating historical exports.
- Browser smoke verifies rendering; dedicated final interaction tests cover cross-feature flows, exports, offline and fallback.
- External basemap/font connectivity is an environment dependency.
