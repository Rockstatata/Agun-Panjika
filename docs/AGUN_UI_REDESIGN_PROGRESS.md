# Soft Earth redesign progress

## Baseline — 2026-10-10

Branch: `feat/soft-earth-globe-home`. Base: `preview/agun-v2` at
`c56486e2f7cc5ceec1bdf5633240575039539965`. This retains the eight completed
feature upgrades absent from main. Main remains at `eef030f`; neither main nor
the combined preview will be modified by this work.

Baseline verification: TypeScript and production build passed; Python suite
passed (50 passed, 9 skipped because optional raw inputs are absent). All 28
baseline browser views passed overflow and page-error checks. The baseline
helper did not execute axe in its default mode; WCAG checks are recorded below.
Evidence: sibling `agun-upgrade-qa/soft-earth-baseline`.

## Audit and implementation decision

Home currently uses a small vector Canvas globe. Existing MapLibre Explore,
calendar, comparison, outlook, borders, methodology, share/export/print,
localization, kiln filtering and the scientific pipeline remain available.

Use a lazy direct Three.js renderer with OrbitControls, local 2K geographic
textures, batched real-coordinate points and demand rendering. This avoids a
MapLibre major upgrade or a second React renderer. Retain the existing Canvas
map as a WebGL-independent fallback. No autorotation or perpetual animation.

Solar System Scope Earth day and cloud textures are CC BY 4.0; attribution will
ship with the assets and be visible in the UI. They are static geographic
context, not current satellite imagery or weather. FIRMS coordinates contain
longitude, latitude, ISO week and category, not FRP, confidence or acquisition
time. Controls and legends must reflect these actual fields. Unsupported
terrain and FRP controls from the visual reference are intentionally omitted.

Dependency audit retains 11 pre-existing advisories (3 moderate, 7 high,
1 critical); unrelated breaking dependency upgrades are outside this redesign.

## Next milestones

1. Light visual system, responsive composition and existing-data controls.
2. Textured Earth, interaction, graceful fallback and licensed local assets.
3. Browser/reference comparison, scientific regression, final branch push.

## Layout milestone
Shared light surfaces, serif hero, three real-data cards, district search, linked period/source controls and responsive filters implemented. Seasonal report and all navigation remain accessible. Typecheck, production build and Python checks passed. Seven route screenshots passed overflow and page-error checks (soft-earth-layout); axe was not enabled in that intermediate helper run. The interim renderer is replaced in the next milestone.


## Textured Earth milestone

Implemented direct Three.js + OrbitControls, 96 x 64 sphere geometry, local 2K
Earth/cloud textures, soft directional sunlight, subtle atmospheric rim,
geoBoundaries district outlines and batched real-coordinate FIRMS points.
Longitude mapping was verified by projecting a real 2024 W14 detection into
screen space and clicking it to select its district. Colors distinguish retained
and static sources, with no unsupported intensity claims. Satellite View hides
the observation layer. Data controls synchronize through existing URL state.

The renderer draws on demand, caps pixel ratio, disposes all GPU resources and
listeners, and provides light Canvas 2D fallback for unsupported WebGL, context
loss or failed surface imagery. No automatic motion; keyboard controls work with
reduced motion. The retained drawing buffer supports screenshots; textures and
Three load only on Home. Existing Explore continues to use MapLibre unchanged.

Search results now distinguish identically named regions and districts. Mobile
filters collapse by default; viewport changes restore desktop controls. A fixed
opaque bottom navigation exposed Chromium canvas occlusion: a 98% opaque
surface fixes it, covered by a screenshot-vs-render-buffer pixel regression.

TypeScript and production build passed. Initial 42-view WCAG/console/overflow
matrix passed. Actual CSV byte parity, PNG export, print/PDF, geographic point
selection, local calendars, audio and language/theme persistence passed.
Three interaction/fallback tests passed before the final pixel regression.
Final production suite and publication remain pending.

### Resource budget

