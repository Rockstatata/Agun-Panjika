# Geographic rendering decision

MapLibre 4.7 remains unchanged for the existing map. Native globe projection is available in newer MapLibre releases (https://maplibre.org/maplibre-gl-js/docs/examples/globe-custom-simple/), so introducing it here would also change the scientific map's rendering dependency.

Three.js / React Three Fiber and Cesium add a separate WebGL runtime and resources for features this interface does not need. The selected approach is a geographic orthographic sphere rendered with Canvas 2D and the small d3-geo module (https://d3js.org/d3-geo/azimuthal). It is a 3D-inspired geographic experience, not a terrain/altitude model. It requires no WebGL, hence continues working when WebGL contexts fail. A Mercator view provides an explicit 2D alternative.

- EarthCanvas is dynamically imported; 27.98 kB / 11.31 kB gzip in the independent build.
- Natural Earth v5.1.2 land is local public-domain geographic context, loaded only for the home experience; no live observation or decorative fire data.
- All fire points come from unchanged PointsYear exports; longitude/latitude, sensor, ISO week and retained/static classification are the only point metadata exposed.
- Projected 4-pixel bins limit marker drawing without changing counts. Hit testing retains original coordinates. District membership uses existing polygon rings and holes; zoom and filter changes redraw on demand.
- Region and period come from existing URL parameters; home and globe use the same seasonal week defaults.
- No continuous rotation or idle animation; pointer rendering is coalesced with requestAnimationFrame. Unmount cancels pending frames; useWidth disconnects ResizeObserver.
- Keyboard arrows, zoom buttons, focus, touch drag and region selection are available. Canvas absence gives an explicit message and preserves dashboard controls.

Browser interaction evidence: globe.mjs verified zoom, keyboard rotation, drag and 2D toggle with WebGL/WebGL2 explicitly disabled. Each of 28 independent browser route/theme/language views passed. Final integration tests cover real coordinate selection and geographic membership.
