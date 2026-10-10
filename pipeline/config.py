"""Shared paths and settings for the Agun Panjika pipeline.

Country-specific values live in a JSON file so the same code can run for any FIRMS
country file (PRD: any-country config). Bangladesh (``country.json``) is the default;
for another country:

    AP_COUNTRY=pipeline/countries/npl.json python -m pipeline.run_all

which reads and writes ``data/<iso3>/`` and ``build/<iso3>/data/`` instead of the
Bangladesh folders, so runs never mix.
"""

from __future__ import annotations

import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# Local secrets (FIRMS_MAP_KEY) from a gitignored .env file; real environment variables win.
_ENV = ROOT / ".env"
if _ENV.exists():
    for _line in _ENV.read_text(encoding="utf-8").splitlines():
        if "=" in _line and not _line.lstrip().startswith("#"):
            _k, _v = _line.split("=", 1)
            os.environ.setdefault(_k.strip(), _v.strip().strip('"'))

_COUNTRY_FILE = Path(os.environ.get("AP_COUNTRY", Path(__file__).parent / "country.json"))
if not _COUNTRY_FILE.is_absolute():
    _COUNTRY_FILE = ROOT / _COUNTRY_FILE
COUNTRY = json.loads(_COUNTRY_FILE.read_text(encoding="utf-8"))
DEFAULT_COUNTRY = COUNTRY["iso3"] == "BGD" and "AP_COUNTRY" not in os.environ

DATA = ROOT / "data" if DEFAULT_COUNTRY else ROOT / "data" / COUNTRY["iso3"].lower()
RAW = DATA / "raw"
PROCESSED = DATA / "processed"
BOUNDARIES = DATA / "boundaries"
WEB_DATA = ROOT / "web" / "public" / "data" if DEFAULT_COUNTRY else ROOT / "build" / COUNTRY["iso3"].lower() / "data"

# Metric CRS for distances: the UTM zone at the centre of the country's bbox (Bangladesh: 46N).
_lon = (COUNTRY["bbox"][0] + COUNTRY["bbox"][2]) / 2
_lat = (COUNTRY["bbox"][1] + COUNTRY["bbox"][3]) / 2
UTM_EPSG = (32600 if _lat >= 0 else 32700) + int((_lon + 180) // 6) + 1

FIRMS_BASE = "https://firms.modaps.eosdis.nasa.gov"

# FIRMS country-file folder name -> our sensor label.
SOURCES = {
    "modis": {"sensor": "modis", "first_year": 2000},
    "viirs-snpp": {"sensor": "snpp", "first_year": 2012},
    "viirs-jpss1": {"sensor": "noaa20", "first_year": 2018},
}

# FIRMS area API source names (near-real-time and standard processing).
API_SOURCES = {
    "modis": ["MODIS_SP", "MODIS_NRT"],
    "snpp": ["VIIRS_SNPP_SP", "VIIRS_SNPP_NRT"],
    "noaa20": ["VIIRS_NOAA20_SP", "VIIRS_NOAA20_NRT"],
    "noaa21": ["VIIRS_NOAA21_NRT"],
}

# Calibration and climatology windows.
OVERLAP_YEARS = range(2012, 2026)  # MODIS + S-NPP full years both available (2025 from the FIRMS API)
BRIDGE_YEARS = range(2019, 2026)  # S-NPP + NOAA-20 full years
HISTORY_FIRST_YEAR = 2003  # first full year with both MODIS satellites; start of the baseline for normals
RECORD_FIRST_YEAR = 2001  # first full MODIS (Terra) year; 2001 to mid-2002 come from the Terra-only model
AQUA_START = (2002, 27)  # ISO week Aqua MODIS data begin (4 July 2002)

for _d in (RAW, PROCESSED, BOUNDARIES, WEB_DATA):
    _d.mkdir(parents=True, exist_ok=True)
