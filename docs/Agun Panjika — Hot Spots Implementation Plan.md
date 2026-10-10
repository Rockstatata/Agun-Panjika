# Agun Panjika — Hot Spots Implementation Plan

Oct 9, 2026 · @Sarwad Hasan

## Summary

We build **Agun Panjika (Fire Almanac)**: a web app that merges 26 years of NASA MODIS and VIIRS fire detections over Bangladesh into one consistent fire calendar, and keeps it running after MODIS and Suomi NPP retire.

- **The problem:** the two sensors count fire very differently. In 2024 MODIS saw 1,876 Bangladesh hotspots and VIIRS S-NPP saw 8,083, and the gap changes by month (about 4x in April, about 13x in November). Any trend built across the sensor switch is wrong.
- **What we ship:** a harmonised 2000 to present record, a day-of-year x year fire calendar, a brick-kiln filter, a "this season vs the 25-year normal" alert, and a bridge onto NOAA-20/21 so the record continues.
- **Who it serves:** Forest Department and Department of Environment staff, CHT community organisations and NGOs, researchers and journalists.
- **Why it can win:** it answers the challenge statement exactly, uses real NASA data with a clear before/after, is low build risk, and has a deadline story NASA cares about: S-NPP data delivery ends 2 Nov 2026.

## Tonight: the 240-second prescreening video

The video needs one real chart and one app mockup, not a finished app. Aim for 3:50 so you have margin under 4:00.

| Time | On screen | Voiceover (draft) |
| --- | --- | --- |
| 0:00 to 0:20 | Animated map of Bangladesh, April 2024 FIRMS hotspots lighting up over the Chittagong Hill Tracts | "Every spring, Bangladesh's hills burn. NASA satellites have recorded every one of these fires since 2000. In a few weeks, that record starts to break." |
| 0:20 to 0:55 | The toggle chart: 2024 monthly MODIS vs VIIRS counts side by side | "Two NASA instruments watch the same fires. In 2024 one counted 1,876, the other 8,083. In November the gap is 13 times. Neither is wrong; they just see differently." |
| 0:55 to 1:20 | Timeline: MODIS 2000, VIIRS 2012, S-NPP delivery ending, NOAA-20/21 continuing | "The older satellites are retiring. If we just stitch the records together, the fire trend jumps for no real reason, and 25 years of history become useless for planning." |
| 1:20 to 2:20 | App mockup: fire calendar heatmap, harmonised trend line, kiln filter toggle, Bangla alert card | "Agun Panjika merges both sensors into one consistent record, removes brick kilns that look like fires, and shows the fire season as a calendar anyone can read. When a season starts earlier or burns harder than normal, it says so." |
| 2:20 to 3:05 | Method diagram: overlap years, monthly calibration, held-out validation, NOAA-20 bridge | "We learn how the sensors differ during the 14 years they overlap, month by month and region by region, test it on years the model never saw, and carry it onto the next satellites." |
| 3:05 to 3:40 | Users: Forest Department, environment officials, CHT community groups, researchers | "This is for the people who plan around fire season, not to blame the communities who farm the hills, but to give everyone the same trustworthy record." |
| 3:40 to 3:55 | Team photo, KUET, project name | "We are \[team name\] from KUET, Khulna. Agun Panjika: a fire record that doesn't break when the satellites do." |

**Checklist before recording**

- [ ] Pull the full 2024 monthly counts for both sensors from the FIRMS CSVs (pandas, about 10 minutes) and plot the toggle chart
- [ ] Build a one-screen mockup of the calendar and alert card (Figma or HTML; the calendar can use real 2024 data)
- [ ] Re-check the S-NPP end date and the MODIS shutdown timing on NASA's pages before saying them on camera
- [ ] Record the voiceover, add English subtitles, export, check length under 4:00
- [ ] Confirm the exact submission deadline time and the form fields with the Local Lead
- [ ] Ask the Local Lead how to disclose work done before the hackathon

## Product

The app answers one question for each user: is this fire season normal, and how has it changed?

| User | What they do in the app | Decision it supports |
| --- | --- | --- |
| Forest Department officer | Opens their district, sees this season's fire count against the 25-year normal | When and where to put patrols and firebreaks |
| Department of Environment / air-quality staff | Sees when regional burning peaks and how it is trending | Timing of public health advisories |
| CHT community organisation or NGO | Sees the jhum burning calendar for their area in Bangla | Planning and coordinating burns, documenting change |
| Researcher or journalist | Downloads the harmonised record | Trend studies without the sensor jump |

**MVP (must exist at the hackathon)**

