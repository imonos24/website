import { useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Database } from 'lucide-react';
import {
  COMPARISON_WEIGHT_STORAGE_KEY,
  comparisonWeightSnapshotForSelection,
  comparisonWeightsForSelection,
  datesForPeriod,
  displayModel,
  displayNumber,
  loadMockWeatherData,
  MODELS,
  periodLabel,
  type LocationOption,
  type MetricRow,
  type MockWeatherData,
  type Period,
  type VariableKey,
  variableInfo,
  VARIABLES,
} from './mock-weather-data';

const LEAD_HOURS = [24, 48, 72] as const;
const BLENDED_COLOR = '#d39a19';
const REFERENCE_COLOR = '#293846';
type MetricValue = Omit<MetricRow, 'start_date' | 'end_date' | 'mae' | 'rmse' | 'correlation' | 'bias'> & {
  mae: number | null;
  rmse: number | null;
  correlation: number | null;
  bias: number | null;
};
type SeriesPoint = Record<string, string | number | null> & { date: string };
type WeightPoint = Record<string, string | number> & { date: string };

function useMockData() {
  const [data, setData] = useState<MockWeatherData | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    loadMockWeatherData()
      .then((loaded) => { if (active) setData(loaded); })
      .catch((reason: Error) => { if (active) setError(reason.message); });
    return () => { active = false; };
  }, []);
  return { data, error };
}

function useInitialLocation(data: MockWeatherData | null): [string, (value: string) => void] {
  const [locationId, setLocationId] = useState('');
  useEffect(() => {
    if (!data || locationId) return;
    const defaultLocation = data.locations.find((location) => location.city.toLowerCase() === 'mumbai')
      ?? data.locations[0];
    if (defaultLocation) setLocationId(defaultLocation.id);
  }, [data, locationId]);
  return [locationId, setLocationId];
}

function dateLabel(date: string): string {
  return new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short', timeZone: 'UTC' })
    .format(new Date(`${date}T00:00:00Z`));
}

function locationLabel(locations: LocationOption[], id: string): string {
  return locations.find((location) => location.id === id)?.label ?? '—';
}

function locationControls(data: MockWeatherData, value: string, onChange: (value: string) => void) {
  return <label>Location<select aria-label="Location" value={value} onChange={(event) => onChange(event.target.value)}>
    {data.locations.map((location) => <option key={location.id} value={location.id}>{location.label}</option>)}
  </select></label>;
}

function variableControls(value: VariableKey, onChange: (value: VariableKey) => void) {
  return <label>Variable<select aria-label="Variable" value={value} onChange={(event) => onChange(event.target.value as VariableKey)}>
    {VARIABLES.map((variable) => <option key={variable.key} value={variable.key}>{variable.label}</option>)}
  </select></label>;
}

function periodControls(data: MockWeatherData, value: Period, onChange: (value: Period) => void) {
  return <label>Period<select aria-label="Period" value={value} onChange={(event) => onChange(event.target.value as Period)}>
    <option value="last30">Last 30 days</option>
    {data.months.map((month) => <option key={month} value={`month:${month}`}>{periodLabel(data, `month:${month}`)}</option>)}
  </select></label>;
}

function leadControls(value: number, onChange: (value: number) => void) {
  return <label>Lead time<select aria-label="Lead time" value={value} onChange={(event) => onChange(Number(event.target.value))}>
    {LEAD_HOURS.map((hours) => <option key={hours} value={hours}>{hours}h</option>)}
  </select></label>;
}

function pearson(actual: number[], forecast: number[]): number | null {
  if (actual.length < 2 || actual.length !== forecast.length) return null;
  const meanActual = actual.reduce((sum, value) => sum + value, 0) / actual.length;
  const meanForecast = forecast.reduce((sum, value) => sum + value, 0) / forecast.length;
  let covariance = 0;
  let varianceActual = 0;
  let varianceForecast = 0;
  for (let index = 0; index < actual.length; index += 1) {
    const a = actual[index] - meanActual;
    const f = forecast[index] - meanForecast;
    covariance += a * f;
    varianceActual += a * a;
    varianceForecast += f * f;
  }
  const denominator = Math.sqrt(varianceActual * varianceForecast);
  return denominator > 0 ? covariance / denominator : null;
}

