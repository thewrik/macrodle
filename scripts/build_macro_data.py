#!/usr/bin/env python3
"""Build broad Macrodle country data from public World Bank + REST Countries data.

The game needs complete numeric fields for scoring. World Bank coverage is uneven,
so this script uses latest available observations where possible and fills sparse
missing values with region/income/global medians while marking estimated fields.
"""
from __future__ import annotations

import json
import math
import statistics
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data.js"
SOURCES = ROOT / "data" / "macro_sources.json"

REST_URL = "https://raw.githubusercontent.com/mledoze/countries/master/countries.json"
WB_COUNTRIES_URL = "https://api.worldbank.org/v2/country?format=json&per_page=400"
WB_INDICATORS = {
    "gdp": "NY.GDP.MKTP.KD.ZG",        # GDP growth, annual %
    "inf": "FP.CPI.TOTL.ZG",          # Inflation, consumer prices, annual %
    "ca": "BN.CAB.XOKA.GD.ZS",        # Current account balance, % GDP
    "debt": "GC.DOD.TOTL.GD.ZS",      # Central government debt, % GDP
    "rate": "FR.INR.LEND",            # Lending interest rate, %, used as policy-rate proxy
}
START_YEAR = 2019
END_YEAR = 2025

MANUAL_ALIASES = {
    "United States": ["USA", "US", "U.S.", "U.S.A.", "America", "United States of America"],
    "United Kingdom": ["UK", "U.K.", "Britain", "Great Britain"],
    "South Korea": ["Korea", "Republic of Korea", "ROK"],
    "North Korea": ["DPRK", "Democratic People's Republic of Korea"],
    "Russia": ["Russian Federation"],
    "Turkey": ["Türkiye", "Turkiye"],
    "Türkiye": ["Turkey", "Turkiye"],
    "Czechia": ["Czech Republic"],
    "Iran": ["Islamic Republic of Iran"],
    "Syria": ["Syrian Arab Republic"],
    "Vietnam": ["Viet Nam"],
    "Laos": ["Lao PDR", "Lao People's Democratic Republic"],
    "Bolivia": ["Plurinational State of Bolivia"],
    "Tanzania": ["United Republic of Tanzania"],
    "Moldova": ["Republic of Moldova"],
    "Venezuela": ["Bolivarian Republic of Venezuela"],
    "Ivory Coast": ["Côte d'Ivoire", "Cote d Ivoire"],
    "Cape Verde": ["Cabo Verde"],
    "Eswatini": ["Swaziland"],
    "Myanmar": ["Burma"],
    "Timor-Leste": ["East Timor"],
    "Democratic Republic of the Congo": ["DRC", "Congo Kinshasa", "Democratic Republic of Congo"],
    "Republic of the Congo": ["Congo Brazzaville", "Republic of Congo"],
}

PEGGED_OR_MANAGED = {
    "Saudi Arabia", "United Arab Emirates", "Qatar", "Bahrain", "Oman", "Kuwait", "Jordan", "Hong Kong",
    "Denmark", "Morocco", "China", "Egypt", "Vietnam", "Bolivia", "Belize", "Panama", "Barbados", "Bahamas",
    "Cuba", "Eritrea", "Djibouti", "Comoros", "Cabo Verde", "Cape Verde", "Bosnia and Herzegovina",
}

MAJOR_DM = {"United States", "United Kingdom", "Germany", "France", "Italy", "Japan", "Canada", "Australia", "South Korea", "Spain", "Netherlands", "Switzerland", "Sweden", "Norway", "Denmark", "Finland", "Belgium", "Austria", "Ireland", "New Zealand", "Singapore", "Israel"}


def fetch_json(url: str):
    req = urllib.request.Request(url, headers={"User-Agent": "macrodle-data-builder/1.0"})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=45) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            if exc.code == 429 and attempt < 3:
                time.sleep(2 ** attempt)
                continue
            raise


def latest_value(rows, start=START_YEAR, end=END_YEAR):
    best = None
    for row in rows or []:
        if not isinstance(row, dict):
            continue
        try:
            year = int(row.get("date"))
        except (TypeError, ValueError):
            continue
        value = row.get("value")
        if value is None or year < start or year > end:
            continue
        try:
            value = float(value)
        except (TypeError, ValueError):
            continue
        if math.isnan(value):
            continue
        if best is None or year > best[0]:
            best = (year, value)
    return best


def build_indicator(indicator: str):
    url = f"https://api.worldbank.org/v2/country/all/indicator/{indicator}?format=json&per_page=20000&date={START_YEAR}:{END_YEAR}"
    payload = fetch_json(url)
    rows = payload[1] if isinstance(payload, list) and len(payload) > 1 else []
    grouped = {}
    for row in rows:
        country = row.get("countryiso3code")
        if not country:
            continue
        grouped.setdefault(country, []).append(row)
    return {iso: latest_value(records) for iso, records in grouped.items() if latest_value(records)}


def median(values, default):
    vals = [float(v) for v in values if isinstance(v, (int, float)) and not math.isnan(float(v))]
    return statistics.median(vals) if vals else default


def clamp(x, lo, hi):
    return max(lo, min(hi, x))


