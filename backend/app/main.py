"""Mausam Mitra API: provider failures are explicit and never replaced with invented values."""
from __future__ import annotations

import asyncio
import csv
import time
import json
import logging
import math
import os
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path
from typing import Literal

import httpx
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from .config import RISK_THRESHOLDS
from .database import DatabaseError, database

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data" / "geojson"
MODELS = {
    "NCEP GFS": ("https://api.open-meteo.com/v1/forecast", "ncep_gfs_global"),
    # ECMWF's dedicated endpoint defaults to the native 9 km HRES product.
    "ECMWF IFS HRES": ("https://api.open-meteo.com/v1/ecmwf", ""),
    "ECMWF AIFS": ("https://api.open-meteo.com/v1/forecast", "ecmwf_aifs025_single"),
    "GFS Ensemble Mean": ("https://api.open-meteo.com/v1/forecast", "ncep_gefs025_ensemble_mean"),
}

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_: FastAPI):
    await database.open()
    if database.configured:
        try:
            synced = await database.sync_locations(LOCATIONS)
            logger.info("Synced %s location records to Supabase", synced)
        except DatabaseError:
            logger.exception("Could not initialize the Supabase location catalog")
    try:
        yield
    finally:
        await database.close()


app = FastAPI(title="Mausam Mitra API", version="0.1.0", lifespan=lifespan)
cors_origins = {origin.strip().rstrip("/") for origin in os.getenv("CORS_ORIGINS", "").split(",") if origin.strip()}
cors_origins.update({"http://localhost:5173", "http://127.0.0.1:5173"})
app.add_middleware(CORSMiddleware, allow_origins=sorted(cors_origins), allow_methods=["*"], allow_headers=["*"])


class Location(BaseModel):
    id: str
    name: str
    level: Literal["state", "district"]
    parent_id: str | None = None
    latitude: float | None = None
    longitude: float | None = None


class ForecastRequest(BaseModel):
    location_id: str
    lead_hours: Literal[24, 48, 72] = 24
    weights: dict[str, float] | None = None


class ForecastSource(BaseModel):
    model: str
    status: Literal["available", "unavailable"]
    source_run_time: datetime | None = None
    valid_time: str | None = None
    rainfall_mm: float | None = None
    temperature_c: float | None = None
    wind_speed_kmh: float | None = None
    wind_direction_deg: float | None = None
    error: str | None = None


class RiskResult(BaseModel):
    type: str
    level: Literal["green", "yellow", "orange", "red", "unknown"]
    message: str
    value: float | None
    unit: str
    location: str
    prototype_guidance: bool


class ForecastResponse(BaseModel):
    location: Location
    lead_hours: Literal[24, 48, 72]
    fetched_at: datetime
    sources: list[ForecastSource]
    weights: dict[str, float]
    weight_method: str
    verification_reference: str
    blended: dict[str, float | None]
    risks: list[RiskResult]
    partial: bool
    explanation: str


@lru_cache(maxsize=1)
def read_geo(level: str) -> dict:
    path = DATA / f"IND_{level}.geojson"
    if not path.exists():
        raise HTTPException(503, "Boundary dataset is unavailable")
    return json.loads(path.read_text(encoding="utf-8"))


def feature_name(feature: dict, level: str) -> str:
    p = feature.get("properties", {})
    return str(p.get("NAME" if level == "ADM1" else "Name") or p.get("name") or "Unknown")


def feature_id(feature: dict, level: str) -> str:
    p = feature.get("properties", {})
    return f"{level.lower()}:{p.get('gbid') or p.get('ISO_Code') or p.get('feature_id')}"


def center_of(feature: dict) -> tuple[float, float]:
    coords = feature.get("geometry", {}).get("coordinates", [])
    pts: list[tuple[float, float]] = []
    def walk(v):
        if isinstance(v, list) and len(v) >= 2 and isinstance(v[0], (int, float)):
            pts.append((float(v[0]), float(v[1])))
        elif isinstance(v, list):
            for x in v: walk(x)
    walk(coords)
    if not pts: return (22.5, 79.0)
    return (sum(y for _, y in pts) / len(pts), sum(x for x, _ in pts) / len(pts))