1. Harmonised Bangladesh fire record, 2000 to present, MODIS-only years converted to the VIIRS-equivalent scale
2. Fire calendar: day of year across, year down, colour = harmonised fire activity; filter by region (CHT, Sundarbans, rest of country)
3. Toggle: raw MODIS, raw VIIRS, naive scaling, our harmonised series
4. Brick-kiln and static-source filter, on by default
5. Season alert card: this season's cumulative activity as a percentile of 2000 to 2025, in English and Bangla

**Stretch**

- Daily update from the FIRMS API (NOAA-20/21), so the calendar fills in live
- Rainfall overlay (NASA IMERG) to show that dry spells come before big fire weeks
- Regional smoke view including upwind India. Note: CHT fires peak in March to April, while Dhaka's worst air is December to February, so do not claim CHT fires cause Dhaka's winter smoke
- District-level PDF report for officials

## Data sources

Everything core is tabular CSV from NASA FIRMS, one row per fire detection, so the pipeline is pandas, not image processing.

| Dataset | Years | Format and access | Role | Status |
| --- | --- | --- | --- | --- |
| MODIS C6.1 (Terra + Aqua), FIRMS | 2000 to now | Yearly country CSV: /data/country/modis/YEAR/modis\_YEAR\_Bangladesh.csv | Long baseline | Verified: 2024 file fetched |
| VIIRS S-NPP 375 m, FIRMS | 2012 to now | Yearly country CSV: /data/country/viirs-snpp/YEAR/... | Calibration target, overlap with MODIS | Verified: 2024 file fetched |
| VIIRS NOAA-20 | 2018 to now | Country CSV path unknown (our guessed URL returned 404); FIRMS API as fallback | Continuity bridge after S-NPP | To verify |
| VIIRS NOAA-21 | 2024 to now | FIRMS API | Continuity bridge | To verify |
| FIRMS near-real-time API | Last few days | Free MAP\_KEY, CSV by bounding box and source | Live updates | To verify the day-range limit |
| NASA IMERG rainfall | 2000 to now | GES DISC or Google Earth Engine | Stretch: rainfall overlay | Optional |
| Partner-agency fire product, e.g. ESA Sentinel-3 SLSTR | Recent years | Copernicus | Independent cross-check, data-usage points | Confirm partner list when full statements drop on 28 Oct |

**Key columns** (check against the files): latitude, longitude, acq\_date, acq\_time, satellite, instrument, confidence, frp (fire radiative power, MW), daynight, type. The type field marks presumed vegetation fire vs static land source in the standard (archive) data and is our first kiln filter.

**Facts we already measured for 2024 Bangladesh:** MODIS 1,876 detections (April 1,536, Nov 13, Dec 44); VIIRS S-NPP 8,083 (April 5,918, Nov 176, Dec 432); 77 to 88% in the Chittagong Hill Tracts; the Sundarbans showed 0 MODIS and 4 VIIRS detections, and the May 2024 Amurbunia fire was not detected, so do not pitch Sundarbans fire monitoring.

## Method

We calibrate MODIS to the VIIRS scale using the 2012 to 2025 years when both fly, then validate on years the model never saw. Everything is expressed as VIIRS-equivalent, because VIIRS is what continues.

1. **Ingest.** Download yearly country CSVs for MODIS (2000 to 2026), VIIRS S-NPP (2012 to 2026), NOAA-20 and NOAA-21. Use standard-processing (archive) files for past years and near-real-time for the current season. Drop duplicates, save as Parquet.
2. **Regions and bins.** Tag each detection with a region (CHT districts Rangamati, Khagrachhari, Bandarban; Sundarbans; rest of Bangladesh) using district boundaries. Bin by region x week. Weekly bins keep the calendar readable and reduce noise.
3. **Static-source filter.** Drop rows with type = static land source. Then flag any 375 m cell that has detections in many different months across 3 or more years as a probable brick kiln or industrial site. Spot-check 20 flagged cells on satellite imagery and report the hit rate.
4. **Harmonisation model.** For each region r and week w, predict VIIRS counts V from MODIS counts M and MODIS fire radiative power F, with a separate offset per region and month m:

```latex
\log(V_{r,w}+1) = \alpha_{r,m(w)} + \beta \log(M_{r,w}+1) + \gamma \log(F_{r,w}+1) + \varepsilon
```

5. **Baselines.** Compare against raw MODIS and a naive single ratio (2024: 8,083 / 1,876, about 4.3x). Beating the naive ratio in the off-season months is the headline result, because that is where it fails worst.
6. **Validation.** Leave one year out across 2012 to 2025. Report mean absolute error on weekly counts, error in seasonal totals, and error in peak-week date, for our model and each baseline.
7. **Continuity bridge.** Fit the same model between S-NPP and NOAA-20 on 2018 to 2026 overlap (and NOAA-21 from 2024). After S-NPP delivery ends, the series continues on NOAA-20/21 converted to the S-NPP scale.
8. **Normal and alert.** For each region and week, compute 2000 to 2025 percentiles of cumulative season activity. Alert levels: below normal (under 25th), normal, above normal (over 75th), extreme (over 90th).
9. **Uncertainty.** Weeks where MODIS saw nothing but VIIRS would have seen small fires cannot be fully recovered. Show a shaded uncertainty band for the MODIS-only years (2000 to 2011) and say so in the app.
10. **Export.** Precompute per-region JSON (weekly series, calendar matrix, percentiles) for the front end.