function metricsForSelection(
  data: MockWeatherData,
  locationId: string,
  variable: VariableKey,
  lead: number,
  period: Period,
  dates: string[],
): MetricValue[] {
  if (period === 'last30') {
    return data.metrics.filter((row) => row.location_id === locationId && row.variable === variable && row.lead_hours === lead);
  }

  const dateSet = new Set(dates);
  const actuals = new Map(data.actuals
    .filter((row) => row.location_id === locationId && dateSet.has(row.valid_date))
    .map((row) => [row.valid_date, row[variable]]));
  const forecasts = data.forecasts.filter((row) => row.location_id === locationId && row.lead_hours === lead && dateSet.has(row.valid_date));

  return MODELS.map((model) => {
    const paired = forecasts.filter((row) => row.model === model.id && row[variable] != null && actuals.get(row.valid_date) != null);
    const actual = paired.map((row) => actuals.get(row.valid_date)!);
    const forecast = paired.map((row) => row[variable]!);
    const errors = forecast.map((value, index) => value - actual[index]);
    const mae = errors.length ? errors.reduce((sum, value) => sum + Math.abs(value), 0) / errors.length : null;
    const rmse = errors.length ? Math.sqrt(errors.reduce((sum, value) => sum + value * value, 0) / errors.length) : null;
    const bias = errors.length ? errors.reduce((sum, value) => sum + value, 0) / errors.length : null;
    return {
      location_id: locationId,
      model: model.id,
      variable,
      lead_hours: lead,
      sample_count: errors.length,
      mae,
      rmse,
      correlation: errors.length ? pearson(actual, forecast) : null,
      bias,
    };
  });
}

function seriesForSelection(
  data: MockWeatherData,
  locationId: string,
  variable: VariableKey,
  lead: number,
  dates: string[],
): SeriesPoint[] {
  const dateSet = new Set(dates);
  const actuals = new Map(data.actuals
    .filter((row) => row.location_id === locationId && dateSet.has(row.valid_date))
    .map((row) => [row.valid_date, row[variable]]));
  const forecasts = data.forecasts.filter((row) => row.location_id === locationId && row.lead_hours === lead && dateSet.has(row.valid_date));
  const forecastByDate = new Map<string, Map<string, number | null>>();
  for (const row of forecasts) {
    const modelValues = forecastByDate.get(row.valid_date) ?? new Map<string, number | null>();
    modelValues.set(row.model, row[variable]);
    forecastByDate.set(row.valid_date, modelValues);
  }

  const historicalWeights = data.weightHistory.filter((row) => row.location_id === locationId
    && row.variable === variable && row.lead_hours === lead && dateSet.has(row.evaluation_date));
  const latestWeights = data.currentWeights.filter((row) => row.location_id === locationId
    && row.variable === variable && row.lead_hours === lead);
  const weightByDate = new Map<string, Map<string, number>>();
  for (const row of historicalWeights) {
    const modelWeights = weightByDate.get(row.evaluation_date) ?? new Map<string, number>();
    modelWeights.set(row.model, row.weight);
    weightByDate.set(row.evaluation_date, modelWeights);
  }
  const currentWeightByModel = new Map(latestWeights.map((row) => [row.model, row.weight]));

  return dates.flatMap((date) => {
    const values = forecastByDate.get(date);
    if (!values && actuals.get(date) == null) return [];
    const dailyWeights = weightByDate.get(date);
    const selectedWeights = dailyWeights && MODELS.every((model) => dailyWeights.has(model.id)) ? dailyWeights : currentWeightByModel;
    const hasAllValues = MODELS.every((model) => values?.get(model.id) != null && selectedWeights.has(model.id));
    const totalWeight = hasAllValues
      ? MODELS.reduce((sum, model) => sum + (selectedWeights.get(model.id) ?? 0), 0)
      : 0;
    const blended = hasAllValues && totalWeight > 0
      ? MODELS.reduce((sum, model) => sum + (values!.get(model.id)! * (selectedWeights.get(model.id) ?? 0)) / totalWeight, 0)
      : null;
    const point: SeriesPoint = {
      date,
      reference: actuals.get(date) ?? null,
      blended,
    };
    for (const model of MODELS) point[model.id] = values?.get(model.id) ?? null;
    return [point];
  });
}

