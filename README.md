# Mausam Mitra

Mausam Mitra is an India-first MVP for comparing public weather model forecasts, blending available values transparently, and displaying prototype weather risk guidance. It supports NCEP GFS, ECMWF IFS, ECMWF AIFS, and GFS Ensemble Mean through Open-Meteo APIs, with rainfall, 2 m temperature, wind speed and direction at 24, 48, and 72 hour leads.

The app deliberately distinguishes live provider results from verification history. It does not generate synthetic forecast values. The current scaffold has no persisted forecast/reference pairs, so it labels its equal-weight fallback and does not present made-up verification metrics.

## Architecture and data flow

`React + TypeScript + Leaflet` calls the `FastAPI` service. The API queries four Open-Meteo model endpoints concurrently, normalizes units/fields, reports failures by source, computes weights/blends, and evaluates configurable prototype risk bands. The backend connects directly to Supabase Postgres using the server-only `DATABASE_URL`. It syncs the location catalog and persists successful forecast points, model weights, and risk events. The browser never receives database credentials.

## Repository

- `frontend/` Vite, React, TypeScript, React Router, React-Leaflet, Recharts
- `backend/app/` FastAPI provider orchestration, normalization, blending, locations, risk, API
- `backend/migrations/` optional PostgreSQL schema
- `data/geojson/` supplied India ADM1 and ADM2 boundaries and source metadata

## Run locally

Requires Python 3.11+ and Node.js 20+.

```powershell
python -m venv backend/.venv
backend/.venv/Scripts/Activate.ps1
pip install -r backend/requirements.txt
uvicorn app.main:app --app-dir backend --reload --port 8000
```

In another terminal:

```powershell
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. FastAPI docs are at `http://localhost:8000/docs`. Set `DATABASE_URL` in the root `.env` file; the backend loads it automatically. If its `db.<project-ref>.supabase.co` host is unreachable on your network, set `SUPABASE_POOLER_HOST` to the Supavisor session-pooler host from the Supabase Connect dialog; the backend then uses the IPv4 session pooler. Keep database credentials server-side and out of `VITE_*` variables. Set `CORS_ORIGINS` and `VITE_API_URL` using `.env.example` as a guide. If Supabase is unavailable, health reports it and the API can still serve bundled locations and live forecasts; persistence-backed pages report database errors instead of inventing data.

## API

- `GET /api/health`
- `GET /api/locations/regions`, `/states`, `/districts?state_id=...`
- `POST /api/forecast` with `{ "location_id": "district:...", "lead_hours": 24 }`
- `GET /api/forecast/models`
- `GET /api/map/boundaries/states|districts`
- `POST /api/map/state/{state_id}?lead_hours=24` (bounded concurrency; one selected state only)
- `GET /api/model-comparison`
- `GET /api/historical`
- `GET /api/extreme-weather?location_id=...&lead_hours=24`

All forecast measurements use mm, °C, km/h, degrees clockwise from north, and UTC valid dates. Provider retrieval time is recorded separately. Direction blending uses a circular mean. Any unavailable source returns null values and an error status; it is excluded from the blend.

## Forecast sources and limitations

The provider adapter uses Open-Meteo public forecast APIs for GFS, ECMWF IFS/AIFS, and GFS ensemble mean. Public access can be rate-limited, delayed, unavailable, or restricted by the provider's terms and service tier. The browser reports per-source availability. Confirm current [Open-Meteo API documentation](https://open-meteo.com/en/docs), [usage terms/pricing](https://open-meteo.com/en/pricing), model availability, attribution, and commercial restrictions before public or operational use. The supplied Open-Meteo Python example is retained as integration guidance; the MVP uses HTTP adapters in the backend.

Equal weights apply only across successful sources and are labelled `equal_fallback_no_verified_history`; they are not adaptive skill weights. Model comparison calculates MAE, RMSE, correlation, and bias only when persisted forecasts align with reference observations. Historical analysis reads station or reanalysis observations from Supabase. No reference observations are currently ingested by this MVP, so those pages remain empty until real reference data is added. Reanalysis is not station truth.

## Blending and risk guidance

Numeric fields are weighted over available values and renormalized if a source lacks a specific measurement. Wind directions use a vector/circular mean to handle the 0°/360° boundary. Risk decisions run on the backend. Prototype thresholds are guidance rather than official IMD warnings: rainfall below 64.5 mm is green, 64.5–115.5 yellow, above 115.5–204.4 orange, and above 204.4 red; wind bands use 40/60/80 km/h; heat guidance uses 37/40/43 °C. Threshold configuration lives in `backend/app/config.py` and should be aligned to approved policy before operational use.

## Map data and licensing

The app uses the supplied `IND_ADM1.geojson` and `IND_ADM2.geojson`. Their adjacent metadata identifies the ADM1 source as OpenStreetMap / Wambacher boundaries under ODbL (2017 vintage), and ADM2 as Datameet Group of India (2011 vintage), described only as “Creative Commons 2.0.” That ADM2 label is not a sufficiently precise license designation; verify the original Datameet terms/attribution before redistribution or public deployment. Boundary files are old and may contain outdated administrative divisions. Forecast data is joined at runtime using the supplied `gbid` feature key; district-to-state association is derived spatially because the ADM2 metadata lacks a dependable parent field. OSM basemap attribution is displayed on the map. Follow the [OpenStreetMap tile usage policy](https://operations.osmfoundation.org/policies/tiles/) and do not treat the public raster endpoint as unlimited production infrastructure.

## Persistence and future setup

The Supabase project schema stores locations, forecast runs/points, reference observations, metrics, weights, and risk events. The backend seeds locations from the bundled GeoJSON on startup and persists live forecast results through a direct Postgres connection. `GET /api/health` reports the connection state. Do not expose `DATABASE_URL` in Vite variables. Historical reference ingestion remains a separate data-source task; the app will not synthesize observations.

## Known limitations

- Provider model IDs/endpoints can vary with Open-Meteo's current API; source errors remain visible and should be checked against current provider documentation.
- District/state polygon sets are large; the client requests ADM2 only after selecting one state, but the current API boundary response contains the whole ADM2 GeoJSON before client filtering.
- The current map centers on India and does not yet zoom to state/district bounds. National overview never requests national district forecasts.
- Adaptive skill weighting and historical reference ingestion are not yet implemented; comparison metrics require real, time-aligned reference observations.
- Validate geography associations, provider terms, and risk thresholds before any operational use.

## Validation

Frontend production build: `cd frontend; npm run build`. Backend imports/run: `uvicorn app.main:app --app-dir backend --reload`. Unit tests are included under backend/tests. Run them with `python -m unittest discover -s backend/tests`.
