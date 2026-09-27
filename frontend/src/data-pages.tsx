import { useEffect, useMemo, useState } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Database, History } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

type Metric = {
  location_id?: string | null;
  model: string;
  variable: string;
  lead_hours?: number | null;
  reference_type?: string | null;
  sample_count?: number | null;
  mae?: number | null;
  rmse?: number | null;
  correlation?: number | null;
  bias?: number | null;
};

type ComparisonResponse = { metrics: Metric[]; message: string };
type Location = { id: string; name: string; level: 'state' | 'district'; parent_id?: string | null };
type HistoricalPoint = { valid_time: string; value: number | null; source_type: string };
type HistoricalResponse = { series: HistoricalPoint[]; message: string; variable: string };

async function get<T>(path: string): Promise<T> {
  const response = await fetch(`${API}${path}`);
  if (!response.ok) throw new Error(`API ${response.status}: ${await response.text()}`);
  return response.json();
}

function average(rows: Metric[], field: keyof Metric): number | null {
  const values = rows.map((row) => row[field]).filter((value): value is number => typeof value === 'number');
  return values.length ? values.reduce((total, value) => total + value, 0) / values.length : null;
}

function metricText(value: number | null | undefined, suffix = ''): string {
  return value == null ? '—' : `${value.toFixed(2)}${suffix}`;
}

export function DatabaseComparison() {
  const [info, setInfo] = useState<ComparisonResponse | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    get<ComparisonResponse>('/model-comparison')
      .then(setInfo)
      .catch((reason: Error) => setError(reason.message));
  }, []);

  const rows = info?.metrics || [];
  const summaries = [
    ['MAE', average(rows, 'mae'), 'Across stored model/variable samples'],
    ['RMSE', average(rows, 'rmse'), 'Across stored model/variable samples'],
    ['Correlation', average(rows, 'correlation'), 'Across stored model/variable samples'],
    ['Bias', average(rows, 'bias'), 'Forecast minus reference'],
  ] as const;

  return <>
    <div className="kpis">
      {summaries.map(([label, value, detail]) => <div className="card kp" key={label}>
        <span>{label}</span><b>{metricText(value)}</b><small>{value === null ? 'No verified sample' : detail}</small>
      </div>)}
    </div>
    <div className="card section">
      <div className="secthead"><div><h2>Verification metrics by source</h2><p>Calculated from time-aligned stored forecasts and reference observations</p></div></div>
      {error ? <div className="alert error">{error}</div> : <p>{info?.message || 'Loading stored verification data…'}</p>}
      {rows.length ? <div className="tablewrap"><table>
        <thead><tr><th>Model</th><th>Location</th><th>Variable</th><th>Lead</th><th>Reference</th><th>Samples</th><th>MAE</th><th>RMSE</th><th>Correlation</th><th>Bias</th></tr></thead>
        <tbody>{rows.map((row, index) => <tr key={`${row.model}-${row.location_id}-${row.variable}-${row.lead_hours}-${row.reference_type}-${index}`}>
          <td><b>{row.model}</b></td><td>{row.location_id || 'All locations'}</td><td>{row.variable}</td><td>{row.lead_hours ?? '—'} h</td><td>{row.reference_type || 'Stored metric'}</td><td>{row.sample_count ?? '—'}</td>
          <td>{metricText(row.mae)}</td><td>{metricText(row.rmse)}</td><td>{metricText(row.correlation)}</td><td>{metricText(row.bias)}</td>
        </tr>)}</tbody>
      </table></div> : <div className="emptyline"><Database /> Verification metrics appear when forecast points align with real station or reanalysis observations.</div>}
    </div>
  </>;
}

const variables = [
  { key: 'rainfall_mm', label: 'Rainfall', unit: 'mm' },
  { key: 'temperature_c', label: 'Temperature', unit: '°C' },
  { key: 'wind_speed_kmh', label: 'Wind speed', unit: 'km/h' },
] as const;

