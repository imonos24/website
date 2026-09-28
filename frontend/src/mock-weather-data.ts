export const MODELS = [
  { id: 'NCEP GFS', label: 'NCEP GFS', color: '#e77b45' },
  { id: 'IFS', label: 'ECMWF IFS HRES', color: '#2774df' },
  { id: 'AIFS', label: 'ECMWF AIFS', color: '#8c61df' },
  { id: 'GFS ENSEMBLE', label: 'GFS Ensemble', color: '#209b8b' },
] as const;

export const VARIABLES = [
  { key: 'rainfall_mm', label: 'Rainfall', unit: 'mm' },
  { key: 'temperature_c', label: 'Temperature', unit: '°C' },
  { key: 'wind_speed_kmh', label: 'Wind Speed', unit: 'km/h' },
] as const;

export type VariableKey = (typeof VARIABLES)[number]['key'];
export type ModelId = (typeof MODELS)[number]['id'];
export type Period = 'last30' | `month:${string}`;

export type LocationOption = {
  id: string;
  state: string;
  city: string;
  label: string;
};

export type ForecastRow = {
  location_id: string;
  state: string;
  city: string;
  model: ModelId;
  lead_hours: number;
  issue_date: string;
  valid_date: string;
  rainfall_mm: number | null;
  temperature_c: number | null;
  wind_speed_kmh: number | null;
};

export type ActualRow = {
  location_id: string;
  state: string;
  city: string;
  valid_date: string;
  rainfall_mm: number | null;
  temperature_c: number | null;
  wind_speed_kmh: number | null;
};

export type MetricRow = {
  location_id: string;
  model: ModelId;
  variable: VariableKey;
  lead_hours: number;
  start_date: string;
  end_date: string;
  sample_count: number;
  mae: number;
  rmse: number;
  correlation: number | null;
  bias: number;
};

export type WeightRow = {
  location_id: string;
  variable: VariableKey;
  lead_hours: number;
  model: ModelId;
  weight: number;
  evaluation_date: string;
};

export type MockWeatherData = {
  locations: LocationOption[];
  dates: string[];
  months: string[];
  actuals: ActualRow[];
  forecasts: ForecastRow[];
  metrics: MetricRow[];
  currentWeights: WeightRow[];
  weightHistory: WeightRow[];
};

export type ComparisonWeightSnapshot = {
  weights: Record<string, number>;
  context: string;
};

export const COMPARISON_WEIGHT_STORAGE_KEY = 'mausam-mitra-comparison-weight-snapshot';

const FORECAST_MODEL_NAMES: Record<ModelId, string> = {
  'NCEP GFS': 'NCEP GFS',
  IFS: 'ECMWF IFS HRES',
  AIFS: 'ECMWF AIFS',
  'GFS ENSEMBLE': 'GFS Ensemble Mean',
};

type CsvRow = Record<string, string>;

function parseCsv(text: string): CsvRow[] {
  const records: string[][] = [];
  let record: string[] = [];
  let cell = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        cell += character;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === ',') {
      record.push(cell);
      cell = '';
    } else if (character === '\n') {
      record.push(cell.replace(/\r$/, ''));
      records.push(record);
      record = [];
      cell = '';
    } else {
      cell += character;
    }
  }
  if (cell.length || record.length) {
    record.push(cell.replace(/\r$/, ''));
    records.push(record);
  }

  const [header = [], ...rows] = records;
  return rows.filter((row) => row.some((value) => value !== '')).map((row) =>
    Object.fromEntries(header.map((key, index) => [key.trim(), row[index]?.trim() ?? ''])),
  );
}

