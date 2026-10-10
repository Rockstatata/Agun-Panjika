"""Run the full pipeline.

    python -m pipeline.run_all                          # archive country files, cached
    python -m pipeline.run_all --api-since 2025-01-01   # + FIRMS API backfill to today (needs FIRMS_MAP_KEY)
    python -m pipeline.run_all --api-since 2025-01-01 --neighbours   # + cross-border and upwind views
    AP_COUNTRY=pipeline/countries/npl.json python -m pipeline.run_all   # any other FIRMS country

Steps: ingest -> regions -> kilns -> aggregate -> weather (NASA POWER) -> fireweather (FWI + forecast)
       -> harmonise -> bridge -> climatology -> export -> partner (ESA Fire_cci)
       -> forecast (outlooks, alerts, RSS/CAP) [-> neighbours]
"""

from __future__ import annotations

import argparse
import time

from pipeline import (
    aggregate,
    bridge,
    climatology,
    export,
    fireweather,
    forecast,
    harmonise,
    ingest,
    kilns,
    local,
    neighbours,
    partner,
    regions,
    weather,
)


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--api-days", type=int, default=0)
    p.add_argument("--api-since", default=None)
    p.add_argument("--last", type=int, default=None)
    p.add_argument("--neighbours", action="store_true", help="also build the cross-border and upwind views")
    p.add_argument("--skip-partner", action="store_true", help="skip the ESA burned-area download")
    args = p.parse_args()

    ingest_args = ["--api-days", str(args.api_days)]
    if args.api_since:
        ingest_args += ["--api-since", args.api_since]
    if args.last:
        ingest_args += ["--last", str(args.last)]
    steps = [
        ("ingest", lambda: ingest.main(ingest_args)),
        ("regions", regions.main),
        ("kilns", kilns.main),
        ("aggregate", aggregate.main),
        ("weather", weather.main),
        ("fireweather", fireweather.main),
        ("harmonise", harmonise.main),
        ("bridge", bridge.main),
        ("climatology", climatology.main),
        ("export", export.main),
    ]
    from pipeline.config import DEFAULT_COUNTRY

    if DEFAULT_COUNTRY:  # union/upazila calendars and the ESA check are set up for Bangladesh
        steps.append(("local", local.main))
    else:
        args.skip_partner = True
    if not args.skip_partner:
        steps.append(("partner", partner.main))
    steps.append(("forecast", forecast.main))
    if args.neighbours:
        steps.append(("neighbours", neighbours.main))
    t0 = time.time()
    for name, fn in steps:
        t = time.time()
        print(f"== {name}", flush=True)
        fn()
        print(f"   {name} done in {time.time() - t:.1f}s", flush=True)
    print(f"pipeline finished in {time.time() - t0:.0f}s")


if __name__ == "__main__":
    main()