def status_from_income(name, income):
    if name in MAJOR_DM or income == "High income":
        return "DM"
    if income in {"Upper middle income", "Lower middle income"}:
        return "EM"
    return "Frontier"


def fx_regime(name, status):
    if name in PEGGED_OR_MANAGED:
        return "Pegged" if name in {"Saudi Arabia", "United Arab Emirates", "Qatar", "Bahrain", "Oman", "Kuwait", "Hong Kong", "Panama"} else "Managed Float"
    return "Free Float" if status in {"DM", "EM"} else "Managed Float"


def blurb(country):
    estimates = country.get("estimates", [])
    estimate_note = " Some values are median-filled estimates because public macro coverage is sparse." if estimates else ""
    ca = "surplus" if country["ca"] >= 0 else "deficit"
    return (
        f"{country['name']} is classified here as {country['status']} with a {country['fx'].lower()} exchange-rate setup. "
        f"The latest macro snapshot shows {country['gdp']:.1f}% growth, {country['inf']:.1f}% inflation, "
        f"a {country['rate']:.1f}% rate proxy, a current-account {ca}, and debt around {country['debt']:.0f}% of GDP."
        f"{estimate_note}"
    )


def main():
    rest = fetch_json(REST_URL)
    wb_meta = fetch_json(WB_COUNTRIES_URL)
    wb_countries = {}
    for c in (wb_meta[1] if isinstance(wb_meta, list) and len(wb_meta) > 1 else []):
        if c.get("id") and c.get("region", {}).get("id") != "NA":
            wb_countries[c["id"]] = {
                "income": c.get("incomeLevel", {}).get("value") or "",
                "region": c.get("region", {}).get("value") or "",
            }

    indicators = {key: build_indicator(ind) for key, ind in WB_INDICATORS.items()}
    raw_values = {key: {} for key in WB_INDICATORS}

    countries = []
    for c in rest:
        iso3 = c.get("cca3")
        latlng = c.get("latlng") or []
        if not iso3 or iso3 not in wb_countries or len(latlng) < 2:
            continue
        common = (c.get("name") or {}).get("common") or iso3
        official = (c.get("name") or {}).get("official") or ""
        income = wb_countries[iso3]["income"]
        status = status_from_income(common, income)
        region = c.get("region") or wb_countries[iso3]["region"] or "Other"
        row = {
            "name": common,
            "officialName": official,
            "iso": iso3,
            "cca2": c.get("cca2") or "",
            "fifa": c.get("cioc") or "",
            "aliases": sorted(set((c.get("altSpellings") or []) + MANUAL_ALIASES.get(common, []))),
            "region": region,
            "subregion": c.get("subregion") or "",
            "incomeLevel": income,
            "status": status,
            "fx": fx_regime(common, status),
            "lat": round(float(latlng[0]), 3),
            "lng": round(float(latlng[1]), 3),
            "dataYear": {},
            "estimates": [],
        }
        for key in WB_INDICATORS:
            obs = indicators[key].get(iso3)
            if obs:
                year, value = obs
                row[key] = float(value)
                row["dataYear"][key] = year
                raw_values[key].setdefault((region, income), []).append(float(value))
                raw_values[key].setdefault((region, "*"), []).append(float(value))
                raw_values[key].setdefault(("*", "*"), []).append(float(value))
        countries.append(row)

    defaults = {"gdp": 2.0, "inf": 4.0, "ca": -1.0, "debt": 55.0, "rate": 7.0}
    for row in countries:
        for key in WB_INDICATORS:
            if key in row:
                continue
            value = median(
                raw_values[key].get((row["region"], row["incomeLevel"]), [])
                or raw_values[key].get((row["region"], "*"), [])
                or raw_values[key].get(("*", "*"), []),
                defaults[key],
            )
            row[key] = value
            row["dataYear"][key] = "median"
            row["estimates"].append(key)

        row["gdp"] = round(clamp(row["gdp"], -25, 25), 1)
        row["inf"] = round(clamp(row["inf"], -5, 120), 1)
        row["rate"] = round(clamp(row["rate"], 0, 80), 2)
        row["ca"] = round(clamp(row["ca"], -40, 60), 1)
        row["debt"] = round(clamp(row["debt"], 0, 250), 0)
        row["blurb"] = blurb(row)

    countries.sort(key=lambda x: x["name"])
    OUT.write_text(
        "// Generated by scripts/build_macro_data.py from World Bank + REST Countries.\n"
        "// Macro values use latest available 2019-2025 observations; sparse fields are median-filled and marked in estimates.\n"
        "export const DATA = " + json.dumps(countries, ensure_ascii=False, indent=2) + ";\n"
    )
    SOURCES.parent.mkdir(exist_ok=True)
    SOURCES.write_text(json.dumps({
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "countryCount": len(countries),
        "sources": {"restCountries": REST_URL, "worldBankCountries": WB_COUNTRIES_URL, "worldBankIndicators": WB_INDICATORS},
        "notes": ["rate uses World Bank lending interest rate as a policy-rate proxy where policy rates are unavailable", "missing fields are filled with region/income/global medians and listed in each country's estimates array"],
    }, indent=2) + "\n")
    print(f"wrote {OUT}: {len(countries)} countries")


if __name__ == "__main__":
    main()