function weightSeriesForSelection(
  data: MockWeatherData,
  locationId: string,
  variable: VariableKey,
  lead: number,
  dates: string[],
): WeightPoint[] {
  const selected = data.weightHistory.filter((row) => row.location_id === locationId
    && row.variable === variable && row.lead_hours === lead && dates.includes(row.evaluation_date));
  const byDate = new Map<string, Map<string, number>>();
  for (const row of selected) {
    const values = byDate.get(row.evaluation_date) ?? new Map<string, number>();
    values.set(row.model, row.weight);
    byDate.set(row.evaluation_date, values);
  }
  return [...byDate.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([date, weights]) => {
    const sum = MODELS.reduce((total, model) => total + (weights.get(model.id) ?? 0), 0);
    const point: WeightPoint = { date };
    for (const model of MODELS) {
      const key = `weight_${model.id}`;
      point[key] = sum > 0 ? ((weights.get(model.id) ?? 0) / sum) * 100 : 0;
    }
    return point;
  });
}

function noDataMessage(data: MockWeatherData, locationId: string, dates: string[], lead: number): boolean {
  const selectedDates = new Set(dates);
  return !data.actuals.some((row) => row.location_id === locationId && selectedDates.has(row.valid_date))
    && !data.forecasts.some((row) => row.location_id === locationId && row.lead_hours === lead && selectedDates.has(row.valid_date));
}

function ChartTooltip({ unit }: { unit: string }) {
  return <Tooltip
    labelFormatter={(value) => dateLabel(String(value))}
    formatter={(value, name) => [value == null ? '—' : `${Number(value).toFixed(2)} ${unit}`, String(name)]}
  />;
}

function DateAxis() {
  return <XAxis dataKey="date" tickFormatter={dateLabel} minTickGap={24} tick={{ fontSize: 10, fill: '#8b99a2' }} />;
}

function EmptyState({ title, message }: { title: string; message: string }) {
  return <div className="mock-empty"><Database size={22} /><b>{title}</b><span>{message}</span></div>;
}

function LoadingState({ error }: { error: string }) {
  return error
    ? <div className="alert error">Could not load the synthetic datasets: {error}</div>
    : <div className="chartblank"><Database /><b>Loading the 30-day synthetic datasets…</b><span>The CSV files are parsed once and reused for both analysis pages.</span></div>;
}

function FilterBar({
  data,
  locationId,
  setLocationId,
  variable,
  setVariable,
  period,
  setPeriod,
  lead,
  setLead,
}: {
  data: MockWeatherData;
  locationId: string;
  setLocationId: (value: string) => void;
  variable: VariableKey;
  setVariable: (value: VariableKey) => void;
  period: Period;
  setPeriod: (value: Period) => void;
  lead: number;
  setLead: (value: number) => void;
}) {
  return <div className="controls mock-controls">
    {locationControls(data, locationId, setLocationId)}
    {variableControls(variable, setVariable)}
    {periodControls(data, period, setPeriod)}
    {leadControls(lead, setLead)}
  </div>;
}

function metricForModel(metrics: MetricValue[], model: string): MetricValue | undefined {
  return metrics.find((metric) => metric.model === model);
}

