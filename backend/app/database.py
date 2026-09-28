"""Server-side connection to the Supabase Postgres database."""
from __future__ import annotations

import math
import os
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import quote, unquote, urlsplit, urlunsplit

import asyncpg
from dotenv import load_dotenv


ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env")


class DatabaseError(RuntimeError):
    pass


class SupabaseDatabase:
    """Database operations are kept on the FastAPI server, never in the browser."""

    def __init__(self) -> None:
        self.dsn = os.getenv("DATABASE_URL", "").strip()
        self.pooler_host = os.getenv("SUPABASE_POOLER_HOST", "").strip()
        self.configured = bool(self.dsn)
        self.pool: asyncpg.Pool | None = None

    async def open(self) -> None:
        if not self.configured or self.pool:
            return
        try:
            self.pool = await asyncpg.create_pool(
                dsn=self._runtime_dsn(),
                min_size=1,
                max_size=6,
                timeout=8,
                command_timeout=20,
                ssl="require",
            )
        except Exception as exc:
            raise DatabaseError("Could not connect to the Supabase Postgres database") from exc

    def _runtime_dsn(self) -> str:
        """Route direct IPv6 DSNs through the configured IPv4 session pooler."""
        parts = urlsplit(self.dsn)
        if not self.pooler_host or not (parts.hostname or "").startswith("db."):
            return self.dsn
        project_ref = parts.hostname.split(".", 2)[1]
        userinfo = parts.netloc.rsplit("@", 1)[0]
        username_raw, separator, password_raw = userinfo.partition(":")
        username = unquote(username_raw)
        if "." not in username:
            username = f"{username}.{project_ref}"
        netloc = f"{quote(username, safe='.')}{separator}{password_raw}@{self.pooler_host}:5432"
        return urlunsplit((parts.scheme, netloc, parts.path, parts.query, parts.fragment))

    async def close(self) -> None:
        if self.pool:
            await self.pool.close()
            self.pool = None

    async def _pool(self) -> asyncpg.Pool:
        if not self.configured:
            raise DatabaseError("Supabase is not configured")
        if self.pool is None:
            await self.open()
        if self.pool is None:
            raise DatabaseError("Could not connect to the Supabase Postgres database")
        return self.pool

    async def ping(self) -> None:
        pool = await self._pool()
        try:
            async with pool.acquire() as connection:
                await connection.fetchval("select 1")
        except Exception as exc:
            raise DatabaseError("Supabase Postgres health check failed") from exc

    async def sync_locations(self, locations: list[Any]) -> int:
        rows = [
            (loc.id, loc.name, loc.level, loc.parent_id, loc.latitude, loc.longitude)
            for loc in locations
        ]
        pool = await self._pool()
        statement = """
            insert into public.locations (id, name, level, parent_id, lat, lon)
            values ($1, $2, $3, $4, $5, $6)
            on conflict (id) do update set
              name = excluded.name,
              level = excluded.level,
              parent_id = excluded.parent_id,
              lat = excluded.lat,
              lon = excluded.lon
        """
        try:
            async with pool.acquire() as connection:
                async with connection.transaction():
                    for offset in range(0, len(rows), 500):
                        await connection.executemany(statement, rows[offset : offset + 500])
        except Exception as exc:
            raise DatabaseError("Could not sync location records to Supabase") from exc
        return len(rows)

    async def get_locations(
        self, level: str | None = None, parent_id: str | None = None
    ) -> list[dict[str, Any]]:
        conditions, values = [], []
        if level:
            values.append(level)
            conditions.append(f"level = ${len(values)}")
        if parent_id:
            values.append(parent_id)
            conditions.append(f"parent_id = ${len(values)}")
        where = f"where {' and '.join(conditions)}" if conditions else ""
        query = f"select id, name, level, parent_id, lat, lon from public.locations {where} order by name"
        pool = await self._pool()
        try:
            async with pool.acquire() as connection:
                records = await connection.fetch(query, *values)
            return [dict(row) for row in records]
        except Exception as exc:
            raise DatabaseError("Could not read locations from Supabase") from exc

    async def save_forecast(self, result: dict[str, Any]) -> None:
        usable = [
            source
            for source in result["sources"]
            if source["status"] == "available"
            and source.get("valid_time")
            and any(
                source.get(key) is not None
                for key in ("rainfall_mm", "temperature_c", "wind_speed_kmh", "wind_direction_deg")
            )
        ]
        if not usable:
            return

        pool = await self._pool()
        location = result["location"]
        location_id = location.id if hasattr(location, "id") else location["id"]
        lead_hours = result["lead_hours"]
        fetched_at = self._parse_time(result["fetched_at"])
        metric_columns = {
            "rainfall_mm": "rainfall_mm",
            "temperature_c": "temperature_c",
            "wind_speed_kmh": "wind_speed_kmh",
            "wind_direction_deg": "wind_direction_deg",
        }
        try:
            async with pool.acquire() as connection:
                async with connection.transaction():
                    run_ids: dict[str, Any] = {}
                    for source in usable:
                        run_time = self._parse_time(source.get("source_run_time") or fetched_at)
                        run_ids[source["model"]] = await connection.fetchval(
                            """
                            insert into public.forecast_runs (model, run_time, fetched_at, source)
                            values ($1, $2, $3, $4) returning id
                            """,
                            source["model"],
                            run_time,
                            fetched_at,
                            "Open-Meteo",
                        )
                    point_rows = [
                        (
                            run_ids[source["model"]],
                            location_id,
                            self._parse_time(source["valid_time"]),
                            lead_hours,
                            source.get("rainfall_mm"),
                            source.get("temperature_c"),
                            source.get("wind_speed_kmh"),
                            source.get("wind_direction_deg"),
                        )
                        for source in usable
                    ]
                    await connection.executemany(
                        """
                        insert into public.forecast_points
                          (run_id, location_id, valid_time, lead_hours, rainfall_mm, temp_c, wind_speed_kmh, wind_dir_deg)
                        values ($1, $2, $3, $4, $5, $6, $7, $8)
                        """,
                        point_rows,
                    )

                    weight_rows = []
                    for variable, source_key in metric_columns.items():
                        sources_with_value = [s for s in usable if s.get(source_key) is not None]
                        total_weight = sum(result["weights"].get(s["model"], 0.0) for s in sources_with_value)
                        for source in sources_with_value:
                            weight = result["weights"].get(source["model"], 0.0)
                            if total_weight:
                                weight_rows.append(
                                    (
                                        location_id,
                                        variable,
                                        lead_hours,
                                        source["model"],
                                        weight / total_weight,
                                        result["weight_method"],
                                    )
                                )
                    if weight_rows:
                        await connection.executemany(
                            """
                            insert into public.model_weights
                              (location_id, variable, lead_time, model, weight, method)
                            values ($1, $2, $3, $4, $5, $6)
                            """,
                            weight_rows,
                        )

                    valid_time = self._parse_time(usable[0]["valid_time"])
                    risk_rows = [
                        (
                            location_id,
                            valid_time,
                            risk["type"],
                            risk["level"],
                            risk.get("value"),
                            "prototype_guidance",
                        )
                        for risk in result["risks"]
                    ]
                    await connection.executemany(
                        """
                        insert into public.risk_events
                          (location_id, valid_time, risk_type, level, score, source)
                        values ($1, $2, $3, $4, $5, $6)
                        """,
                        risk_rows,
                    )
        except Exception as exc:
            raise DatabaseError("Could not persist forecast results to Supabase") from exc

    async def reference_series(self, location_id: str, variable: str) -> list[dict[str, Any]]:
        column = {
            "rainfall_mm": "rainfall_mm",
            "temperature_c": "temp_c",
            "wind_speed_kmh": "wind_speed_kmh",
        }[variable]
        pool = await self._pool()
        try:
            async with pool.acquire() as connection:
                rows = await connection.fetch(
                    f"""
                    select location_id, valid_time, {column} as value, source_type
                    from public.observations_or_reference
                    where location_id = $1
                    order by valid_time
                    limit 5000
                    """,
                    location_id,
                )
            return [
                {
                    "location_id": row["location_id"],
                    "valid_time": row["valid_time"].isoformat(),
                    "value": row["value"],
                    "source_type": row["source_type"] or "reanalysis",
                }
                for row in rows
            ]
        except Exception as exc:
            raise DatabaseError("Could not read historical references from Supabase") from exc

    async def model_comparison(self, location_id: str | None = None) -> list[dict[str, Any]]:
        pool = await self._pool()
        try:
            async with pool.acquire() as connection:
                stored_sql = """
                    select location_id, model, variable, lead_time, mae, rmse, corr, bias, updated_at
                    from public.model_metrics
                """
                stored_args: tuple[Any, ...] = ()
                if location_id:
                    stored_sql += " where location_id = $1"
                    stored_args = (location_id,)
                stored_sql += " order by updated_at desc limit 1000"
                stored = await connection.fetch(stored_sql, *stored_args)

                runs = await connection.fetch(
                    "select id, model from public.forecast_runs order by fetched_at desc limit 1000"
                )
                run_models = {row["id"]: row["model"] for row in runs}
                if not run_models:
                    return [self._metric_row(row) for row in stored]
                run_ids = list(run_models)
                if location_id:
                    points = await connection.fetch(
                        """
                        select run_id, location_id, valid_time, lead_hours, rainfall_mm, temp_c, wind_speed_kmh
                        from public.forecast_points where run_id = any($1::uuid[]) and location_id = $2
                        limit 5000
                        """,
                        run_ids,
                        location_id,
                    )
                    references = await connection.fetch(
                        """
                        select location_id, valid_time, rainfall_mm, temp_c, wind_speed_kmh, source_type
                        from public.observations_or_reference where location_id = $1
                        order by valid_time desc limit 5000
                        """,
                        location_id,
                    )
                else:
                    points = await connection.fetch(
                        """
                        select run_id, location_id, valid_time, lead_hours, rainfall_mm, temp_c, wind_speed_kmh
                        from public.forecast_points where run_id = any($1::uuid[]) limit 5000
                        """,
                        run_ids,
                    )
                    references = await connection.fetch(
                        """
                        select location_id, valid_time, rainfall_mm, temp_c, wind_speed_kmh, source_type
                        from public.observations_or_reference order by valid_time desc limit 5000
                        """
                    )

            reference_map: dict[tuple[str, str], list[dict[str, Any]]] = defaultdict(list)
            for ref in references:
                reference_map[(ref["location_id"], self._time_key(ref["valid_time"]))].append(dict(ref))
            columns = {
                "rainfall_mm": ("rainfall_mm", "rainfall_mm"),
                "temperature_c": ("temp_c", "temp_c"),
                "wind_speed_kmh": ("wind_speed_kmh", "wind_speed_kmh"),
            }
            pairs: dict[tuple[str, str, int, str, str], list[tuple[float, float]]] = defaultdict(list)
            for point in points:
                model = run_models.get(point["run_id"])
                if not model:
                    continue
                ref_rows = reference_map.get((point["location_id"], self._time_key(point["valid_time"])), [])
                for reference in ref_rows:
                    ref_type = reference.get("source_type") or "reanalysis"
                    for variable, (forecast_column, reference_column) in columns.items():
                        forecast_value, reference_value = point[forecast_column], reference[reference_column]
                        if isinstance(forecast_value, (int, float)) and isinstance(reference_value, (int, float)):
                            pairs[(model, variable, point["lead_hours"], point["location_id"], ref_type)].append(
                                (float(forecast_value), float(reference_value))
                            )

            calculated = []
            for (model, variable, lead, loc_id, ref_type), values in pairs.items():
                errors = [forecast - reference for forecast, reference in values]
                calculated.append(
                    {
                        "location_id": loc_id,
                        "model": model,
                        "variable": variable,
                        "lead_hours": lead,
                        "reference_type": ref_type,
                        "sample_count": len(values),
                        "mae": sum(abs(error) for error in errors) / len(errors),
                        "rmse": math.sqrt(sum(error * error for error in errors) / len(errors)),
                        "correlation": self._correlation([p[0] for p in values], [p[1] for p in values]),
                        "bias": sum(errors) / len(errors),
                    }
                )
            return calculated or [self._metric_row(row) for row in stored]
        except Exception as exc:
            raise DatabaseError("Could not calculate model comparisons from Supabase") from exc

    @staticmethod
    def _parse_time(value: Any) -> datetime:
        if isinstance(value, datetime):
            parsed = value
        else:
            parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        return parsed.replace(tzinfo=timezone.utc) if parsed.tzinfo is None else parsed

    @classmethod
    def _time_key(cls, value: Any) -> str:
        return cls._parse_time(value).astimezone(timezone.utc).isoformat()

    @staticmethod
    def _correlation(a: list[float], b: list[float]) -> float | None:
        if len(a) < 2:
            return None
        mean_a, mean_b = sum(a) / len(a), sum(b) / len(b)
        var_a = sum((value - mean_a) ** 2 for value in a)
        var_b = sum((value - mean_b) ** 2 for value in b)
        if var_a == 0 or var_b == 0:
            return None
        covariance = sum((x - mean_a) * (y - mean_b) for x, y in zip(a, b))
        return covariance / math.sqrt(var_a * var_b)

    @staticmethod
    def _metric_row(row: Any) -> dict[str, Any]:
        return {
            "location_id": row["location_id"],
            "model": row["model"],
            "variable": row["variable"],
            "lead_hours": row["lead_time"],
            "reference_type": None,
            "sample_count": None,
            "mae": row["mae"],
            "rmse": row["rmse"],
            "correlation": row["corr"],
            "bias": row["bias"],
        }


database = SupabaseDatabase()
