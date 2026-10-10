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
        self.assertEqual(method, "equal_fallback_no_matching_comparison_weights")
        self.assertAlmostEqual(sum(weights.values()), 1.0)
        self.assertEqual(weights["B"], 0.0)

    def test_comparison_weights_are_adjusted_for_unavailable_sources(self):
        comparison_weights = {"A": 0.194478, "B": 0.224242, "C": 0.356236, "D": 0.225044}
        weights, method = weights_for(
            [{"model": "A", "status": "available"}, {"model": "B", "status": "unavailable"}],
            comparison_weights,
        )
        self.assertEqual(method, "model_comparison_weights_adjusted_available_sources")
        self.assertEqual(weights["A"], 1.0)
        self.assertEqual(weights["B"], 0.0)
        self.assertAlmostEqual(sum(weights.values()), 1.0)
        values = blend([
            {"model": "A", "status": "available", "rainfall_mm": 10, "temperature_c": None, "wind_speed_kmh": None},
            {"model": "B", "status": "available", "rainfall_mm": 20, "temperature_c": None, "wind_speed_kmh": None},
        ], {"A": 0.2, "B": 0.8})
        self.assertEqual(values["rainfall_mm"], 18)

    def test_comparison_weights_are_unchanged_when_all_sources_are_available(self):
        comparison_weights = {"A": 0.20525, "B": 0.225463, "C": 0.388764, "D": 0.180523}
        sources = [{"model": name, "status": "available"} for name in comparison_weights]
        weights, method = weights_for(sources, comparison_weights)
        self.assertEqual(method, "model_comparison_weights")
        for name, weight in comparison_weights.items():
            self.assertEqual(weights[name], weight)

    def test_bishnupur_rainfall_comparison_weight_and_unavailable_adjustment(self):
        comparison_weights = {
            "NCEP GFS": 0.20525,
            "ECMWF IFS HRES": 0.225463,
            "ECMWF AIFS": 0.388764,
            "GFS Ensemble Mean": 0.180523,
        }
        available_sources = [{"model": model, "status": "available"} for model in comparison_weights]
        used, method = weights_for(available_sources, comparison_weights)
        self.assertEqual(method, "model_comparison_weights")
        self.assertAlmostEqual(used["NCEP GFS"] * 100, 20.525)
        all_source_values = [
            {"model": "NCEP GFS", "status": "available", "rainfall_mm": 10},
            {"model": "ECMWF IFS HRES", "status": "available", "rainfall_mm": 20},
            {"model": "ECMWF AIFS", "status": "available", "rainfall_mm": 30},
            {"model": "GFS Ensemble Mean", "status": "available", "rainfall_mm": 40},
        ]
        self.assertAlmostEqual(blend(all_source_values, used)["rainfall_mm"], 25.4456)

        partial_sources = [
            {"model": "NCEP GFS", "status": "available", "rainfall_mm": 10},
            {"model": "ECMWF IFS HRES", "status": "available", "rainfall_mm": 20},
            {"model": "ECMWF AIFS", "status": "unavailable", "rainfall_mm": None},
            {"model": "GFS Ensemble Mean", "status": "available", "rainfall_mm": 40},
        ]
        adjusted, method = weights_for(partial_sources, comparison_weights)
        self.assertEqual(method, "model_comparison_weights_adjusted_available_sources")
        self.assertEqual(adjusted["ECMWF AIFS"], 0.0)
        self.assertAlmostEqual(adjusted["NCEP GFS"] * 100, 33.581, places=2)
        adjusted_value = blend(partial_sources, adjusted)["rainfall_mm"]
        expected_value = sum(partial_sources[index]["rainfall_mm"] * adjusted[partial_sources[index]["model"]]
                             for index in (0, 1, 3))
        self.assertAlmostEqual(adjusted_value, expected_value)

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