def point_in_ring(point: tuple[float, float], ring: list) -> bool:
    x, y = point; inside = False
    for i, a in enumerate(ring):
        b = ring[(i + 1) % len(ring)]
        if (a[1] > y) != (b[1] > y) and x < (b[0] - a[0]) * (y - a[1]) / ((b[1] - a[1]) or 1e-12) + a[0]: inside = not inside
    return inside


def contains(feature: dict, lat: float, lon: float) -> bool:
    geom = feature.get("geometry", {}); typ = geom.get("type"); coords = geom.get("coordinates", [])
    polygons = coords if typ == "MultiPolygon" else [coords]
    for poly in polygons:
        if poly and point_in_ring((lon, lat), poly[0]) and not any(point_in_ring((lon, lat), hole) for hole in poly[1:]): return True
    return False


def all_locations() -> list[Location]:
    state_features = read_geo("ADM1")["features"]
    states = [Location(id=feature_id(f, "ADM1"), name=feature_name(f, "ADM1"), level="state", latitude=center_of(f)[0], longitude=center_of(f)[1]) for f in state_features]
    state_by_name = {s.name.casefold(): s for s in states}
    districts = []
    for f in read_geo("ADM2")["features"]:
        props = f.get("properties", {})
        # ADM2 source exposes district names only; choose a state by available parent attributes when present.
        parent_name = props.get("State_Name") or props.get("state") or props.get("NAME_1") or props.get("ST_NM")
        lat, lon = center_of(f)
        parent = state_by_name.get(str(parent_name).casefold()) if parent_name else None
        if not parent:
            parent = next((s for sf, s in zip(state_features, states) if contains(sf, lat, lon)), None)
        if not parent:
            # Island districts and a few 2011-era boundaries can have a coordinate mean
            # outside their multipart polygon; use the nearest state center as a fallback.
            parent = min(states, key=lambda s: (lat - (s.latitude or 0)) ** 2 + ((lon - (s.longitude or 0)) * math.cos(math.radians(lat))) ** 2)
        districts.append(Location(id=feature_id(f, "ADM2"), name=feature_name(f, "ADM2"), level="district", parent_id=parent.id if parent else None, latitude=lat, longitude=lon))
    return states + districts


LOCATIONS = all_locations()
LOCATION_MAP = {x.id: x for x in LOCATIONS}
FORECAST_CACHE: dict[tuple[str, int, tuple[tuple[str, float], ...]], tuple[float, dict]] = {}


def selectable_locations() -> tuple[list[Location], set[str]]:
    """Filter the existing GeoJSON location catalog using the approved city list.

    IDs and coordinates stay sourced from LOCATIONS; the CSV only restricts names.
    """
    path = ROOT / "data" / "state_city_terrain.csv"
    if not path.exists():
        logger.warning("State/city selection CSV is unavailable: %s", path)
        return [], set()

    # The CSV uses Indian state abbreviations; CT and UT are the corresponding
    # ISO suffixes in the supplied boundary file for CG and UK.
    code_aliases = {"CG": "CT", "UK": "UT"}
    state_codes = {
        str(feature.get("properties", {}).get("ISO_Code", "")).split("-")[-1].upper():
        feature_id(feature, "ADM1")
        for feature in read_geo("ADM1")["features"]
    }
    allowed_names: set[tuple[str, str]] = set()
    allowed_states: set[str] = set()
    with path.open(encoding="utf-8-sig", newline="") as source:
        for row in csv.DictReader(source):
            code = str(row.get("State", "")).strip().upper()
            city = str(row.get("City", "")).strip()
            state_id = state_codes.get(code_aliases.get(code, code))
            if state_id:
                allowed_states.add(state_id)
                if city:
                    allowed_names.add((state_id, city.casefold()))

    locations = [
        location for location in LOCATIONS
        if location.level == "district"
        and location.parent_id is not None
        and (location.parent_id, location.name.casefold()) in allowed_names
    ]
    return locations, allowed_states


SELECTABLE_LOCATIONS, CSV_STATE_IDS = selectable_locations()


