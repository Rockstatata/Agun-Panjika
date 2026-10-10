# Reviewing the original and upgraded application

> Historical evidence for `preview/agun-v2` at `c56486e`, captured on 2026-10-10. Branch heads, main status and localhost servers described below are that audit snapshot. For the current serial integration and manual PR order, see [SERIAL_MERGE_REVIEW.md](SERIAL_MERGE_REVIEW.md). This document does not claim those servers are currently running.

No branch switching or merging is needed. The original main checkout remains at E:/projects/NASA SpaceApp/Agun-Panjika. A detached worktree of exactly the same baseline commit serves the original version for comparison.

## Running previews in this workspace

| Version | Worktree | Branch | Port |
|---|---|---|---|
| Original | agun-original-preview | detached origin/main eef030f | 5272 |
| Combined | agun-v2-preview | preview/agun-v2 | 5270 |
| Combined production build | agun-v2-preview/web | preview/agun-v2 | 4175 |
| ui-design-system | agun-ui-design | feat/ui-design-system | 5271 |
| navigation-state | agun-navigation | feat/navigation-state | 5273 |
| 3d-geospatial-experience | agun-globe | feat/3d-geospatial-experience | 5274 |
| charts-calendar-polish | agun-charts | feat/charts-calendar-polish | 5275 |
| map-exploration | agun-map | feat/map-exploration | 5276 |
| loading-reliability | agun-reliability | feat/loading-reliability | 5277 |
| accessibility-performance | agun-accessibility | feat/accessibility-performance | 5278 |
| demo-storytelling | agun-demo | feat/demo-storytelling | 5279 |

Original, combined development, combined production and independent design previews were started and HTTP-verified. Other individual feature ports are available when launched. Stop a server with Ctrl+C in its terminal; choose an unused port if a later session occupies one.

For simultaneous comparison, run this PowerShell command from any folder, changing the target worktree and port using the table:

```powershell
node "E:/projects/NASA SpaceApp/agun-v2-preview/web/scripts/upgrade-preview.mjs" "E:/projects/NASA SpaceApp/agun-map" 5276
```

The launcher changes to the target web directory before starting Vite, binds localhost only, fails on occupied ports and uses a separate cache for each worktree. The existing workspace shares installed dependencies; npm ci is unnecessary here.

To use a fresh checkout with its own dependencies:

```powershell
git fetch origin
git worktree add -b review-agun-v2 ../agun-v2-review origin/preview/agun-v2
cd ../agun-v2-review/web
npm ci
npm run dev -- --host 127.0.0.1 --port 5270 --strictPort
```

To review another branch, substitute origin/feat/map-exploration (or another exact branch above) and use a new review branch/worktree name. The original feature branches remain available to accept, reject or revise independently. Returning to the original means opening port 5272 or the untouched main checkout; no reset or checkout is required.

Production preview:

```powershell
cd "E:/projects/NASA SpaceApp/agun-v2-preview/web"
npm run build
npm run preview -- --host 127.0.0.1 --port 4175 --strictPort
```

Use ?lang=en&theme=dark#/home?r=bgd&y=2024&w=14 to compare the same real historical period. Theme and language toggles work; Start demo walks through the evidence and restores prior filters when exited.

## Repeat browser verification

In a fresh checkout, install Chromium once with npx playwright install chromium. Start the preview server, then run:

```powershell
npm run test:upgrade -- http://127.0.0.1:5270
```

For the production-only offline test:

```powershell
$env:UPGRADE_OFFLINE = "1"
npm run test:upgrade -- http://127.0.0.1:4175
Remove-Item Env:UPGRADE_OFFLINE
```

Artifacts default to ignored web/test-results/upgrade. A second argument selects an external output directory. Tests cover rendering/accessibility, state/history, maps/globe, calendar/charts, injected failures, demo restoration, exports, weather/cross-border controls and offline caching. Fault injection blocks service workers so intercepted failures are deterministic; offline tests independently enable and exercise the real production worker.

Performance comparison uses two production previews:

```powershell
node scripts/upgrade/performance.mjs http://127.0.0.1:4175 http://127.0.0.1:4176
```

It records three fresh Chromium contexts per version and bundle gzip sizes. It does not claim a Lighthouse score or physical mobile timing.
