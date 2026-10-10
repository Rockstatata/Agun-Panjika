# Final regression matrix: original versus preview

Story: region/period/sensor controls request the existing static NASA export JSON; validated responses feed unchanged scientific series calculations, charts, calendar and geographic coordinates. There is no new backend, database, authentication, API key or production deployment. The preview is prepared for review, not declared production-ready.

## Verification evidence

- Automated pass: npm run typecheck; npm run build.
- Automated pass: isolated python -m pytest -q, 50 passed and 9 skipped.
- Automated pass: 42 production Chromium views across every original route; widths 360, 390, 768, 1280, 1440; both languages and themes; zero document overflow, page exceptions, console errors and axe WCAG 2A/AA/2.1AA findings.
- Independent branch checks: 28 views per branch, typecheck/build/Python suite, plus feature interactions before integration. Every integration was checked across seven routes.
- Final suite artifacts: E:/projects/NASA SpaceApp/agun-upgrade-qa/final-production. Baseline and per-feature evidence are sibling directories.
- Server evidence: Vite prints verified localhost URLs on 5270/5271/5272/4175; builds succeed. Static data responses and exported file bytes are tested through the browser/HTTP boundary.

## Original feature inventory

| Feature | Original | Preview | Status | Evidence |
|---|---|---|---|---|
| Harmonised MODIS/VIIRS history | Present | Preserved | Automated pass | Protected data/pipeline diff empty; 50 Python tests; CSV byte parity |
| Raw MODIS, VIIRS, naive and harmonised comparison | Present | Preserved with story controls | Automated pass | charts + navigation scripts; annual keyboard/table inspection |
| Fire Calendar, year/week interaction | Present | Enhanced selection | Automated pass | Calendar click, Arrow/Enter, table alternative, selected week |
| National/regional/district selection | Present | Shared with globe/map | Automated pass | Navigation carry and rapid region-change tests |
| Upazila/union selection | Present in supported districts | Preserved | Automated pass | Rangamati union selection and calendar table |
| Hotspots/district choropleth | Present | Real clusters/layers and fallback | Automated pass | Rendered map source features; 64 district rows; screenshots |
| Static/brick-kiln filtering | Present | Preserved, URL state | Automated render/state pass | Source-status filtering reviewed; map render and demo/filter restoration |
| Seasonal percentiles/normality/weather bands | Present | Preserved | Automated render + byte parity | Home captures, unchanged series/pipeline and scientific exports |
| Two-week outlook | Present | Preserved | Automated pass | scientific script validates sections and original forecast bytes |
| Weather danger/anomalies/alerts/RSS/CAP | Present | Preserved | Automated pass | Region selection, weather sections and feed byte parity |
| NOAA-20/21 continuity | Present | Preserved | Automated pass | Bridge/Method rendered, real demo continuity step |
| Cross-border and upwind analysis | Present | Preserved | Automated pass | Borders chart year change; all route captures |
| Validation/method/ESA/citations/uncertainty | Present | Preserved with scroll destinations | Automated pass | Method sections, source labels, validation table, clipboard and citation keys |
| CSV download | Present | Preserved | Automated pass | Both actual browser downloads match original files byte for byte |
| PNG share/download | Present | Preserved with visible error | Automated pass | PNG signature/size; denied-share alert; zero console errors |
| Native OS share sheet | Runtime-dependent | Preserved API branch | Skipped | Headless Chromium has no native OS share sheet |
| Printable report | Present | Preserved, dark ink corrected | Automated pass | Print invocation, print media visibility/ink and generated PDF |
| Physical printer output | Runtime-dependent | Not exercised | Skipped | No physical printer or OS dialog automation |
| Citation clipboard | Present | Preserved with visible error | Automated pass | Actual clipboard readback and denied-permission alert |
| Sonification | Present | Preserved | Automated pass | Raw stitched playback start/stop and route transition; no exceptions |
| English/Bangla and dark/light | Present | Preserved | Automated + visual pass | 42 views and toggle/reload persistence; UTF-8 header corrected |
| Mobile/responsive navigation | Present | Four destinations + More | Automated + visual pass | Five widths, no page overflow, More/Escape and legacy routes |
| Offline functionality | Cached visited resources | Preserved with publication notice | Automated pass | Controlled production worker; offline Home/globe reload and Calendar |
| WebGL unavailable | Previously fragile | Globe works; map table recovers | Automated pass | Explicit WebGL/WebGL2 denial without frontend exception |
| Tile outage/retry | Previously indefinite map load | District table + Retry map | Automated pass | Aborted external tiles, table, network restored and map recreated |
| Loading/network/JSON/races | Previously partial | Explicit recovery | Automated pass | Delayed prior region, latest selection wins, 503/retry, malformed JSON |
| 3D-inspired geographic sphere | New | Implemented with real data | Automated + visual pass | Coordinate projection/click -> district, zoom/rotation/drag/2D mode |
| Seven-step optional demo | New | Implemented | Automated pass | All steps; Finish/Escape restore saved filters |
| Deployment/main/data safety | Original preserved | No production change | Automated Git pass | Exact main SHA and clean original worktree; protected paths unchanged |