@app.get("/api/health")
async def health():
    database_status = "not_configured"
    if database.configured:
        try:
            await database.ping()
            database_status = "connected"
        except DatabaseError:
            database_status = "unavailable"
    return {"status": "ok", "providers": list(MODELS), "database": database_status, "as_of": datetime.now(timezone.utc).isoformat()}


@app.get("/api/locations/regions")
async def regions():
    return [{"id": "india", "name": "India"}]


@app.get("/api/locations/states", response_model=list[Location])
async def states(region_id: str = "india"):
    if database.configured:
        try:
            rows = await database.get_locations(level="state")
            if rows:
                return [Location(id=x["id"], name=x["name"], level=x["level"], parent_id=x.get("parent_id"), latitude=x.get("lat"), longitude=x.get("lon")) for x in rows if x["id"] in CSV_STATE_IDS]
        except DatabaseError:
            logger.warning("Falling back to bundled state boundaries because Supabase is unavailable")
    return [x for x in LOCATIONS if x.level == "state" and x.id in CSV_STATE_IDS]


@app.get("/api/locations/districts", response_model=list[Location])
async def districts(state_id: str | None = None):
    allowed = [x for x in SELECTABLE_LOCATIONS if not state_id or x.parent_id == state_id]
    allowed_ids = {x.id for x in allowed}
    if database.configured:
        try:
            rows = await database.get_locations(level="district", parent_id=state_id)
            if rows:
                return [Location(id=x["id"], name=x["name"], level=x["level"], parent_id=x.get("parent_id"), latitude=x.get("lat"), longitude=x.get("lon")) for x in rows if x["id"] in allowed_ids]
        except DatabaseError:
            logger.warning("Falling back to bundled district boundaries because Supabase is unavailable")
    return allowed


async def fetch_model(client: httpx.AsyncClient, name: str, location: Location, hours: int) -> dict:
    url, model_id = MODELS[name]
    params = {"latitude": location.latitude, "longitude": location.longitude,
              "hourly": "precipitation,temperature_2m,wind_speed_10m,wind_direction_10m",
              "forecast_days": 4, "timezone": "UTC"}
    if model_id: params["models"] = model_id
    try:
        r = await client.get(url, params=params, timeout=12)
        r.raise_for_status()
        data = r.json(); hourly = data.get("hourly", {})
        end = min(hours + 1, len(hourly.get("time", []))); start = max(1, end - 24)
        def vals(k): return [x for x in hourly.get(k, [])[start:end] if isinstance(x, (int, float))]
        rain, temps, winds, dirs = vals("precipitation"), vals("temperature_2m"), vals("wind_speed_10m"), vals("wind_direction_10m")
        vectors = [(math.cos(math.radians(d)), math.sin(math.radians(d))) for d in dirs]
        direction = math.degrees(math.atan2(sum(y for _, y in vectors), sum(x for x, _ in vectors))) % 360 if vectors else None
        valid_times = hourly.get("time", [])
        return {"model": name, "status": "available", "source_run_time": None, "valid_time": valid_times[end - 1] if end else None,
                "rainfall_mm": sum(rain) if rain else None, "temperature_c": max(temps) if temps else None,
                "wind_speed_kmh": max(winds) if winds else None, "wind_direction_deg": direction, "error": None}
    except Exception as e:
        return {"model": name, "status": "unavailable", "rainfall_mm": None, "temperature_c": None, "wind_speed_kmh": None, "wind_direction_deg": None, "error": str(e)[:240]}


def weights_for(sources: list[dict], comparison_weights: dict[str, float] | None = None) -> tuple[dict, str]:
    if comparison_weights:
        return dict(comparison_weights), "model_comparison_weights"
    # No verified history has been configured; equal weights are explicitly labelled a demo fallback.
    available = [s["model"] for s in sources if s["status"] == "available"]
    if not available: return {}, "unavailable"
    return {name: 1 / len(available) for name in available}, "equal_fallback_no_verified_history"