Main JS 238.45 KB / 80.76 KB gzip (baseline 238.15 / 80.61). Three globe is a
separate 559 KB / 140.79 KB gzip chunk; day and cloud JPEGs total 1.43 MB.
No Three or Earth asset requests on a direct sensor-comparison visit.

The mobile pixel regression now passes after explicitly returning the test viewport to the top before sampling. Browser screenshots confirm the full globe renders correctly behind the translucent bottom navigation. All dedicated Three and no-WebGL tests pass.

## Current Branch

`feat/soft-earth-globe-home`, in the isolated `agun-soft-earth` worktree.

## Baseline Commit

`c56486e2f7cc5ceec1bdf5633240575039539965` (combined feature preview).
Main remains `eef030f663fc8f2918d7c9a07da76ef68bd5a1ce`.

## Overall Progress

Implementation, visual comparison and the complete production regression suite
are finished. Final delivery includes an explicit Retry 3D action for fallback
devices. Typecheck/build and the affected 3D, no-WebGL and offline regressions
were rerun after that wording/interaction refinement.

## Completed Tasks

- Soft light default, navy typography, coral active states and shared surfaces.
- Responsive hero, realistic geographic globe and compact real-data controls.
- Search distinguishes country, regions and districts with overlapping names.
- Linked region/year/week/static-source state, actual counts and seasonal status.
- Drag, zoom, keyboard rotation, focus, reset, hotspot metadata and selection.
- Static satellite context, local licensed clouds, geographic boundaries.
- Mobile collapsed filters and preserved bottom navigation; Bangla and dark mode.
- Demand rendering, lazy loading, cleanup, 2D fallback and context-loss handling.
- Preserved report, chart, map, outlook, calendar, validation and export workflows.

## Current Task / Remaining Tasks

All requested implementation and verification work is complete. The feature
branch is published; documentation and screenshots accompany the final delivery.
No main merge or production deployment was performed.

## Files Changed

- `web/src/components/Earth3D.tsx`: isolated Three renderer and GPU lifecycle.
- `GlobePanel.tsx`, `Globe.css`: overview composition and scientific controls.
- `EarthCanvas.tsx`: light 2D fallback using existing geographic projection.
- `ObservatoryIcon.tsx`: consistent overview card icons.
- `web/src/screens/Home.tsx`: refined overview above existing seasonal report.
- `web/src/App.tsx`, `web/src/index.css`, `web/index.html`: shared theme/header.
- `web/public/earth/`: two licensed textures and attribution.
- `web/package*.json`: Three 0.186.1 and matching TypeScript definitions.
- `web/scripts/upgrade/`: geographic, fallback, pixel and screenshot verification.

## Design Changes / Visual Screenshots

Actual production screenshots: [desktop](screenshots/soft-earth/desktop.png)
(1440 × 1080), [mobile](screenshots/soft-earth/mobile.png) (390 × 1100).
The reference informed the three-column composition, serif headline, icy blue
and cream background, white cards and coral controls. The result uses genuine
Bangladesh-only observations; regional fires, invented FRP classes and scenery
from the reference were not fabricated. All 42 route screenshots are retained
in the sibling QA directory `agun-upgrade-qa/soft-earth-production`.

## Globe Implementation Details

Three.js was selected over Cesium because the page needs one textured globe and
small local observation layers, not a terrain/3D Tiles platform. Upgrading the
existing MapLibre 4 renderer to add globe capabilities would unnecessarily
change the established Explore implementation. Direct Three avoids adding a
second React rendering framework. Surface and points share the same geographic
coordinate transform; real point selection is verified in the browser.

The renderer performs no idle animation, respects reduced motion by using direct
user-driven controls, and keeps one batched point layer. Pixel ratio is capped
at 1.5 on initial mobile mount and 2 otherwise. The drawing buffer is retained
for reliable image capture. Geometry, materials, textures, controls, observers,
events and animation frames are disposed on unmount. Surface load failure or
WebGL loss yields an interactive Canvas map; unavailable 3D can be retried.

## Tests Executed / Regression Results

Production suite at `http://127.0.0.1:4182`: **11 groups passed**.

