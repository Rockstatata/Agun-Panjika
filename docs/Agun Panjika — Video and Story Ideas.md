# Agun Panjika: video and story ideas

Brainstorm for the three videos (prescreen, local demo, 30-second global). Every number below comes from the pipeline as of 10 Oct 2026. Re-run `python notebooks/figures.py` before recording so the charts and numbers match the live app.

## What makes us different (pick 3 per video)

Judges will see many dashboards. These ideas are things only this project has.

| # | Idea | Why it is ours | Asset ready? |
| --- | --- | --- | --- |
| 1 | **The handover, live.** On 2 Nov 2026 Suomi NPP stops. We show the line continuing on NOAA-20/21 the next morning, with no jump. | The competition happens during the switch. No other team can film this on 13 Nov. | Daily job + Sensors screen. Screen-record on 3 to 10 Nov. |
| 2 | **"Listen to the record."** Twenty-four years of fire as sound. The raw stitched record suddenly gets loud in 2012; ours does not. | You can *hear* the sensor artefact. It's memorable and works for blind users. | Sensors screen, "Listen" buttons. |
| 3 | **Same fires, same afternoon.** 6 Apr 2019, Bandarban: Aqua MODIS saw 119 fires, Suomi NPP VIIRS saw 525. Big 1 km squares against small 375 m squares. | Explains the 4.4× ratio in one frame, with real pixels. | `docs/figures/08_two_satellites_one_afternoon.png` |
| 4 | **An independent witness.** ESA's Sentinel-3 burned-area maps (a different measurement) show no jump in 2012 (0.89×), while the stitched record jumps 3.09×. | Validation from a partner agency's satellite, not from our own model. | `05_esa_crosscheck.png`, Method screen |
| 5 | **Kilns glow at night.** Brick kilns, gas flares and power plants are seen in night passes; crop burning by day. One rule took our kiln filter from ~55% to 80% precision, checked on 60 satellite images. | A small physical insight, shown with satellite imagery of the flagged sites. | `docs/kiln_spotcheck_round*.csv`, tile sheets |
| 6 | **The almanac.** A *panjika* is the Bengali almanac every household knows. Open a paper almanac; its page dissolves into our 24-year fire calendar. | A cultural anchor for Bangladeshi judges; it explains the name. | `06_calendar.png` + a real panjika prop |
| 7 | **My union's fire history.** A CHT community member finds her own union (one of 124) and sees 24 years of its burning. | Local data, in Bangla, owned by the community. | Calendar screen → Rangamati → Union |
| 8 | **Fire weather 15 days ahead.** The danger strip turns orange before the fire season; the two-week outlook says "elevated". | From history to early warning. Hindcast-tested, honest skill. | Outlook screen |
| 9 | **Borders fade.** Animate the map: CHT, Mizoram, Tripura and Chin burn in the same weeks. The border lines fade out. | "Fire ignores borders" made visual, with the 2021 Mizoram fires. | Borders screen |
| 10 | **The smoke clock.** Punjab and Haryana burning peaks in late October; Dhaka's aerosol rises in the weeks after. Timing only, no blame. | Ties the record to the air people breathe. | Borders screen, upwind chart |
| 11 | **A real CAP alert.** The alert arrives on a phone as a Bangla notification, from the same CAP 1.2 standard disaster agencies use. | Shows it plugs into existing warning systems. | `alerts_cap.xml`, `alerts_bn.rss` (use any RSS reader app) |
| 12 | **The printed report.** A forest officer hands a printed one-page Bangla season report to a field ranger. Paper still works where the network does not. | Shows we designed for the field, not for a demo. | Home → Print report |

## Numbers worth saying on camera

- **54,669.** Our MODIS count for 2003–2021 matches the published study exactly.
- **4× to 13×.** VIIRS sees about 4× more fire than MODIS in April and 13× more in November.
- **37% less error** than the 4.4× conversion factor, on years the model never saw.
- **13 of 13** held-out years: better than the single factor in the off-season.
- **Within 3 days:** the peak fire week, predicted from MODIS alone.
- **0.89× vs 3.09×:** the 2012 jump, as judged by ESA's independent burned-area maps.
- **81%:** how often our "80% range" actually contained the truth.
- **1.65×:** fire in weeks with the worst fire weather, against normal.
- **80%:** kiln filter precision, checked by eye on satellite imagery.