def blend(sources: list[dict], weights: dict) -> dict:
    out = {}
    for key in ("rainfall_mm", "temperature_c", "wind_speed_kmh"):
        valid = [(s[key], weights.get(s["model"], 0)) for s in sources if s["status"] == "available" and s.get(key) is not None]
        denom = sum(w for _, w in valid)
        out[key] = sum(v * w for v, w in valid) / denom if denom else None
    # Circular mean prevents the 359°/1° wraparound error.
    dirs = [(math.radians(s["wind_direction_deg"]), weights.get(s["model"], 0)) for s in sources if s["status"] == "available" and s.get("wind_direction_deg") is not None]
    x = sum(math.cos(a) * w for a, w in dirs); y = sum(math.sin(a) * w for a, w in dirs)
    out["wind_direction_deg"] = (math.degrees(math.atan2(y, x)) % 360) if dirs else None
    return out


def risk(value: float | None, metric: str) -> str:
    if value is None: return "unknown"
    bands = RISK_THRESHOLDS[metric]
    if value > bands["red_min_exclusive"]: return "red"
    if value > bands["orange_min_exclusive"]: return "orange"
    if value >= bands["yellow_min"]: return "yellow"
    return "green"


def make_risks(values: dict, location: Location):
    cases = [("heavy_rainfall", "rainfall_mm", values.get("rainfall_mm"), "mm / 24 h"),
             ("high_wind", "wind_speed_kmh", values.get("wind_speed_kmh"), "km/h"),
             ("heatwave_guidance", "temperature_c", values.get("temperature_c"), "°C")]
    labels = {"green": "No Alert / Normal Conditions", "yellow": "Yellow Alert (Be Aware / Moderate Risk)", "orange": "Orange Alert (Be Prepared / High Risk)", "red": "Red Alert (Take Action / Extreme Risk)", "unknown": "No data available"}
    return [{"type": kind, "level": risk(v, metric), "message": labels[risk(v, metric)], "value": v, "unit": unit, "location": location.name, "prototype_guidance": True} for kind, metric, v, unit in cases]


async def forecast(location: Location, hours: int, comparison_weights: dict[str, float] | None = None):
    weight_key = tuple(sorted((comparison_weights or {}).items()))
    key = (location.id, hours, weight_key); cached = FORECAST_CACHE.get(key)
    if cached and cached[0] > time.monotonic(): return cached[1]
    async with httpx.AsyncClient() as client:
        sources = await asyncio.gather(*(fetch_model(client, name, location, hours) for name in MODELS))
    weights, method = weights_for(sources, comparison_weights); values = blend(sources, weights)
    result = {"location": location, "lead_hours": hours, "fetched_at": datetime.now(timezone.utc).isoformat(), "sources": sources,
            "weights": weights, "weight_method": method, "verification_reference": "none_configured", "blended": values,
            "risks": make_risks(values, location), "partial": any(s["status"] != "available" for s in sources),
            "explanation": "Using the current Model Comparison weights. Forecast values are still retrieved from live providers." if comparison_weights else
            "Equal weights are a transparent fallback because this MVP has no stored verification history. No live provider value is replaced with a synthetic forecast."}
    if database.configured:
        try:
            await database.save_forecast(result)
        except DatabaseError as exc:
            logger.exception("Could not persist forecast results to Supabase")
            raise HTTPException(503, "Forecast data was retrieved, but saving it to Supabase failed. Check the backend log and database setup.") from exc
    FORECAST_CACHE[key] = (time.monotonic() + (120 if result["partial"] else 600), result)
    return result


@app.post("/api/forecast", response_model=ForecastResponse)
async def forecast_endpoint(request: ForecastRequest):
    location = LOCATION_MAP.get(request.location_id)
    if not location: raise HTTPException(404, "Unknown location_id")
    if request.weights is not None:
        if set(request.weights) - set(MODELS):
            raise HTTPException(422, "Weights contain an unknown forecast model")
        total_weight = sum(request.weights.values())
        if any(not math.isfinite(weight) or weight < 0 for weight in request.weights.values()) or not math.isfinite(total_weight) or total_weight <= 0:
            raise HTTPException(422, "Weights must be finite, non-negative, and include a positive value")
    return await forecast(location, request.lead_hours, request.weights)