export function DatabaseHistory() {
  const [states, setStates] = useState<Location[]>([]);
  const [districts, setDistricts] = useState<Location[]>([]);
  const [stateId, setStateId] = useState('');
  const [districtId, setDistrictId] = useState('');
  const [variable, setVariable] = useState<(typeof variables)[number]['key']>('rainfall_mm');
  const [info, setInfo] = useState<HistoricalResponse | null>(null);
  const [error, setError] = useState('');
  const [locationsError, setLocationsError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    Promise.all([get<Location[]>('/locations/states'), get<Location[]>('/locations/districts')])
      .then(([stateRows, districtRows]) => { setStates(stateRows); setDistricts(districtRows); })
      .catch((reason: Error) => setLocationsError(reason.message));
  }, []);

  const stateDistricts = useMemo(() => districts.filter((district) => district.parent_id === stateId), [districts, stateId]);
  const selectedVariable = variables.find((item) => item.key === variable)!;

  useEffect(() => {
    if (!districtId) { setInfo(null); setError(''); return; }
    let active = true;
    setLoading(true);
    setError('');
    const query = new URLSearchParams({ location_id: districtId, variable });
    get<HistoricalResponse>(`/historical?${query.toString()}`)
      .then((data) => { if (active) setInfo(data); })
      .catch((reason: Error) => { if (active) setError(reason.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [districtId, variable]);

  return <>
    <div className="controls">
      <label>State<select value={stateId} onChange={(event) => { setStateId(event.target.value); setDistrictId(''); }}>
        <option value="">Select state</option>{states.map((state) => <option key={state.id} value={state.id}>{state.name}</option>)}
      </select></label>
      <label>District / city<select value={districtId} disabled={!stateId} onChange={(event) => setDistrictId(event.target.value)}>
        <option value="">{stateId ? 'Select district' : 'Select a state first'}</option>{stateDistricts.map((district) => <option key={district.id} value={district.id}>{district.name}</option>)}
      </select></label>
      <label>Variable<select value={variable} onChange={(event) => setVariable(event.target.value as typeof variable)}>
        {variables.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
      </select></label>
    </div>
    {locationsError && <div className="alert error">Could not load locations: {locationsError}</div>}
    <div className="card section">
      <div className="secthead"><div><h2>Historical analysis</h2><p>Stored reference observations for the selected location</p></div><span className="badge gray">STATION / REANALYSIS</span></div>
      {error ? <div className="alert error">{error}</div> : loading ? <div className="chartblank"><History /><b>Loading reference observations…</b></div> : info?.series.length ? <div className="history-chart">
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={info.series.filter((point) => point.value !== null)} margin={{ top: 8, right: 20, bottom: 8, left: 4 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="valid_time" tickFormatter={(value: string) => new Date(value).toLocaleDateString()} minTickGap={28} />
            <YAxis unit={` ${selectedVariable.unit}`} width={78} />
            <Tooltip labelFormatter={(value) => new Date(String(value)).toLocaleString()} formatter={(value) => [`${Number(value).toFixed(1)} ${selectedVariable.unit}`, selectedVariable.label]} />
            <Legend />
            <Line type="monotone" dataKey="value" name={selectedVariable.label} stroke="#168b9b" strokeWidth={2} dot={false} connectNulls />
          </LineChart>
        </ResponsiveContainer>
        <p className="context">{info.series.length} observations · source types: {[...new Set(info.series.map((point) => point.source_type))].join(', ')}</p>
      </div> : <div className="chartblank"><History /><b>{districtId ? 'No historical series available' : 'Select a district to view stored history'}</b><span>{info?.message || 'Reference measurements are read from Supabase; no values are generated.'}</span></div>}
      <div className="note">Reanalysis and station observations are reported as separate reference types. Reanalysis is not station truth.</div>
    </div>
  </>;
}