## Architecture and stack

No server and no database: a Python pipeline precomputes JSON, and a static site reads it. This keeps hosting free and the demo unbreakable.

&#91;embedded content: system architecture · 4 pipeline steps\]

The harmonisation step is the core; everything else is plumbing.

- **Pipeline:** Python 3, pandas, pyarrow (Parquet), statsmodels or scikit-learn, geopandas for district tagging
- **Front end:** React with Vite, D3 or Observable Plot for the calendar and toggle chart, MapLibre GL or Leaflet for the map, a JSON file per language for English and Bangla
- **Hosting and updates:** GitHub Pages; a scheduled GitHub Action reruns the pipeline daily for the live season

```
agun-panjika/
  pipeline/   ingest.py  regions.py  kilns.py  harmonise.py  climatology.py  export.py
  data/       raw/ (CSV, gitignored)  processed/ (Parquet)
  web/        src/ (components, i18n/en.json, i18n/bn.json)  public/data/ (JSON)
  notebooks/  validation.ipynb
  .github/workflows/daily.yml
```

## Team roles

Six people, three pairs: data, model, app. Fill in the names.

| Role | Owner | Owns | Tonight (video) |
| --- | --- | --- | --- |
| Data lead |  | Ingest, regions, Parquet store, FIRMS API | Pull 2024 monthly counts for the chart |
| Filter and validation |  | Kiln filter, spot checks, leave-one-year-out tests | Grab hotspot map frames for the opening shot |
| Model lead |  | Harmonisation model, baselines, NOAA-20 bridge | Draft the method diagram |
| Frontend lead |  | Calendar heatmap, toggle chart, map | Build the one-screen mockup |
| App and Bangla UX |  | Alert card, Bangla text, layout, accessibility | Translate alert card, help on mockup |
| Story and presentation |  | Scripts, videos, slides, judging Q&A, partner data | Record voiceover, edit, submit the form |

## Timeline

The video ships tomorrow; the model must be validated by 8 Nov so the last week is only app polish.

&#91;embedded content: official dates from the Space Apps schedule; build spans are our plan\]

If the Local Lead says build work must happen during the event, shift the model and app spans into the 14 to 15 Nov window and keep pre-event work to data download and exploration.

## Risks and honest limits

| Risk | Likelihood | Fallback |
| --- | --- | --- |
| Hackathon rules limit work done before 14 Nov | Unknown | Ask the Local Lead now; keep pre-work to data prep and disclose it |
| Prior art: MODIS/VIIRS fusion already published (Zheng et al. 2026) | Certain | Cite it; our novelty is the continuity bridge, the calendar for non-experts and the Bangladesh alert, not the fusion idea itself |
| Impact judged as "just a better chart" | Medium | Lead with the alert and the users, not the statistics |
| NOAA-20/21 archive hard to get | Medium | FIRMS API or archive download request; MVP works on MODIS + S-NPP alone |
| Kiln filter removes real fires | Medium | Report spot-check hit rate; let users toggle it off |
| Jhum framing reads as blaming Indigenous farmers | Medium | Frame as shared information; avoid words like "illegal" or "destruction" |
| Sensor dates wrong on camera | Low | Re-check NASA pages before recording |

**What the app does not do:** it does not predict individual fires, it does not monitor Sundarbans fires (FIRMS barely sees them), and it does not show that CHT fires cause Dhaka's winter smoke.

## Sources

- [NASA FIRMS](https://firms.modaps.eosdis.nasa.gov/): country CSVs for MODIS and VIIRS S-NPP, 2024 Bangladesh counts measured from these files
- [NASA Space Apps 2026 challenges](https://www.spaceappschallenge.org/2026/challenges/): challenge list and team counts (Hot Spots: 214 teams globally, 3 in Khulna)
- Zheng et al. 2026, Remote Sensing: MODIS and VIIRS fire radiative power fusion (prior art to cite)
- Farukh et al. 2023: Bangladesh MODIS hotspots 2003 to 2021, 88% in CHT, about 69% between 24 Mar and 12 Apr
- Rahman et al. 2020: biomass burning about 40% of Dhaka PM2.5

The papers were found earlier in our research; add their DOIs before citing them in the video or slides.
