# Agun Panjika — Product Requirements Document

Oct 9, 2026 · @Sarwad Hasan

## Executive summary

**Agun Panjika ("Fire Almanac") turns 26 years of NASA fire detections into one record that stays trustworthy as the satellites change, and tells people in plain Bangla whether this fire season is normal.**

- **Pitch line:** *A fire record that doesn't break when the satellites do.*
- **The problem:** NASA's two fire instruments disagree. Over Bangladesh in 2024, MODIS logged 1,876 fire detections and VIIRS logged 8,083, and the gap swings from about 4x in April to about 13x in November. The older satellites are now being retired, so every long-term fire trend built on them is about to break.
- **The product:** a web app with a harmonised 2000 to present fire record, a fire calendar anyone can read, a brick-kiln filter, a season alert against the 25-year normal, and a bridge onto the next satellites (NOAA-20 and NOAA-21).
- **Who acts on it:** Forest Department and Department of Environment officers, Chittagong Hill Tracts (CHT) community organisations and NGOs, researchers and journalists.
- **Challenge:** Harmonization of MODIS and VIIRS Hot Spots (NASA Space Apps 2026). 214 teams globally, 3 in Khulna.
- **Why it wins:** it solves exactly what the challenge asks, uses NASA data with a visible before and after, is built on a time-critical event (the satellite handover happening during the competition), and is achievable by a six-person team.

## The story

The story is a single year in Bangladesh's hills, told through events that are on the record: the hills burn in spring, the slopes fail in the monsoon, the cities breathe smoke in winter, and the satellites that watched all of it are now switching off.

