# Soft Earth redesign progress

## Baseline — 2026-10-10

Branch: `feat/soft-earth-globe-home`. Base: `preview/agun-v2` at
`c56486e2f7cc5ceec1bdf5633240575039539965`. This retains the eight completed
feature upgrades absent from main. Main remains at `eef030f`; neither main nor
the combined preview will be modified by this work.

Baseline verification: TypeScript and production build passed; Python suite
passed (50 passed, 9 skipped because optional raw inputs are absent). All 28
baseline browser views passed overflow, console and axe accessibility checks.
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
Shared light surfaces, serif hero, three real-data cards, district search, linked period/source controls and responsive filters implemented. Seasonal report and all navigation remain accessible. Typecheck, production build and Python checks passed. Seven route screenshots passed axe, overflow and console checks (soft-earth-layout). The interim renderer is replaced in the next milestone.
