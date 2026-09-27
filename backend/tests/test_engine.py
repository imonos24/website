import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.main import blend, make_risks, weights_for, Location


class BlendTests(unittest.TestCase):
    def test_weights_normalize_available_sources(self):
        weights, method = weights_for([
            {"model": "A", "status": "available"},
            {"model": "B", "status": "unavailable"},
            {"model": "C", "status": "available"},
        ])
        self.assertEqual(method, "equal_fallback_no_verified_history")
        self.assertAlmostEqual(sum(weights.values()), 1.0)
        self.assertNotIn("B", weights)

    def test_wind_direction_uses_circular_mean(self):
        sources = [
            {"model": "A", "status": "available", "wind_direction_deg": 359, "rainfall_mm": None, "temperature_c": None, "wind_speed_kmh": None},
            {"model": "B", "status": "available", "wind_direction_deg": 1, "rainfall_mm": None, "temperature_c": None, "wind_speed_kmh": None},
        ]
        direction = blend(sources, {"A": .5, "B": .5})["wind_direction_deg"]
        self.assertTrue(direction < 0.01 or direction > 359.99)


class RiskTests(unittest.TestCase):
    def test_rainfall_cutoffs_have_no_gaps(self):
        location = Location(id="state:x", name="Test", level="state")
        expected = [(64.49, "green"), (64.5, "yellow"), (115.5, "yellow"), (115.51, "orange"), (204.4, "orange"), (204.41, "red")]
        for value, level in expected:
            with self.subTest(value=value):
                self.assertEqual(make_risks({"rainfall_mm": value}, location)[0]["level"], level)

    def test_wind_and_heat_boundaries(self):
        location = Location(id="state:x", name="Test", level="state")
        cases = [("wind_speed_kmh", 39.99, "green", 1), ("wind_speed_kmh", 40, "yellow", 1),
                 ("wind_speed_kmh", 60, "yellow", 1), ("wind_speed_kmh", 60.01, "orange", 1),
                 ("wind_speed_kmh", 80, "orange", 1), ("wind_speed_kmh", 80.01, "red", 1),
                 ("temperature_c", 36.99, "green", 2), ("temperature_c", 37, "yellow", 2),
                 ("temperature_c", 40, "yellow", 2), ("temperature_c", 40.01, "orange", 2),
                 ("temperature_c", 43, "orange", 2), ("temperature_c", 43.01, "red", 2)]
        for variable, value, level, index in cases:
            with self.subTest(variable=variable, value=value):
                self.assertEqual(make_risks({variable: value}, location)[index]["level"], level)


if __name__ == "__main__":
    unittest.main()