function metricCards(metrics: MetricValue[]) {
  const best = metrics.filter((metric) => metric.mae != null)
    .reduce<MetricValue | undefined>((winner, metric) => !winner || metric.mae! < winner.mae! ? metric : winner, undefined);
  return <div className="mock-kpis">
    {MODELS.map((model) => {
      const metric = metricForModel(metrics, model.id);
      return <article className="card mock-model-card" key={model.id} style={{ '--model-color': model.color } as React.CSSProperties}>
        <div className="mock-model-heading"><i /><b>{model.label}</b>{best?.model === model.id && <span className="best-mae">Best MAE</span>}</div>
        <div className="mock-card-values">
          <div><span>MAE</span><b>{displayNumber(metric?.mae)} <small>{variableInfo(metric?.variable ?? 'rainfall_mm').unit}</small></b></div>
          <div><span>RMSE</span><b>{displayNumber(metric?.rmse)} <small>{variableInfo(metric?.variable ?? 'rainfall_mm').unit}</small></b></div>
          <div><span>Corr</span><b>{displayNumber(metric?.correlation)}</b></div>
          <div><span>Bias</span><b>{displayNumber(metric?.bias)} <small>{variableInfo(metric?.variable ?? 'rainfall_mm').unit}</small></b></div>
        </div>
      </article>;
    })}
  </div>;
}

