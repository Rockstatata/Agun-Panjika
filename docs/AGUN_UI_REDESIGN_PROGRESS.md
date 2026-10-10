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