**1. Spring: the hills burn.** From 2003 to 2021, NASA's MODIS logged 54,669 fire hotspots in Bangladesh. 48,273 of them (88%) were in the Chittagong Hill Tracts, which hold about 43% of the country's forest land. 92% of fires fall in March and April, and the most intense window is 24 March to 12 April. Fire activity swings 2.9-fold between strong and weak years, and the authors link the peak to the slash-and-burn period of jhum cultivation ([Farukh et al. 2023](https://www.mdpi.com/2073-4433/14/1/97)). A Bandarban soil study found that "deterioration in land quality starts from burning" ([Osman et al. 2013](https://link.springer.com/article/10.1007/s11676-013-0368-3)).

**2. Monsoon: the slopes fail.** On 13 June 2017, landslides struck Rangamati, Bandarban, Khagrachhari, Chittagong and Cox's Bazar: 160 dead, 187 injured, about 80,000 people affected and 6,000 structures destroyed ([ACAPS](https://www.acaps.org/en/countries/archives/detail/bangladesh-landslides)). NASA measured about 510 mm of rain in three days, and local experts named cleared hillsides among the risk factors ([The New Humanitarian](https://www.thenewhumanitarian.org/analysis/2019/06/25/Bangladesh-landslides-climate-change-Indigenous)). We do not claim the fires caused the landslides; we say the hills that burn in April are the same hills that slide in June, and nobody has a clean record of how their burning is changing.

**3. Across the border: the same fire season.** On 24 April 2021, forest fires in Mizoram's Lunglei district spread into the town; fires kept burning in Lawngtlai, which borders Bangladesh's hill tracts. The Indian Air Force flew two helicopters with water buckets. Officials named a long dry spell and jhum as likely factors ([Down To Earth](https://www.downtoearth.org.in/news/natural-disasters/fires-rage-on-in-mizoram-s-lawngtlai-under-control-elsewhere-76701)). Fire ignores borders, so the app covers the whole hill region, not only Bangladesh.

**4. Winter: the city breathes smoke.** Air pollution caused an estimated 78,145 to 88,229 deaths in Bangladesh in 2019 and cost 3.9 to 4.4% of GDP ([World Bank](https://www.worldbank.org/en/news/press-release/2022/12/03/high-air-pollution-level-is-creating-physical-and-mental-health-hazards-in-bangladesh-world-bank)). Biomass burning made up 40.2% of Dhaka's PM2.5 from 2013 to 2017, rising to 41.4% outside the monsoon, and the worst days lined up with crop burning in the Indo-Gangetic Plain upwind ([Rahman et al. 2020](https://agris.fao.org/search/fr/records/65df124963b8185d9caa928d)). That smoke is visible in the same NASA fire data.

**5. Now: the watchers retire.** NASA expects Terra and Aqua, the MODIS satellites, to begin shutting down in late 2026 or early 2027 ([Earthdata](https://www.earthdata.nasa.gov/data/alerts-outages/transition-from-modis-viirs)), and Suomi NPP observations cease on 2 November 2026 ([Earthdata alert](https://www.earthdata.nasa.gov/data/alerts-outages/suomi-npp-observations-cease-november-2-2026)), during this competition. The newest published fusion of MODIS and VIIRS covers 2012 to 2024 and warns its coefficients "should not be directly transferred" to other satellites ([Zheng et al. 2026](https://mdpi-res.com/d_attachment/remotesensing/remotesensing-18-01650/article_deploy/remotesensing-18-01650.pdf)). The record that watched every one of these fire seasons is about to break, and no one has built the bridge for the people who use it.

> **Story line for every video and slide:** *Every April the hills burn. Every June they slide. Every winter the cities breathe smoke. For 26 years NASA watched it all. This November, the watchers start to switch off.*

## Problem

NASA's two fire sensors give different answers to the same question, so Bangladesh's 26-year fire record cannot be read as one line. We counted every detection in the FIRMS files ourselves; our MODIS total for 2003 to 2021 is 54,669, exactly the figure published by Farukh et al., which confirms the counts.

&#91;embedded content: NASA FIRMS country yearly CSVs, Bangladesh, 2003 to 2024 (MODIS C6.1, VIIRS 375 m); counted by our team on 9 Oct 2026\]

Anyone who joins the records where VIIRS begins sees a fourfold jump in fires that never happened.

&#91;embedded content: NASA FIRMS country yearly CSVs, Bangladesh, 2012 to 2024; counted by our team on 9 Oct 2026\]

A single conversion factor fails because the gap depends on the season: small winter fires are seen by VIIRS and missed by MODIS.

- **The sensors even disagree on trends.** From 2021 to 2022, MODIS says fire fell 67% (2,895 to 963); VIIRS S-NPP says 41% (12,249 to 7,258). The yearly peak-season ratio swings from 3.0x (2012) to 7.6x (2022).
- **The VIIRS-to-VIIRS bridge is the easy half.** For 2019 to 2024, NOAA-20 logged 61,912 detections and S-NPP 61,553, a 0.6% difference nationally. The hard half is carrying the MODIS years (2000 to 2011) onto the VIIRS scale.
- **The clock.** S-NPP science data delivery ceases at 13:00 UTC on 2 November 2026 (NASA says the date may change), and Terra and Aqua begin shutting down in late 2026 or early 2027.
- **Data gap to note:** FIRMS country files currently run to 2024; 2025 and 2026 come from the archive download tool or the API.
- **No one has closed the gap for users.** The latest published fusion (Zheng et al. 2026) covers Aqua and S-NPP to 2024 and says its coefficients do not transfer to Terra or other satellites.

## Users and use cases

Four personas, one question each: is this fire season normal, and where?

| Persona | Who | Job to be done | What they open first | Language |
| --- | --- | --- | --- | --- |
| Divisional Forest Officer | Forest Department, Rangamati or Bandarban | Plan patrols and firebreaks before the March to April peak | District season card and alert | Bangla |
| Air-quality analyst | Department of Environment, Dhaka | Know when regional burning upwind is spiking | Regional burning view, weekly trend | English |
| Community or NGO coordinator | CHT community organisation | See how this year's burning compares to past years; plan and document | Union-level calendar, shareable image | Bangla |
| Researcher or journalist | University, newsroom | Get one consistent fire series without the sensor jump | Data download, method page | English |

**Main user journey: the Forest Officer in early March**

1. Opens Agun Panjika on a phone and picks Bandarban.
2. Sees the season card: "Fire activity so far this season: above normal (82nd percentile of 2003 to 2025)."
3. Opens the calendar: this year's row is darker than usual in the second week of March, earlier than the typical peak of 24 March.
4. Checks the map: activity is concentrated in two upazilas.
5. Downloads a one-page PDF in Bangla and sends it to field staff.

**Other key journeys**

- *Researcher:* toggles Raw MODIS, Raw VIIRS, Naive x4.4 and Harmonised to see why the harmonised series is needed, then downloads the CSV with uncertainty bands.
- *Journalist in April:* searches "is this year's fire season worse?" and gets a sourced, plain-language answer with a chart to embed.
- *Air-quality analyst in November:* opens the regional view and sees VIIRS burning detections rising across the Indo-Gangetic Plain upwind of Dhaka.

## Goals, non-goals and success metrics

The hackathon goal is a working app on real data with one validated result: our harmonised series beats the naive single factor on held-out years.

**Goals**

1. One consistent Bangladesh fire series from 2003 to the present, on the VIIRS scale, with uncertainty.
2. A fire calendar and season alert a non-expert understands in 10 seconds, in Bangla and English.
3. A documented bridge from S-NPP to NOAA-20/21 that keeps the series running after 2 November 2026.
4. Open data and code anyone can reuse for another country.

**Non-goals**

- Predicting individual fires or fire spread.
- Monitoring Sundarbans fires (FIRMS detected 4 in 2024 and missed the May 2024 Amurbunia fire).
- Claiming CHT fires cause Dhaka's winter smoke.
- Judging or policing jhum cultivation.

**Success metrics**

| Metric | Target at hackathon | How measured |
| --- | --- | --- |
| Weekly-count error vs naive factor, held-out years | At least 30% lower error than the single 4.4x factor | Leave-one-year-out, 2012 to 2024 |
| Off-season (Oct to Feb) error | Lower than naive in every held-out year | Same test, off-season weeks only |
| Peak-week date error | Within 1 week on average | Same test |
| Kiln filter precision | At least 80% of flagged cells are real kilns or industry | Visual check of 20 cells on satellite imagery |
| Time to answer "is this season normal?" | Under 10 seconds for a first-time user | 5 classmates, timed |
| Page load on mobile 4G | Under 3 seconds | Lighthouse |

The 30% error target is our own goal, not a published benchmark; adjust it once the first validation run is in.

## Unique features

FIRMS already shows where fires are today; Agun Panjika is the only tool that tells you whether this season is normal on a record that survives the sensor switch.

| Feature | What the user sees | Why it is new | Priority |
| --- | --- | --- | --- |
| Fire calendar (the Panjika) | Week of year across, year down, colour = harmonised activity; this year's row highlighted | Turns 26 years into one picture, styled like a Bengali almanac | MVP |
| Sensor truth toggle | Switch Raw MODIS, Raw VIIRS, Naive 4.4x, Harmonised on the same chart | Shows judges and users the problem and the fix in one click | MVP |
| Season-aware harmonisation | Series on the VIIRS scale, by month and region, with an uncertainty band | Published fusion stops at 2024 and does not transfer across satellites | MVP |
| Handover bridge | A marker at 2 Nov 2026; the line keeps going on NOAA-20/21 | Built for the switch happening during the competition | MVP |
| Season alert in Bangla | "Above normal: 82nd percentile" card per district | First plain-language fire normal for Bangladesh | MVP |
| Brick-kiln filter | Toggle that removes static heat sources, with a count of what was removed | Kilns sit in the same places for years and inflate counts | MVP |
| Borderless hill view | CHT with neighbouring Mizoram, Tripura and Myanmar's hills | The 2021 Mizoram fires show the season crosses borders | Stretch |
| Upwind smoke view | VIIRS burning in the Indo-Gangetic Plain, Oct to Dec and Apr to May | Rahman et al. tie Dhaka's worst days to that burning | Stretch |
| Share card | One-tap PNG of a district's season in Bangla for WhatsApp or Facebook | Puts the answer where people already talk | Stretch |
| Any-country config | A JSON file sets the country and regions | Lets 200+ other countries reuse the pipeline | Stretch |

## Data sources

All core data is NASA FIRMS CSV, one row per fire detection. We have already downloaded and counted 2000 to 2024 for all three sensors.

| Dataset | Years | Access path | Format | Role | Status |
| --- | --- | --- | --- | --- | --- |
| MODIS C6.1 (Terra + Aqua) | 2000 to 2024 (full years from 2003) | firms.modaps.eosdis.nasa.gov/data/country/modis/YEAR/modis\_YEAR\_Bangladesh.csv | CSV | Long baseline | Verified |
| VIIRS S-NPP 375 m | 2012 to 2024 | /data/country/viirs-snpp/YEAR/viirs-snpp\_YEAR\_Bangladesh.csv | CSV | Calibration target | Verified |
| VIIRS NOAA-20 375 m | Apr 2018 to 2024 | /data/country/viirs-jpss1/YEAR/viirs-jpss1\_YEAR\_Bangladesh.csv | CSV | Bridge after S-NPP | Verified |
| All sensors, 2025 to now | 2025 to 2026 | FIRMS archive download tool or area API (free MAP\_KEY) | CSV | Recent and live data | To set up |
| VIIRS NOAA-21 | 2024 to now | FIRMS area API | CSV | Second bridge satellite | To set up |
| District and upazila boundaries | Static | geoBoundaries or HDX (Bangladesh admin levels 2 and 3) | GeoJSON | Region tagging, map | To download |
| NASA IMERG precipitation | 2000 to now | NASA GES DISC or Google Earth Engine | NetCDF or GEE | Stretch: dry-spell overlay | Optional |
| Dhaka PM2.5 | 2016 to now | OpenAQ (US Embassy Dhaka monitor) | JSON | Stretch: smoke view | Optional |
| Partner-agency fire product | Recent | e.g. ESA Sentinel-3 SLSTR fire, via Copernicus | NetCDF | Independent cross-check | Confirm partner list on 28 Oct |

**Fields we use** (confirmed in the 2024 files)

- MODIS: latitude, longitude, brightness, scan, track, acq\_date, acq\_time, satellite, instrument, confidence (0 to 100), version, bright\_t31, frp, daynight, type
- VIIRS: same, with bright\_ti4 and bright\_ti5 in place of brightness and bright\_t31, and confidence as low, nominal or high
- type: 0 = presumed vegetation fire, 2 = other static land source (kilns, industry), 3 = offshore. In 2024, 17% of VIIRS S-NPP detections outside March to April (247 of 1,486) were not type 0, against about 1% in March to April, so filtering matters most in the off-season.

**Licence:** NASA data is free and open; cite FIRMS as NASA requests on its citation page.

## Science and method

We learn the MODIS-to-VIIRS relationship from the 13 years both sensors flew (2012 to 2024), by season and region, test it on years the model never saw, and use it to put 2003 to 2011 on the VIIRS scale.

**1. Clean the detections**

1. Drop exact duplicates (same sensor, time, location).
2. Confidence: keep VIIRS nominal and high; keep MODIS confidence 30 and above. Report results with and without this filter.
3. Static sources: drop type 2 and 3. Then grid detections at about 400 m and flag a cell as a probable kiln or industrial site if it has detections in 4 or more different months in 3 or more years, mostly outside March to April. Show a count of removed detections in the app.

**2. Aggregate**

- Space: three CHT districts (Rangamati, Khagrachhari, Bandarban), Chattogram and Cox's Bazar hills, rest of Bangladesh; district level for the map.
- Time: ISO week. Weekly bins keep noise down and make a readable calendar (52 columns x 22+ years).
- Per region-week: MODIS count M, MODIS fire radiative power sum F, VIIRS S-NPP count V, NOAA-20 count J.

**3. Harmonisation model**

Weekly counts are many zeros plus a big spring peak, so we fit a negative binomial regression with a separate intercept for each region and month:

```latex
V_{r,w} \sim \mathrm{NegBin}(\mu_{r,w}, \phi), \quad \log \mu_{r,w} = \alpha_{r,m(w)} + \beta \log(M_{r,w}+1) + \gamma \log(F_{r,w}+1)
```

- The month term captures what the charts show: VIIRS sees about 4x more in the peak and 10x to 12x more in October to January.
- Challengers: (a) the naive single factor 4.4x, (b) 12 monthly factors, (c) gradient-boosted trees on the same features. We ship whichever wins validation; the regression is easier to explain to judges.
- Output: predicted VIIRS-equivalent count plus an 80% prediction interval for every region-week from 2003 to 2011.

**4. Validation**

- Leave one year out across 2012 to 2024 (13 folds): fit on 12 years, predict the 13th from MODIS only, compare with real VIIRS.
- Metrics: mean absolute error of weekly counts; error in season total; peak-week error in days; whether the year-to-year direction (up or down) matches VIIRS.
- The 2022 test year matters most: MODIS says fire fell 67% and VIIRS says 41%. A good model should land near VIIRS.

**5. Continuity bridge**

- Fit monthly S-NPP to NOAA-20 factors on 2019 to 2024 (national totals differ by 0.6%, so factors near 1.0 are expected).
- After 13:00 UTC on 2 November 2026, the series continues on NOAA-20 and NOAA-21 converted to the S-NPP scale. Mark the switch on every chart.

**6. Normals and alerts**

- Normal: for each region and week, the 2003 to 2025 distribution of cumulative season activity (from 1 January to that week).
- Alert levels: below normal (under 25th percentile), normal (25th to 75th), above normal (75th to 90th), extreme (over 90th).
- Wording is descriptive only: "activity so far is higher than in 8 of the last 10 years", never a forecast of individual fires.

**7. What we will not claim:** the 2003 to 2011 values are estimates with intervals, not observations. Weeks where MODIS saw nothing cannot reveal how many small fires VIIRS would have seen; the band shows that.

## System architecture

No database and no live server: a Python pipeline precomputes everything, a static site reads it, and a daily job refreshes the current season.

&#91;embedded content: system architecture · 8 pipeline steps, static hosting\]

Step 5 is the science; steps 6 and 7 are what make it trustworthy and keep it alive after the handover.

## Backend and pipeline spec

The backend is a Python pipeline that writes static JSON; there is no live server to break during judging.

**Stack:** Python 3.11, pandas, pyarrow, geopandas, shapely, statsmodels (negative binomial), scikit-learn or LightGBM (challenger), pytest, ruff. Runs on a laptop in under 5 minutes for Bangladesh.

**Modules**

| Module | Input | Output | Key functions |
| --- | --- | --- | --- |
| ingest.py | FIRMS CSVs, API | data/raw/\*.csv, detections.parquet | fetch\_country\_year(), fetch\_api(bbox, source, days), normalise\_columns() |
| regions.py | detections, boundaries GeoJSON | detections with region\_id, district\_id | tag\_regions() via spatial join |
| kilns.py | detections | static\_cells.parquet, filtered detections | flag\_static\_cells(min\_months=4, min\_years=3) |
| aggregate.py | filtered detections | region\_week.parquet | to\_region\_week() |
| harmonise.py | region\_week | model.pkl, harmonised.parquet | fit\_nb(), predict\_with\_interval(), loyo\_validate() |
| bridge.py | region\_week (S-NPP, NOAA-20, NOAA-21) | bridge\_factors.json | fit\_monthly\_factors() |
| climatology.py | harmonised | normals.parquet | percentiles\_by\_week() |
| export.py | all of the above | web/public/data/\*.json | write\_region\_json(), write\_manifest() |

**Tables**

- detections: sensor, satellite, lat, lon, acq\_datetime\_utc, confidence\_norm (0 to 1), frp\_mw, daynight, type, region\_id, district\_id, static\_flag
- region\_week: region\_id, iso\_year, iso\_week, sensor, count, frp\_sum
- harmonised: region\_id, iso\_year, iso\_week, value, lo80, hi80, source (observed or estimated)

**JSON contract for one region** (what the front end reads)

```json
{
  "region": {"id": "bandarban", "name_en": "Bandarban", "name_bn": "বান্দরবান"},
  "updated_utc": "2026-11-14T06:00:00Z",
  "weeks": [{"y": 2024, "w": 14, "modis": 210, "viirs": 905, "naive": 924, "harm": 880, "lo": 780, "hi": 990, "src": "observed"}],
  "season": {"year": 2026, "to_week": 46, "cum": 1234, "pct": 82, "level": "above"},
  "handover": {"snpp_end_utc": "2026-11-02T13:00:00Z"},
  "static_removed": 412
}
```

**Static endpoints** (served by GitHub Pages)

- /data/manifest.json: list of regions, data date, model version
- /data/region/{id}.json: as above
- /data/national.json: same shape, whole country
- /data/download/harmonised.csv: full series with intervals

**Scheduling:** a GitHub Action runs daily at 06:00 UTC: pull the last 7 days from the FIRMS API (MAP\_KEY stored as a repository secret), re-aggregate the current year, re-export JSON, commit to the gh-pages branch. Historical years are frozen.

**Tests:** our 2003 to 2021 MODIS total must equal 54,669 (matches Farukh et al.); every exported week has lo80 <= harm <= hi80; JSON validates against a schema; LOYO metrics are written to validation.json and shown on the method page.

## Frontend spec

A mobile-first single-page app with four screens; every screen answers one question and works in Bangla and English.

**Stack:** React 18 + Vite + TypeScript, D3 (scales, calendar), Observable Plot or hand-built SVG for line charts, MapLibre GL with a free OpenStreetMap-based style, i18next for Bangla/English, html-to-image for share cards, Tailwind CSS. Deployed on GitHub Pages.

**Screens**

| Screen | Question it answers | Main components | Key interactions |
| --- | --- | --- | --- |
| Home: This season | Is this fire season normal where I care about? | Region picker, SeasonCard (level, percentile, sentence), mini calendar row, Share button | Pick region; tap card for detail; share PNG |
| Panjika: Fire calendar | How has the fire season changed over 22+ years? | CalendarHeatmap (weeks x years), legend, year highlight, handover marker | Hover or tap a cell: week, value, interval, source; click a year to highlight |
| Sensors: Why harmonise | Why can't we trust the raw record? | SensorToggle (Raw MODIS, Raw VIIRS, Naive 4.4x, Harmonised), annual line chart, monthly ratio bars, validation scores | Toggle series; drag a year range; see error metrics update |
| Map | Where is it burning? | MapLibre district choropleth (season percentile), weekly detection dots, kiln layer | Zoom; toggle kiln filter; week slider |
| Method and data | How was this made, can I use it? | Method text, validation table, download links, citation | Download CSV; copy citation |

**Component contract:** every chart component takes the region JSON (see Backend spec) and a `series` prop; no component fetches data on its own. Hover tooltips show value, interval and whether the number is observed or estimated.

**Design system**

- Concept: an almanac, not a dashboard. Warm paper background, ink text, ember colours only for fire.
- Colour tokens: background #FAF7F2, ink #1F1B16, muted ink #6B6259, grid #E6E0D6; fire sequential ramp (one hue, light to dark) #FDE6CF, #F9B47A, #EE7A35, #C84B1A, #7F2A0C; harmonised series accent #C84B1A; raw sensors in greys; alert levels with icon + word (never colour alone).
- Dark mode: its own palette (background #16130F, ramp re-stepped for contrast), not an automatic invert.
- Type: Noto Sans Bengali for Bangla, Inter for Latin; numerals in tabular figures; minimum 14 px body on mobile.
- Calendar cell: 10 x 10 px on mobile, 14 x 14 on desktop, 1 px gap; current year outlined.
- Accessibility: WCAG AA contrast, keyboard focus on every cell and toggle, a table view for every chart, screen-reader labels from the same data.

**Bangla copy examples**

- Season card: "এই মৌসুমে আগুন স্বাভাবিকের চেয়ে বেশি" (fire this season is above normal)
- Have a native speaker on the team check every string; avoid words that blame farmers.

**Performance:** under 300 KB of JS gzipped, region JSON under 100 KB, first paint under 3 s on mobile 4G; works offline after first load (service worker caches JSON).

## Impact

The impact is that decisions about fire, land and air in Bangladesh can rest on one trustworthy 26-year record instead of two records that disagree and one that is ending.

**Theory of change**

1. NASA data (MODIS, VIIRS S-NPP, NOAA-20, NOAA-21) goes in.
2. Agun Panjika produces a harmonised series, a calendar, a season alert and a bridge across the handover.
3. People act on it: patrols timed to an early season, advisories timed to regional burning, NGOs documenting change with evidence, journalists reporting real trends.
4. Outcome: fewer decisions made on a fake jump or a broken record, and earlier preparation in above-normal seasons.

**Who acts on what**

| Who | What they see | What they do differently |
| --- | --- | --- |
| Forest Department (CHT divisions) | Season running above normal, earlier peak | Move patrols and firebreak work earlier |
| Department of Environment | Regional burning rising upwind | Time public air-quality advisories |
| CHT community organisations | Their area's burning against 22 years | Plan and document, with evidence they own |
| Researchers | One consistent series with intervals | Study trends without a sensor artefact |
| Other countries | Open pipeline with a country config | Bridge their own record before MODIS ends |

**Scale beyond Bangladesh:** every country with a fire record built on MODIS faces the same break. The pipeline is country-agnostic, so the same code can be run for any FIRMS country file.

**Honest limits on impact:** the app informs; it does not stop fires. The 2003 to 2011 values are estimates. Uptake by government depends on outreach after the hackathon, which we plan to start with the Forest Department's Chattogram circle and CHT NGOs.

## Judging rubric mapping

Each of the five 20-point criteria has a specific piece of evidence we show; the weakest is Impact, so the story and the alert carry it.

| Criterion (20 pts each) | Evidence we show | Where it appears | Risk |
| --- | --- | --- | --- |
| Impact | Named users and decisions; 2017 landslides, 2019 air-pollution deaths and the 2 Nov handover as stakes | Story, Home screen, Impact section | Medium: judges may see "a better chart" |
| Creativity | Almanac-style calendar; sensor truth toggle; handover bridge timed to the live switch | Panjika and Sensors screens | Low |
| Validity | Our counts match published totals exactly; leave-one-year-out scores vs naive; intervals | Sensors screen, Method page | Low if validation is run |
| Relevance | Solves the challenge text directly: harmonised MODIS and VIIRS into a burning calendar | Everywhere | Low |
| Presentation | One story line, real NASA charts, Bangla demo on a phone | All three videos | Medium: depends on editing |
| Data usage (NASA + partner) | FIRMS MODIS and VIIRS; partner-agency fire product as cross-check | Data page | Medium until partner data is confirmed |

**Bonus:** the team has 2 women members, which qualifies for the women-participation bonus as entered on the form.

## Presentation plan

Every video tells the same arc: the hills burn, the record that watches them is breaking, we fix it, here is who acts on it.

**Story arc (all formats)**

1. **Hook:** "Every April the hills burn. Every June they slide. Every winter the cities breathe smoke."
2. **Stakes:** 160 dead in the June 2017 landslides; up to 88,229 air-pollution deaths in 2019; S-NPP stops on 2 November 2026.
3. **Problem on screen:** the stitched-record chart: fires "quadruple" overnight in 2012.
4. **Fix:** Agun Panjika: the calendar, the toggle, the alert in Bangla.
5. **Proof:** our counts match published totals; held-out years beat the naive factor.
6. **People:** the Forest Officer in Bandarban checking the season on her phone.
7. **Close:** "A fire record that doesn't break when the satellites do."

**Video 1: 240-second prescreening (due 10 Oct, 11:59 PM)**

| Time | On screen | Voiceover |
| --- | --- | --- |
| 0:00 to 0:20 | Dark map of Bangladesh; April 2024 FIRMS detections light up over the hill tracts | "Every April, the hills of Bangladesh burn. Every June, they slide. Every winter, our cities breathe smoke. For 26 years, NASA satellites have watched all of it." |
| 0:20 to 0:40 | Three headline cards: 2017 landslides, 2019 air pollution, Suomi NPP alert | "In June 2017, landslides in these hills killed 160 people. In 2019, air pollution killed up to 88,000 Bangladeshis. And on 2 November, one of the satellites that watches our fires stops sending data." |
| 0:40 to 1:15 | The stitched-record chart, then the monthly ratio chart | "This is our fire record. In 2012 a new sensor arrived, and fires seem to quadruple overnight: 2,667 to 10,815. Nothing changed on the ground. The new sensor just sees more: 4 times more in April, 12 times more in November. One conversion number cannot fix that." |
| 1:15 to 2:15 | App mockup: Home season card in Bangla, calendar, toggle, map | "Agun Panjika, the Fire Almanac, joins both sensors into one honest record, season by season. It removes brick kilns that look like fires. It shows 22 years of fire seasons as one calendar. And it tells you, in Bangla, whether this season is normal." |
| 2:15 to 2:55 | Method diagram; validation table; handover marker on 2 Nov | "We learned how the sensors differ over 13 years they flew together, tested it on years the model never saw, and carried the record onto NOAA-20 and NOAA-21, so it keeps going after the switch." |
| 2:55 to 3:30 | Personas: forest officer, air-quality analyst, community organiser | "A forest officer can see that this season is starting early. An air-quality team can see regional burning rising. A hill community can see its own history, in its own language." |
| 3:30 to 3:55 | Team KUETaguns, KUET campus, logo | "We are KUETaguns from KUET, Khulna. Agun Panjika: a fire record that doesn't break when the satellites do." |

**Video 2: demo for local judging (due 13 Nov, 6:30 PM)**

- Screen recording on a phone frame, 60 to 70% of the time on the live app.
- Show one journey end to end (Forest Officer, March), then the sensor toggle and validation scores.
- End on the handover marker and the live NOAA-20 data after 2 November.

**Video 3: 30 seconds for global judging (due 14 Nov, 12:00 PM)**

> "NASA has watched Earth's fires for 26 years with two sensors that disagree, and one is switching off this month. In Bangladesh, joining them makes fires quadruple overnight. Agun Panjika fixes the record season by season, keeps it running on the next satellites, and tells people in their own language whether this fire season is normal. A fire record that doesn't break when the satellites do."

**Submission form text (tonight)**

- *Project name:* Agun Panjika: A Fire Almanac That Survives the Satellite Handover
- *Project description:* Agun Panjika harmonises 26 years of NASA MODIS and VIIRS fire detections over Bangladesh into one consistent record. The two sensors disagree by 2x to 12x depending on the season, and the older satellites are retiring (Suomi NPP data ends 2 Nov 2026), so long-term fire trends are about to break. Our web app shows a fire calendar, a sensor comparison, a brick-kiln filter and a Bangla alert that tells forest officers, NGOs and researchers whether this fire season is normal, and it carries the record onto NOAA-20 and NOAA-21.
- *NASA data source:* NASA FIRMS active fire data: MODIS Collection 6.1 (Terra and Aqua) and VIIRS 375 m (Suomi NPP, NOAA-20, NOAA-21).

## Delivery plan

Roles, the week-by-week timeline and the tonight checklist live in Agun Panjika — Hot Spots Implementation Plan; this section adds the build order and the risks specific to the PRD.

**Build order (each step is demo-able on its own)**

1. Pipeline: ingest, regions, kiln filter, region-week table. Check: MODIS 2003 to 2021 = 54,669.
2. Validation notebook: naive, monthly factors, negative binomial, leave-one-year-out scores.
3. Export JSON; Sensors screen with the toggle (the most persuasive screen, build it first).
4. Panjika calendar; Home season card; Bangla strings.
5. Map; share card; daily GitHub Action with the FIRMS API.
6. Stretch: borderless hill view, upwind smoke view, IMERG overlay.

**Risks**

| Risk | Likelihood | Fallback |
| --- | --- | --- |
| Rules limit work before 14 Nov | Unknown | Ask the Local Lead; keep pre-event work to data prep and disclose it |
| Model does not beat 12 monthly factors | Medium | Ship monthly factors; still far better than the single 4.4x |
| FIRMS API key or rate limits slow live updates | Low | Pre-download 2025 to 2026 via the archive tool; live update is a stretch |
| Prior-art challenge from judges | Certain | Cite Zheng et al. 2026; our novelty is the handover bridge, the calendar and the users |
| Jhum framing reads as blame | Medium | Descriptive language; ask a CHT member or NGO to review copy |
| S-NPP end date moves | Possible | NASA says it may change; show the date from the manifest, not hard-coded |

## Sources

- [NASA FIRMS country yearly CSVs](https://firms.modaps.eosdis.nasa.gov/country/): MODIS, VIIRS S-NPP and NOAA-20 files for Bangladesh, 2000 to 2024; all counts in this PRD computed by us on 9 Oct 2026
- [NASA Earthdata: Suomi NPP observations to cease on November 2, 2026](https://www.earthdata.nasa.gov/data/alerts-outages/suomi-npp-observations-cease-november-2-2026)
- [NASA Earthdata: Transition from MODIS to VIIRS](https://www.earthdata.nasa.gov/data/alerts-outages/transition-from-modis-viirs)
- [Farukh, Islam and Hayasaka 2023, Wildland Fires in the Subtropical Hill Forests of Southeastern Bangladesh, Atmosphere 14(1):97](https://www.mdpi.com/2073-4433/14/1/97)
- [Zheng et al. 2026, Fire Radiative Power Correction and Spatiotemporal Fusion Based on MYD14 and VNP14IMG, Remote Sensing 18:1650](https://mdpi-res.com/d_attachment/remotesensing/remotesensing-18-01650/article_deploy/remotesensing-18-01650.pdf)
- [Osman et al. 2013, Effect of shifting cultivation on soil properties in Bandarban, Journal of Forestry Research](https://link.springer.com/article/10.1007/s11676-013-0368-3)
- [Rahman et al. 2020, Assessing the PM2.5 impact of biomass combustion in megacity Dhaka, Environmental Pollution 264](https://agris.fao.org/search/fr/records/65df124963b8185d9caa928d)
- [World Bank 2022, air pollution and health in Bangladesh](https://www.worldbank.org/en/news/press-release/2022/12/03/high-air-pollution-level-is-creating-physical-and-mental-health-hazards-in-bangladesh-world-bank)
- [ACAPS 2017, Bangladesh landslides](https://www.acaps.org/en/countries/archives/detail/bangladesh-landslides)
- [The New Humanitarian 2019, Bangladesh landslides and Indigenous communities](https://www.thenewhumanitarian.org/analysis/2019/06/25/Bangladesh-landslides-climate-change-Indigenous)
- [Down To Earth 2021, Mizoram fires](https://www.downtoearth.org.in/news/natural-disasters/fires-rage-on-in-mizoram-s-lawngtlai-under-control-elsewhere-76701)
- [NASA Space Apps 2026 challenges](https://www.spaceappschallenge.org/2026/challenges/): team counts (Hot Spots: 214 global, 3 Khulna)