| Check | Evidence |
| --- | --- |
| TypeScript / production build | Passed, no TypeScript errors |
| Python | 50 passed, 9 optional-input skips |
| Responsive routes | 42 views, 360/390/768/1280/1440 widths, both themes/languages |
| Accessibility | Zero axe WCAG A/AA violations in those 42 views |
| Browser health | Zero overflow, page errors, unexpected alerts or console errors |
| Navigation | Existing routes, carried state, back/reload, More, mobile destinations |
| 3D and fallback | Real textured WebGL, pixel output, keyboard/zoom, real counts, modes, search/time synchronization, texture/context failure, no-WebGL map |
| Demand/lazy rendering | Stable idle draw count; no Earth requests on direct Compare visit |
| Charts and maps | Existing chart controls, map selection, filters and tile-failure table |
| Reliability | Loading, stale-response protection, malformed data and retry |
| Demo | Guided navigation and restored state |
| Exports | CSV byte parity, PNG signature, citation clipboard, print/PDF, real point → district selection |
| Scientific workflows | Outlook, alerts, weather/feed bytes, borders, local calendars and validation |
| Offline | Production service worker, cached Home/map data/calendar and visible offline notice |
| Protected sources | `git diff c56486e -- web/public/data pipeline tests .github` is empty |

Logs, exported files and `suite.json` are in
`../agun-upgrade-qa/soft-earth-production`. The parent comparison preview and
original main worktrees remain clean.

Performance samples used three fresh, unthrottled localhost Chromium contexts:
new Home FCP 428–504 ms, LCP 584–636 ms. These are environment samples, not a
Lighthouse score or a mobile-network guarantee. Globe code costs about 141 KB
gzip plus 1.43 MB of static JPEGs, loaded separately from the app shell.

## Known Issues

- Static Earth/cloud context is not current satellite imagery or weather.
- Available point files lack FRP/confidence/acquisition timestamps; no unsupported
  intensity legend or terrain layer is offered.
- Nine Python tests require optional raw inputs absent from this workspace.
- Native operating-system share sheets are unavailable in headless Chromium;
  PNG download and explicit share-failure handling were verified instead.
- Offline mode covers previously visited same-origin resources, not external
  map tiles or fonts. A first offline visit cannot download missing assets.
- Eleven pre-existing npm advisories remain (3 moderate, 7 high, 1 critical).
  This redesign does not claim to remediate the baseline dependency tree.

## Git Commits

- `ba5e933`: audited baseline and renderer decision.
- `ee84a32`: light theme, responsive composition and real-data controls.
- `71c348b`: textured Earth, geographic interactions, fallbacks and tests.
- Final delivery commit: fallback wording, screenshots and verification record.

## Push Status

The feature branch was successfully created on `origin` with tracking enabled.
Final delivery verifies the remote branch matches the final local commit.
Neither main nor `preview/agun-v2` was modified. The repository's existing Pages
workflow deploys only main; there is no separate branch-preview deployment
configured. No production deployment was triggered by this branch push.

## Preview Instructions

- Development, already running: http://127.0.0.1:5282/
- Production build, already running: http://127.0.0.1:4182/
- Original main comparison: http://127.0.0.1:5272/
- Previous combined redesign: http://127.0.0.1:5270/

To restart after stopping the existing development process:

```powershell
cd 'E:\projects\NASA SpaceApp\agun-soft-earth\web'
npm ci
npm run dev -- --host 127.0.0.1 --port 5282 --strictPort
```

To reproduce production checks against a running production preview:

```powershell
npm run typecheck
npm run build
npm run preview -- --host 127.0.0.1 --port 4182 --strictPort
# In a second terminal in web:
$env:UPGRADE_OFFLINE = '1'
npm run test:upgrade -- http://127.0.0.1:4182 ../test-results/soft-earth
node scripts/upgrade/screenshots.mjs http://127.0.0.1:4182
```

Texture source: [Solar System Scope](https://www.solarsystemscope.com/textures/),
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Attribution is visible
under the Earth and bundled alongside both assets.