Automated rendering is distinguished from dedicated interaction tests. Existing validation/forecast skill values are not re-estimated, and the upgrade makes no new scientific accuracy claim. Screenshots do not replace physical-device or assistive-technology testing.

## Performance

| Measure | Original production | Combined production |
|---|---|---|
| Main entry JS, raw/gzip | 335.38 / 112.50 kB | 238.15 / 80.61 kB |
| Map route JS, raw/gzip | 808.80 / 220.46 kB | 813.77 / 222.56 kB |
| Main CSS, raw/gzip | 15.55 / 4.21 kB | 22.90 / 5.99 kB |
| Geographic renderer JS | Absent | Deferred 28.07 / 11.35 kB |
| Median first contentful paint | 420 ms | 444 ms |
| Median largest contentful paint | 596 ms | 548 ms |

The main entry is about 29% smaller; the fully rendered Home still downloads 353,357 decoded script bytes versus 349,880 originally (about 1% more) because it now includes the lazy globe and split shared modules. The aggregate available JS grows from about 1,157 kB to 1,231 kB, and CSS grows with the visual system. MapLibre remains the large deferred chunk. Natural Earth land JSON adds a local geographic asset only for Home.

Paint timing is measured with three fresh, unthrottled Chromium contexts per local production server. The small FCP regression and lower sampled LCP are environment-specific observations, not performance guarantees. Browser/server machine load and third-party fonts affect these numbers. See [raw timing/bundle evidence](upgrade-progress/performance.json); no Lighthouse score is claimed.

## Visual review and fixes

Representative before/after Home, desktop chart/map, mobile English/Bangla and tablet Calendar captures were visually inspected. Layout is coherent, controls readable, chart/calendar overflow stays within its panel, and all original scientific content remains present. [Committed screenshots](upgrade-progress/screenshots/) include original and preview comparison images; complete captures remain in the local QA folders.

Final review fixed a UTF-8 header encoding error, mixed-source labels/table focus, citation keys, font CORS errors during PNG export, and dark naive-line contrast (6.49:1 against its card). An incorrectly launched dev test server omitted Tailwind utility styles; restarting from web fixed that test environment. Production fault injection initially bypassed Playwright via the service worker; fault tests now block it, while a separate offline test exercises the real worker. Failed intermediate results were investigated and affected checks rerun, rather than reported as passes.

## Limitations and release work

- Nine Python cases requiring raw/intermediate detections.parquet skip. Existing generated scientific datasets were not regenerated.
- Native OS sharing, physical printing, physical devices, screen-reader sessions and heap-profiler testing were not performed. React map removal, frame cancellation, observers/listeners/audio cleanup and repeated route transitions were reviewed/tested; no heap-leak claim is made.
- Fonts and external map tiles depend on connectivity. Offline behavior is limited to previously cached same-origin resources, with honest loading/errors for missing data.
- npm audit reports 11 vulnerabilities inherited from the original lockfile: 3 moderate, 7 high, 1 critical. Affected direct packages include MapLibre GL, PostCSS, Tailwind and Vite. All affected versions are unchanged from baseline; resolve and retest dependency migration before release readiness.
- Automated accessibility results cover the specified axe rules in Chromium; they are not a full WCAG certification.

## Git/review

All eight feature branches and combined preview are pushed, independently reviewable against origin/main. Integration uses cherry-picks only, in documented order. Original main remains eef030f663fc8f2918d7c9a07da76ef68bd5a1ce. No merge, reset, rebase, force-push, production workflow change or production publish occurred. Use [preview instructions](UPGRADE_PREVIEW.md) for exact versions and ports.