function MetricCharts({
  rows,
  metrics,
  variable,
}: {
  rows: SeriesPoint[];
  metrics: MetricValue[];
  variable: VariableKey;
}) {
  const info = variableInfo(variable);
  return <div className="mock-chart-grid">
    <section className="card mock-chart-card">
      <div className="mock-chart-title"><h2>Forecast error over time — {info.label.toLowerCase()}</h2><p>Historical model values and synthetic reference</p></div>
      {rows.length ? <ResponsiveContainer width="100%" height={300}>
        <LineChart data={rows} margin={{ top: 8, right: 16, bottom: 4, left: 2 }}>
          <CartesianGrid stroke="#e9eef2" strokeDasharray="3 4" vertical />
          <DateAxis />
          <YAxis unit={` ${info.unit}`} width={68} tick={{ fontSize: 10, fill: '#8b99a2' }} />
          <ChartTooltip unit={info.unit} />
          <Legend verticalAlign="bottom" wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
          <Line type="monotone" dataKey="reference" name="Synthetic Reference" stroke={REFERENCE_COLOR} strokeDasharray="5 4" strokeWidth={2} dot={false} connectNulls={false} isAnimationActive={false} />
          {MODELS.map((model) => <Line key={model.id} type="monotone" dataKey={model.id} name={model.label} stroke={model.color} strokeWidth={1.8} dot={false} connectNulls={false} isAnimationActive={false} />)}
          <Line type="monotone" dataKey="blended" name="Blended" stroke={BLENDED_COLOR} strokeWidth={2.8} dot={{ r: 2, fill: BLENDED_COLOR }} connectNulls={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer> : <EmptyState title="No historical data available for this selection." message="Try another location, variable, period, or lead time." />}
    </section>
    <section className="card mock-chart-card">
      <div className="mock-chart-title"><h2>MAE and RMSE by model</h2><p>Verification errors · {info.unit}</p></div>
      {metrics.some((metric) => metric.mae != null || metric.rmse != null) ? <ResponsiveContainer width="100%" height={300}>
        <BarChart data={MODELS.map((model) => ({
          model: model.label,
          MAE: metricForModel(metrics, model.id)?.mae ?? null,
          RMSE: metricForModel(metrics, model.id)?.rmse ?? null,
        }))} margin={{ top: 10, right: 12, bottom: 24, left: 0 }}>
          <CartesianGrid stroke="#e9eef2" strokeDasharray="3 4" vertical={false} />
          <XAxis dataKey="model" interval={0} angle={-12} textAnchor="end" height={52} tick={{ fontSize: 9, fill: '#8b99a2' }} />
          <YAxis unit={` ${info.unit}`} width={66} tick={{ fontSize: 10, fill: '#8b99a2' }} />
          <Tooltip formatter={(value, name) => [value == null ? '—' : `${Number(value).toFixed(2)} ${info.unit}`, String(name)]} />
          <Legend verticalAlign="bottom" wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="MAE" fill="#2876e3" radius={[3, 3, 0, 0]} maxBarSize={24} />
          <Bar dataKey="RMSE" fill="#9ec0f5" radius={[3, 3, 0, 0]} maxBarSize={24} />
        </BarChart>
      </ResponsiveContainer> : <EmptyState title="No verification metrics for this selection." message="There are no matching model metric records in the supplied data." />}
    </section>
  </div>;
}

function VerificationTable({
  data,
  locationId,
  variable,
  lead,
  period,
  metrics,
  dates,
}: {
  data: MockWeatherData;
  locationId: string;
  variable: VariableKey;
  lead: number;
  period: Period;
  metrics: MetricValue[];
  dates: string[];
}) {
  const info = variableInfo(variable);
  const weights = comparisonWeightsForSelection(data, locationId, variable, lead, dates, period);
  const title = `Verification metrics — ${info.label.toLowerCase()} · ${locationLabel(data.locations, locationId)} · ${periodLabel(data, period)} · ${lead}h`;
  return <section className="card mock-table-card">
    <div className="mock-chart-title"><h2>{title}</h2><p>Metrics use the supplied rolling 30-day file; shorter month views are calculated from date-matched CSV values.</p></div>
    <div className="tablewrap"><table className="mock-table">
      <thead><tr><th>Model</th><th>MAE ↓</th><th>RMSE ↓</th><th>Correlation ↑</th><th>Bias</th><th>Samples</th><th>Weight</th></tr></thead>
      <tbody>{MODELS.map((model) => {
        const metric = metricForModel(metrics, model.id);
        const weight = weights.get(model.id);
        return <tr key={model.id}>
          <td><span className="mock-table-model" style={{ '--model-color': model.color } as React.CSSProperties}><i />{model.label}</span></td>
          <td>{displayNumber(metric?.mae)}</td><td>{displayNumber(metric?.rmse)}</td><td>{displayNumber(metric?.correlation)}</td><td>{displayNumber(metric?.bias)}</td>
          <td>{metric?.sample_count ?? '—'}</td><td>{weight == null ? '—' : `${(weight * 100).toFixed(1)}%`}</td>
        </tr>;
      })}</tbody>
    </table></div>
    <p className="mock-footnote">MAE and RMSE in {info.unit}. Bias = forecast minus synthetic reference. These are synthetic demonstration values.</p>
  </section>;
}

export function DatabaseComparison() {
  const { data, error } = useMockData();
  const [locationId, setLocationId] = useInitialLocation(data);
  const [variable, setVariable] = useState<VariableKey>('rainfall_mm');
  const [period, setPeriod] = useState<Period>('last30');
  const [lead, setLead] = useState(24);

  const dates = useMemo(() => data ? datesForPeriod(data, period) : [], [data, period]);
  const series = useMemo(() => data && locationId
    ? seriesForSelection(data, locationId, variable, lead, dates) : [], [data, locationId, variable, lead, dates]);
  const metrics = useMemo(() => data && locationId
    ? metricsForSelection(data, locationId, variable, lead, period, dates) : [], [data, locationId, variable, lead, period, dates]);
  const weightSnapshot = useMemo(() => data && locationId
    ? comparisonWeightSnapshotForSelection(data, locationId, variable, lead, dates, period) : null,
  [data, locationId, variable, lead, dates, period]);

  useEffect(() => {
    if (!data || !locationId) return;
    if (weightSnapshot) localStorage.setItem(COMPARISON_WEIGHT_STORAGE_KEY, JSON.stringify(weightSnapshot));
    else localStorage.removeItem(COMPARISON_WEIGHT_STORAGE_KEY);
  }, [data, locationId, weightSnapshot]);

  if (!data) return <LoadingState error={error} />;
  if (noDataMessage(data, locationId, dates, lead)) {
    return <><FilterBar {...{ data, locationId, setLocationId, variable, setVariable, period, setPeriod, lead, setLead }} />
      <EmptyState title="No historical data available for this selection." message="Try another location, variable, period, or lead time." />
    </>;
  }

  return <>
    <FilterBar {...{ data, locationId, setLocationId, variable, setVariable, period, setPeriod, lead, setLead }} />
    <div className="mock-selection-note"><span>{locationLabel(data.locations, locationId)}</span><i />{variableInfo(variable).label}<i />{periodLabel(data, period)}<i />{lead}h</div>
    {metricCards(metrics)}
    <MetricCharts rows={series} metrics={metrics} variable={variable} />
    <VerificationTable {...{ data, locationId, variable, lead, period, metrics, dates }} />
    <p className="mock-reference-note">Synthetic Reference · supplied mock data for demonstration only; not ERA5, IMD, or station observations.</p>
  </>;
}

function HistoricalCharts({ rows, variable }: { rows: SeriesPoint[]; variable: VariableKey }) {
  const info = variableInfo(variable);
  return rows.length ? <ResponsiveContainer width="100%" height={360}>
      <LineChart data={rows} margin={{ top: 10, right: 24, bottom: 5, left: 4 }}>
        <CartesianGrid stroke="#e9eef2" strokeDasharray="3 4" vertical />
        <DateAxis />
        <YAxis unit={` ${info.unit}`} width={70} tick={{ fontSize: 10, fill: '#8b99a2' }} />
        <ChartTooltip unit={info.unit} />
        <Legend verticalAlign="bottom" wrapperStyle={{ fontSize: 11, paddingTop: 12 }} />
        <Line type="monotone" dataKey="reference" name="Synthetic Reference" stroke={REFERENCE_COLOR} strokeDasharray="5 4" strokeWidth={2} dot={false} connectNulls={false} isAnimationActive={false} />
        {MODELS.map((model) => <Line key={model.id} type="monotone" dataKey={model.id} name={model.label} stroke={model.color} strokeWidth={1.8} dot={false} connectNulls={false} isAnimationActive={false} />)}
        <Line type="monotone" dataKey="blended" name="Blended" stroke={BLENDED_COLOR} strokeWidth={3} dot={{ r: 2.5, fill: BLENDED_COLOR }} connectNulls={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer> : <EmptyState title="No historical data available for this selection." message="Try another location, variable, period, or lead time." />;
}

function SkillSummary({ metrics, variable, period, locationId, data }: {
  metrics: MetricValue[];
  variable: VariableKey;
  period: Period;
  locationId: string;
  data: MockWeatherData;
}) {
  return <section className="card mock-chart-card mock-lower-card">
    <div className="mock-chart-title"><h2>Skill summary — {periodLabel(data, period)}</h2><p>{locationLabel(data.locations, locationId)} · {variableInfo(variable).label}</p></div>
    <div className="tablewrap"><table className="mock-table mock-skill-table">
      <thead><tr><th>Model</th><th>MAE</th><th>RMSE</th><th>Corr</th></tr></thead>
      <tbody>{MODELS.map((model) => {
        const metric = metricForModel(metrics, model.id);
        return <tr key={model.id}>
          <td><span className="mock-table-model" style={{ '--model-color': model.color } as React.CSSProperties}><i />{model.label}</span></td>
          <td>{displayNumber(metric?.mae)}</td><td>{displayNumber(metric?.rmse)}</td><td>{displayNumber(metric?.correlation)}</td>
        </tr>;
      })}</tbody>
    </table></div>
  </section>;
}

function WeightEvolution({ rows }: { rows: WeightPoint[] }) {
  return <section className="card mock-chart-card mock-lower-card">
    <div className="mock-chart-title"><h2>Model weight evolution</h2><p>How weights shift as skill is re-evaluated over time.</p></div>
    {rows.length ? <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={rows} margin={{ top: 8, right: 10, bottom: 5, left: 0 }}>
        <CartesianGrid stroke="#e9eef2" strokeDasharray="3 4" vertical />
        <DateAxis />
        <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickFormatter={(value) => `${value}%`} width={48} tick={{ fontSize: 10, fill: '#8b99a2' }} />
        <Tooltip labelFormatter={(value) => dateLabel(String(value))} formatter={(value, name) => [`${Number(value).toFixed(1)}%`, String(name)]} />
        <Legend verticalAlign="bottom" wrapperStyle={{ fontSize: 10, paddingTop: 10 }} />
        {MODELS.map((model) => <Area key={model.id} type="monotone" dataKey={`weight_${model.id}`} name={model.label} stackId="weights" stroke={model.color} fill={model.color} fillOpacity={0.82} isAnimationActive={false} />)}
      </AreaChart>
    </ResponsiveContainer> : <EmptyState title="No weight history for this selection." message="No historical weights match the selected location, variable, lead, and period." />}
  </section>;
}

export function DatabaseHistory() {
  const { data, error } = useMockData();
  const [locationId, setLocationId] = useInitialLocation(data);
  const [variable, setVariable] = useState<VariableKey>('rainfall_mm');
  const [period, setPeriod] = useState<Period>('last30');
  const [lead, setLead] = useState(24);

  useEffect(() => {
    if (data?.months.length && period === 'last30') setPeriod(`month:${data.months[data.months.length - 1]}`);
  }, [data]);

  const dates = useMemo(() => data ? datesForPeriod(data, period) : [], [data, period]);
  const series = useMemo(() => data && locationId
    ? seriesForSelection(data, locationId, variable, lead, dates) : [], [data, locationId, variable, lead, dates]);
  const metrics = useMemo(() => data && locationId
    ? metricsForSelection(data, locationId, variable, lead, period, dates) : [], [data, locationId, variable, lead, period, dates]);
  const weights = useMemo(() => data && locationId
    ? weightSeriesForSelection(data, locationId, variable, lead, dates) : [], [data, locationId, variable, lead, dates]);

  if (!data) return <LoadingState error={error} />;
  const locationName = locationLabel(data.locations, locationId);
  const info = variableInfo(variable);
  return <>
    <FilterBar {...{ data, locationId, setLocationId, variable, setVariable, period, setPeriod, lead, setLead }} />
    <div className="mock-selection-note"><span>{locationName}</span><i />{info.label} ({info.unit})<i />{periodLabel(data, period)}<i />{lead}h</div>
    <section className="card mock-history-main mock-chart-card">
      <div className="mock-chart-title">
        <h2>Forecast vs reference — {locationName} · {info.label} · {periodLabel(data, period)}</h2>
        <p>Dashed line shows synthetic reference. Solid lines are model forecasts. Blended shown in amber.</p>
      </div>
      {noDataMessage(data, locationId, dates, lead)
        ? <EmptyState title="No historical data available for this selection." message="Try another location, variable, period, or lead time." />
        : <HistoricalCharts rows={series} variable={variable} />}
    </section>
    <div className="mock-lower-grid">
      <SkillSummary {...{ metrics, variable, period, locationId, data }} />
      <WeightEvolution rows={weights} />
    </div>
    <p className="mock-reference-note">Rolling 30-day metrics use mock_model_metrics_30d.csv. Month-only summaries are calculated from date-matched synthetic forecasts and reference values.</p>
    <div className="note">Synthetic Reference · all supplied data is mock demonstration data, not ERA5, IMD, or station observations.</div>
  </>;
}