@app.post("/api/map/state/{state_id}")
async def state_forecasts(state_id: str, lead_hours: int = Query(24, ge=24, le=72, multiple_of=24)):
    state = LOCATION_MAP.get(state_id)
    if not state or state.level != "state": raise HTTPException(404, "Unknown state_id")
    selected = [x for x in SELECTABLE_LOCATIONS if x.parent_id == state_id]
    if not selected: return {"state": state, "districts": [], "partial": True, "message": "No listed city matches an existing district boundary for this state."}
    semaphore = asyncio.Semaphore(4)
    async def bounded(location):
        async with semaphore: return await forecast(location, lead_hours)
    results = await asyncio.gather(*(bounded(x) for x in selected))
    return {"state": state, "districts": results, "partial": any(x["partial"] for x in results), "requested_districts": len(selected)}


@app.get("/api/forecast/models")
async def models():
    return [{"name": k, "provider": "Open-Meteo", "model_id": v[1] or "ECMWF endpoint default (IFS HRES 9 km)"} for k, v in MODELS.items()]


@app.get("/api/risk/thresholds")
async def risk_thresholds():
    """Return the same prototype thresholds used by forecast risk classification."""
    return RISK_THRESHOLDS


@app.get("/api/model-comparison")
async def comparison(location_id: str | None = None):
    metrics = []
    if database.configured:
        try:
            metrics = await database.model_comparison(location_id)
        except DatabaseError as exc:
            logger.exception("Could not read model comparison data from Supabase")
            raise HTTPException(503, "Could not read model comparison data from Supabase") from exc
    message = (
        f"Loaded {len(metrics)} stored or calculated verification metric rows."
        if metrics
        else "No aligned stored forecasts and reference observations are available yet. Add real station or reanalysis observations to calculate verification metrics."
    )
    return {"location_id": location_id, "verification_reference": "stored_station_or_reanalysis", "metrics": metrics, "message": message}


@app.get("/api/historical")
async def historical(location_id: str | None = None, variable: Literal["rainfall_mm", "temperature_c", "wind_speed_kmh"] = "rainfall_mm"):
    series = []
    if location_id and database.configured:
        try:
            series = await database.reference_series(location_id, variable)
        except DatabaseError as exc:
            logger.exception("Could not read historical reference data from Supabase")
            raise HTTPException(503, "Could not read historical data from Supabase") from exc
    message = (
        f"Loaded {len(series)} reference observations from Supabase."
        if series
        else "No station or reanalysis reference observations are stored for this selection yet."
        if location_id
        else "Select a district to view its stored station or reanalysis reference series."
    )
    return {"location_id": location_id, "variable": variable, "reference_type": "station_or_reanalysis", "series": series, "message": message}


@app.get("/api/extreme-weather")
async def extreme_weather(location_id: str, lead_hours: int = Query(24, ge=24, le=72)):
    location = LOCATION_MAP.get(location_id)
    if not location: raise HTTPException(404, "Unknown location_id")
    result = await forecast(location, lead_hours)
    return {"location": location, "risks": result["risks"], "sources": result["sources"], "agreement": "not_calculated_without_complete_source_data" if result["partial"] else "all_configured_sources_available", "thresholds": RISK_THRESHOLDS, "prototype_note": "Guidance only; not an official IMD warning."}


@app.get("/api/map/boundaries/{level}")
async def boundaries(level: Literal["states", "districts"], state_id: str | None = None):
    geo = read_geo("ADM1" if level == "states" else "ADM2")
    if level == "states":
        allowed = {x.id.split(":", 1)[1] for x in LOCATIONS if x.level == "state" and x.id in CSV_STATE_IDS}
        geo = {**geo, "features": [f for f in geo["features"] if f.get("properties", {}).get("gbid") in allowed]}
    if level == "districts":
        allowed = {x.id.split(":", 1)[1] for x in SELECTABLE_LOCATIONS if not state_id or x.parent_id == state_id}
        geo = {**geo, "features": [f for f in geo["features"] if f.get("properties", {}).get("gbid") in allowed]}
    return geo
