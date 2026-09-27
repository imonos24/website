"""Central prototype risk threshold configuration; ranges are lower-bound inclusive."""
RISK_THRESHOLDS = {
    "rainfall_mm": {"yellow_min": 64.5, "orange_min_exclusive": 115.5, "red_min_exclusive": 204.4},
    "wind_speed_kmh": {"yellow_min": 40.0, "orange_min_exclusive": 60.0, "red_min_exclusive": 80.0},
    "temperature_c": {"yellow_min": 37.0, "orange_min_exclusive": 40.0, "red_min_exclusive": 43.0},
}