## Video 1: 240-second prescreen (story-first)

| Time | Picture | Voice (draft) |
| --- | --- | --- |
| 0:00–0:15 | A paper panjika opens; the page dissolves into the fire calendar (idea 6). | "Every Bengali home has a panjika, an almanac of the seasons. This is the almanac of our fires." |
| 0:15–0:35 | April 2024 detections light up the hill tracts; then landslide and smog headlines. | "Every April the hills burn. Every June they slide. Every winter the cities breathe smoke. For 26 years NASA watched it all." |
| 0:35–1:05 | Two-satellite figure (idea 3), then the stitched jump chart. | "But two satellites count differently. Same fires, same afternoon: 119 here, 525 there. Join their records and fire seems to quadruple overnight in 2012. It never happened." |
| 1:05–1:20 | Sound: play the stitched record and the jump; then ours, smooth (idea 2). | "You can even hear it." |
| 1:20–1:40 | Earthdata alert: Suomi NPP ends 2 Nov 2026. | "And on 2 November, one of those satellites switches off. The record is about to break again." |
| 1:40–2:30 | App on a phone in Bangla: season card, calendar, outlook, union calendar (ideas 7, 8). | "Agun Panjika joins both sensors into one record, season by season, and tells you in Bangla whether this season is normal, two weeks ahead, down to your own union." |
| 2:30–3:05 | ESA witness chart (idea 4) and the numbers. | "We tested it on years it never saw: 37% less error. And ESA's Sentinel-3 agrees: no jump." |
| 3:05–3:35 | Forest officer, NGO worker, air-quality analyst; a printed report changes hands (idea 12). | "For the officer timing patrols. For the community documenting its own land. For the city watching the smoke come." |
| 3:35–3:55 | Team at KUET; tagline. | "We are KUETaguns. Agun Panjika: a fire record that doesn't break when the satellites do." |

## Video 2: local demo (product-first, after 2 Nov)

1. **Open on idea 1.** The Sensors screen on 3 Nov: the handover marker, and NOAA-20/21 data already flowing.
2. **Forest Officer journey in Bangla.** Bandarban → season card → outlook → fire-weather strip → print report.
3. **NGO journey.** Calendar → Rangamati → Union → their union's 24 years.
4. **Researcher journey.** The Sensors toggle, "Listen", validation table, ESA check, CSV download.
5. **Alerts.** A CAP alert arriving in an RSS reader (idea 11).
6. **Close.** "Fire ignores borders" (idea 9), then the tagline.

## Video 3: 30 seconds (global)

> "Two NASA satellites watched Bangladesh's fires for 26 years, and they disagree: same afternoon, 119 fires versus 525. On 2 November one switched off. Agun Panjika joins them into one record, keeps it running on the next satellites, checks it against ESA's Sentinel-3, and warns communities two weeks ahead, in Bangla. A fire record that doesn't break when the satellites do."

Picture: idea 3 (2 s), stitched jump (3 s), handover marker live (4 s), phone with Bangla outlook (8 s), ESA chart (4 s), union calendar (4 s), logo (5 s).

## Shooting notes

- **Screen recordings.** Record the deployed site, not localhost, at a 390×844 phone frame and 1920×1080 desktop, in both languages.
- **Data dates.** Re-run the pipeline the morning you record, so the live data date shows.
- **Unclear items.** Don't film kiln cells marked "U" as kilns. Use the clear "Y" power plant and steel mill cells.
- **Wording.** Say "detected fire" and "outlook", never "predicts fires" or "caused".
- **Jhum.** Avoid words that blame jhum farmers; show the community as users, not causes.
- **Music.** Use the sonification itself as the soundtrack under the title.