function numberOrNull(value: string | undefined): number | null {
  if (value == null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function numberOrZero(value: string | undefined): number {
  return numberOrNull(value) ?? 0;
}

function normalizeModel(value: string): ModelId | null {
  const normalized = value.trim().toUpperCase();
  if (normalized === 'NCEP GFS') return 'NCEP GFS';
  if (normalized === 'IFS' || normalized === 'ECMWF IFS HRES') return 'IFS';
  if (normalized === 'AIFS' || normalized === 'ECMWF AIFS') return 'AIFS';
  if (normalized === 'GFS ENSEMBLE' || normalized === 'GFS ENSEMBLE MEAN') return 'GFS ENSEMBLE';
  return null;
}

function isVariable(value: string): value is VariableKey {
  return VARIABLES.some((variable) => variable.key === value);
}

function modelRows<T>(rows: CsvRow[], mapper: (row: CsvRow, model: ModelId) => T | null): T[] {
  const result: T[] = [];
  for (const row of rows) {
    const model = normalizeModel(row.model ?? '');
    if (model) {
      const mapped = mapper(row, model);
      if (mapped) result.push(mapped);
    }
  }
  return result;
}

async function readCsv(fileName: string): Promise<CsvRow[]> {
  const response = await fetch(`${import.meta.env.BASE_URL}data/${fileName}`);
  if (!response.ok) throw new Error(`Could not load ${fileName} (${response.status})`);
  return parseCsv(await response.text());
}

let cachedData: Promise<MockWeatherData> | undefined;

export function loadMockWeatherData(): Promise<MockWeatherData> {
  if (!cachedData) {
    cachedData = Promise.all([
      readCsv('mock_actual_30d.csv'),
      readCsv('mock_forecasts_30d.csv'),
      readCsv('mock_model_metrics_30d.csv'),
      readCsv('mock_model_weights_30d.csv'),
      readCsv('mock_weight_history_30d.csv'),
    ]).then(([actualRows, forecastRows, metricRows, currentWeightRows, historyRows]) => {
      const actuals = actualRows.map((row): ActualRow => ({
        location_id: row.location_id,
        state: row.state,
        city: row.city,
        valid_date: row.valid_date,
        rainfall_mm: numberOrNull(row.rainfall_mm),
        temperature_c: numberOrNull(row.temperature_c),
        wind_speed_kmh: numberOrNull(row.wind_speed_kmh),
      }));
      const forecasts = modelRows(forecastRows, (row, model): ForecastRow | null => ({
        location_id: row.location_id,
        state: row.state,
        city: row.city,
        model,
        lead_hours: numberOrZero(row.lead_hours),
        issue_date: row.issue_date,
        valid_date: row.valid_date,
        rainfall_mm: numberOrNull(row.rainfall_mm),
        temperature_c: numberOrNull(row.temperature_c),
        wind_speed_kmh: numberOrNull(row.wind_speed_kmh),
      }));
      const metrics = modelRows(metricRows, (row, model): MetricRow | null => {
        if (!isVariable(row.variable)) return null;
        return {
          location_id: row.location_id,
          model,
          variable: row.variable,
          lead_hours: numberOrZero(row.lead_hours),
          start_date: row.start_date,
          end_date: row.end_date,
          sample_count: numberOrZero(row.sample_count),
          mae: numberOrZero(row.mae),
          rmse: numberOrZero(row.rmse),
          correlation: numberOrNull(row.correlation),
          bias: numberOrZero(row.bias),
        };
      });
      const mapWeights = (rows: CsvRow[], dateField: string): WeightRow[] => modelRows(rows, (row, model): WeightRow | null => {
        if (!isVariable(row.variable)) return null;
        return {
          location_id: row.location_id,
          variable: row.variable,
          lead_hours: numberOrZero(row.lead_hours),
          model,
          weight: numberOrZero(row.weight),
          evaluation_date: row[dateField],
        };
      });
      const statesByLocation = new Map<string, { state: string; city: string }>();
      for (const row of actuals) statesByLocation.set(row.location_id, { state: row.state, city: row.city });
      const locations = [...statesByLocation.entries()]
        .map(([id, value]) => ({ id, ...value, label: `${value.city}, ${value.state}` }))
        .sort((left, right) => left.label.localeCompare(right.label));
      const dates = [...new Set(actuals.map((row) => row.valid_date))].sort();
      const months = [...new Set(dates.map((date) => date.slice(0, 7)))].sort();

      return {
        locations,
        dates,
        months,
        actuals,
        forecasts,
        metrics,
        currentWeights: mapWeights(currentWeightRows, 'generated_for_date'),
        weightHistory: mapWeights(historyRows, 'evaluation_date'),
      };
    }).catch((error: unknown) => {
      cachedData = undefined;
      throw error;
    });
  }
  return cachedData;
}

export function datesForPeriod(data: MockWeatherData, period: Period): string[] {
  if (period === 'last30') return data.dates;
  const month = period.slice('month:'.length);
  return data.dates.filter((date) => date.startsWith(month));
}

export function periodLabel(data: MockWeatherData, period: Period): string {
  if (period === 'last30') return 'Last 30 days';
  const month = period.slice('month:'.length);
  const [year, monthNumber] = month.split('-').map(Number);
  return new Intl.DateTimeFormat('en', { month: 'short', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(Date.UTC(year, monthNumber - 1, 1)));
}

export function variableInfo(variable: VariableKey) {
  return VARIABLES.find((item) => item.key === variable) ?? VARIABLES[0];
}

export function displayModel(model: ModelId): string {
  return MODELS.find((item) => item.id === model)?.label ?? model;
}

export function displayNumber(value: number | null | undefined, digits = 2): string {
  return value == null || !Number.isFinite(value) ? '—' : value.toFixed(digits);
}

export function comparisonWeightsForSelection(
  data: MockWeatherData,
  locationId: string,
  variable: VariableKey,
  lead: number,
  dates: string[],
  period: Period,
): Map<ModelId, number> {
  if (period === 'last30') {
    return new Map(data.currentWeights
      .filter((row) => row.location_id === locationId && row.variable === variable && row.lead_hours === lead)
      .map((row) => [row.model, row.weight]));
  }

  const dateSet = new Set(dates);
  const rows = data.weightHistory.filter((row) => row.location_id === locationId && row.variable === variable
    && row.lead_hours === lead && dateSet.has(row.evaluation_date));
  const latestByModel = new Map<ModelId, { date: string; weight: number }>();
  for (const row of rows) {
    const previous = latestByModel.get(row.model);
    if (!previous || row.evaluation_date > previous.date) {
      latestByModel.set(row.model, { date: row.evaluation_date, weight: row.weight });
    }
  }
  return new Map([...latestByModel].map(([model, value]) => [model, value.weight]));
}

export function comparisonWeightSnapshotForSelection(
  data: MockWeatherData,
  locationId: string,
  variable: VariableKey,
  lead: number,
  dates: string[],
  period: Period,
): ComparisonWeightSnapshot | null {
  const weights = comparisonWeightsForSelection(data, locationId, variable, lead, dates, period);
  const forecastWeights = Object.fromEntries([...weights]
    .filter(([, weight]) => Number.isFinite(weight) && weight >= 0)
    .map(([model, weight]) => [FORECAST_MODEL_NAMES[model], weight]));
  if (!Object.keys(forecastWeights).length || Object.values(forecastWeights).every((weight) => weight === 0)) return null;

  const location = data.locations.find((item) => item.id === locationId);
  return {
    weights: forecastWeights,
    context: `${location?.label ?? locationId} · ${variableInfo(variable).label} · ${periodLabel(data, period)} · ${lead}h`,
  };
}

export function defaultComparisonWeightSnapshot(data: MockWeatherData): ComparisonWeightSnapshot | null {
  const location = data.locations.find((item) => item.city.toLowerCase() === 'mumbai') ?? data.locations[0];
  if (!location) return null;
  return comparisonWeightSnapshotForSelection(data, location.id, 'rainfall_mm', 24, data.dates, 'last30');
}
