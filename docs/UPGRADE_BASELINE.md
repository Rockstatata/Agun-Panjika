# Agun Panjika upgrade baseline

> Historical evidence for `preview/agun-v2` at `c56486e`, captured on 2026-10-10. Branch heads, main status and localhost servers described below are that audit snapshot. For the current serial integration and manual PR order, see [SERIAL_MERGE_REVIEW.md](SERIAL_MERGE_REVIEW.md). This document does not claim those servers are currently running.

- Audit date: 2026-10-10 (Asia/Dhaka).
- Verified origin/main and original main: `eef030f663fc8f2918d7c9a07da76ef68bd5a1ce`.
- Original checkout: `E:/projects/NASA SpaceApp/Agun-Panjika`; clean before audit.
- Preview checkout: `E:/projects/NASA SpaceApp/agun-v2-preview`.
- Remote: https://github.com/Rockstatata/Agun-Panjika.
- No AGENTS.md found in the project. Production workflow deploys only main, schedule, or manual dispatch; it will remain unchanged.

## Architecture and preserved inventory

React 18 / TypeScript / Vite 5 / Tailwind 3. Hash routes: home, panjika, sensors, map, outlook, borders, method. MapLibre 4 is dynamically imported for the map. D3 produces SVG scientific charts. JSON promise cache deduplicates requests. Page state lives in hash parameters; region is currently carried through navigation, but year/week and sensor choices are lost. Theme and i18next language persist in local storage. Production-only service worker caches visited pages/assets/data; external fonts and map tiles require network.

| Capability | Existing implementation |
|---|---|
| National, five regions, 64 districts | RegionPicker, manifest, region JSON |
| Harmonized weekly history, original sensor counts, naive factor | lib/series.ts, pipeline/harmonise.py, exported RegionDoc |
| Season percentile, normal bands, rain, year/week controls | Home, SeasonChart, seasonAt |
| Calendar, keyboard tooltips, table, local unions/upazilas | Panjika, CalendarHeatmap, local JSON |
| Annual sensor comparison, uncertainty, sonification, validation, bridge | Sensors, AnnualChart, Sonify, validation/bridge JSON |
| District choropleth, retained/static hotspots, kiln toggle, table | MapScreen, districts GeoJSON, compact annual PointsYear |
| Two-week outlook, weather danger, anomaly alerts, CAP/RSS, hindcast | OutlookScreen, Outlook components, forecast/fireweather JSON |
| Borderless hills and upwind aerosol comparisons | Borders, neighbours JSON |
| Method, ESA cross-check, uncertainty coverage, sources, citation, CSV | Method, PartnerCheck |
| PNG/native share fallback, print report | ShareButton, Home, print CSS |
| English/Bangla, light/dark, mobile, offline | i18n, theme tokens, navigation, sw.js |

Scientific contract is defined in lib/types.ts, pipeline/export.py and pipeline/schema/region.schema.json. No pipeline rerun or historical data regeneration is authorized by this UI task. Points contain longitude, latitude, ISO week and classification only; acquisition time, FRP and per-point confidence must not be invented. Forecast skill is a hindcast upper bound, distinct from historical harmonization validation.

## Baseline checks

- `npm ci`: passed, isolated preview worktree.
- `npm run typecheck`: passed.
- `npm run build`: passed; main JS 335.38 kB / 112.50 kB gzip, MapLibre chunk 808.80 kB / 220.46 kB gzip; main CSS 15.55 kB / 4.21 kB gzip.
- Default `python -m pytest -q`: initially blocked because pytest was absent. Declared project/dev dependencies installed in sibling `agun-upgrade-python` virtual environment; final baseline result recorded in UPGRADE_PROGRESS.md.
- Browser: Playwright Chromium, 28 full-page captures across all seven routes at 1440 light/en, 1440 dark/en, 390 light/en and 360 dark/bn. All rendered; no document overflow, page exceptions or app error alerts in baseline smoke.
- Screenshots and JSON evidence: `E:/projects/NASA SpaceApp/agun-upgrade-qa/baseline/`.
- Baseline local URL during audit: http://127.0.0.1:5270/.

## Known defects and limitations

- useAsync retains previous-region/year data while a replacement loads; cleanup suppresses late writes but stale values remain visibly paired with new filters.
- Sensor, kiln and chart-range selections are component-local and reset on navigation.
- Seven mobile destinations are crowded; current skip link changes the route hash.
- Map construction has no WebGL failure handling; external tile errors can leave an indefinite loading screen. Popup callbacks capture initial language; point details are absent.
- Several secondary requests have no visible error/retry state. Share errors only log to console; a null exported blob silently returns.
- Baseline smoke checks rendering, not every action. Dedicated interaction, accessibility, export, fallback and offline checks are required before final acceptance.
- Raw/intermediate pipeline data are not included in the checkout; tests requiring detections.parquet may skip. Preserve that distinction from code failures.

## Branch policy

All eight features use independent worktrees from verified origin/main. Tested commits are cherry-picked in the brief's phase order into preview/agun-v2. No main writes, merges, resets, rebases, branch deletion or force pushes. No production workflow changes or production publication.

## Final audit clarification

The corrected isolated Python baseline is 50 passed, 9 skipped. Final strict console auditing also identified pre-existing duplicate citation keys and cross-origin font CSS access errors during PNG sharing; both were fixed on the reliability feature branch. npm audit reports 11 vulnerabilities (3 moderate, 7 high, 1 critical), with affected installed versions identical to the baseline. These are recorded as release limitations rather than silently upgrading the rendering/toolchain stack.
