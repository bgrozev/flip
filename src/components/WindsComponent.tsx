import {
  Add as AddIcon,
  Close as CloseIcon,
  Remove as RemoveIcon
} from '@mui/icons-material';
import {
  Box,
  Button,
  CircularProgress,
  Divider,
  IconButton,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography
} from '@mui/material';
import React, { useCallback } from 'react';

import { SOURCE_MANUAL } from '../forecast/forecast';
import { useUnits } from '../hooks';
import { ObservedWindStation } from '../types';
import { WindRow, Winds } from '../util/wind';

interface WindsComponentProps {
  winds: Winds;
  setWinds: (winds: Winds) => void;
  fetching: boolean;
  fetch: (ft?: Date | null) => void;
  forecastTime: Date | null;
  onForecastTimeChange: (t: Date | null) => void;
  stations?: ObservedWindStation[];
  stationsFetched?: boolean;
  fetchingObserved?: boolean;
}

/** Format a Date to the value string required by datetime-local inputs (YYYY-MM-DDTHH:mm) */
function toDateTimeLocalString(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

/** Round a Date up to the nearest hour */
function roundUpToHour(date: Date): Date {
  const result = new Date(date);
  if (result.getMinutes() > 0 || result.getSeconds() > 0 || result.getMilliseconds() > 0) {
    result.setHours(result.getHours() + 1, 0, 0, 0);
  } else {
    result.setMinutes(0, 0, 0);
  }
  return result;
}

export default function WindsComponent({
  winds,
  setWinds,
  fetching,
  fetch,
  forecastTime,
  onForecastTimeChange,
  stations = [],
  stationsFetched = false,
  fetchingObserved = false
}: WindsComponentProps) {
  const {
    formatAltitude,
    parseAltitude,
    altitudeLabel,
    formatWindSpeed,
    parseWindSpeed,
    windSpeedLabel,
    formatTemperature,
    formatPressure
  } = useUnits();

  const lock =
    winds.groundSource !== SOURCE_MANUAL || winds.aloftSource !== SOURCE_MANUAL;

  const reset = useCallback(() => {
    setWinds(Winds.createDefault());
  }, [setWinds]);

  // Forecast time picker
  const now = new Date();
  const minDate = roundUpToHour(now);
  const maxDate = new Date(now.getTime() + 7 * 24 * 3600 * 1000);
  const forecastInputValue = forecastTime
    ? toDateTimeLocalString(forecastTime)
    : toDateTimeLocalString(minDate);

  const adjustForecastHour = (delta: number) => {
    const base = forecastTime ?? minDate;
    const next = new Date(base.getTime() + delta * 3600 * 1000);
    let newTime: Date | null;
    if (next < minDate) {
      newTime = null;
    } else if (next > maxDate) {
      newTime = maxDate;
    } else {
      newTime = next;
    }
    onForecastTimeChange(newTime);
    fetch(newTime);
  };

  const addRow = () => {
    winds.addRow(new WindRow(0, 0, 0));
    setWinds(new Winds([...winds.winds]));
  };

  const removeRowAt = (index: number) => {
    const updated = winds.winds.filter((_, i) => i !== index);
    setWinds(new Winds(updated));
  };

  const updateRow = (index: number, field: 'altFt' | 'direction' | 'speedKts', value: number) => {
    const updated = winds.winds.map((row, i) => {
      if (i !== index) return row;
      return new WindRow(
        field === 'altFt' ? value : row.altFt,
        field === 'direction' ? value : row.direction,
        field === 'speedKts' ? value : row.speedKts
      );
    });
    setWinds(new Winds(updated));
  };

  const unlock = () => {
    const newWinds = new Winds([...winds.winds]);
    newWinds.groundSource = SOURCE_MANUAL;
    newWinds.aloftSource = SOURCE_MANUAL;
    setWinds(newWinds);
  };

  const invertWind = () => {
    const inverted = winds.winds.map(
      row => new WindRow(row.altFt, (row.direction + 180) % 360, row.speedKts)
    );
    setWinds(new Winds(inverted));
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', paddingLeft: 0 }}>
      <>
          {/* Forecast time picker */}
          <Box sx={{ mb: 1.5 }}>
            <Stack direction="row" alignItems="center" sx={{ mb: 0.5 }}>
              <Typography variant="caption" color="text.secondary">
                Forecast time
              </Typography>
              {forecastTime && (
                <Button
                  variant="text"
                  size="small"
                  onClick={() => { onForecastTimeChange(null); fetch(null); }}
                  sx={{ minWidth: 0, px: 0.5, py: 0, ml: 0.5, fontSize: '0.65rem', lineHeight: 1.2 }}
                >
                  now
                </Button>
              )}
            </Stack>
            <Stack direction="row" spacing={0.5} alignItems="center">
              <Tooltip title="One hour earlier">
                <IconButton size="small" onClick={() => adjustForecastHour(-1)}>
                  <RemoveIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              {/* Two separate inputs for cross-browser compatibility (Firefox datetime-local has no time picker) */}
              <Box
                sx={{ display: 'flex', gap: 0.5, flex: 1 }}
                onBlur={e => {
                  // Only fetch when focus leaves the whole date+time group
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                    const inputs = e.currentTarget.querySelectorAll('input');
                    const dateVal = (inputs[0] as HTMLInputElement)?.value;
                    const timeVal = (inputs[1] as HTMLInputElement)?.value;
                    fetch(dateVal && timeVal ? new Date(`${dateVal}T${timeVal}`) : null);
                  }
                }}
              >
                <TextField
                  type="date"
                  size="small"
                  value={forecastInputValue.split('T')[0]}
                  inputProps={{
                    min: toDateTimeLocalString(minDate).split('T')[0],
                    max: toDateTimeLocalString(maxDate).split('T')[0]
                  }}
                  onChange={e => {
                    const timeStr = forecastInputValue.split('T')[1] ?? '00:00';
                    onForecastTimeChange(e.target.value ? new Date(`${e.target.value}T${timeStr}`) : null);
                  }}
                  sx={{ flex: 1 }}
                />
                <TextField
                  type="time"
                  size="small"
                  value={forecastInputValue.split('T')[1] ?? '00:00'}
                  onChange={e => {
                    const dateStr = forecastInputValue.split('T')[0];
                    onForecastTimeChange(e.target.value ? new Date(`${dateStr}T${e.target.value}`) : null);
                  }}
                  sx={{ width: 110 }}
                />
              </Box>
              <Tooltip title="One hour later">
                <IconButton size="small" onClick={() => adjustForecastHour(1)}>
                  <AddIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Stack>
          </Box>

          {/* Action buttons */}
          <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
            <Button variant="outlined" size="small" onClick={() => fetch()}>
              Fetch forecast
            </Button>
            <Button variant="outlined" size="small" onClick={reset}>
              Reset
            </Button>
          </Stack>

          {fetching ? (
            <Box sx={{ mt: 2 }}>
              <CircularProgress />
            </Box>
          ) : (
            <>
              <TableContainer
                component={Paper}
                sx={{ flexGrow: 1, padding: 0, overflow: 'hidden' }}
              >
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ width: '38%' }}>Altitude ({altitudeLabel})</TableCell>
                      <TableCell sx={{ width: '31%' }}>Direction</TableCell>
                      <TableCell sx={{ width: '31%' }}>Speed ({windSpeedLabel})</TableCell>
                      {!lock && <TableCell padding="none" />}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {winds.winds.map((row, i) => (
                      <TableRow
                        key={`tr-${i}`}
                        sx={i === 0 ? { bgcolor: 'action.selected' } : undefined}
                      >
                        <TableCell>
                          {lock ? (
                            <Typography variant="body2">
                              {Math.round(formatAltitude(row.altFt).value)}
                            </Typography>
                          ) : (
                            <TextField
                              type="number"
                              inputProps={{ step: altitudeLabel === 'ft' ? 100 : 30, min: 0 }}
                              value={Math.round(formatAltitude(row.altFt).value)}
                              onChange={e => updateRow(i, 'altFt', parseAltitude(Number(e.target.value)))}
                              sx={{ width: '100%' }}
                              size="small"
                            />
                          )}
                        </TableCell>
                        <TableCell>
                          {lock ? (
                            <Typography variant="body2">{row.direction}</Typography>
                          ) : (
                            <TextField
                              type="number"
                              inputProps={{ step: 5 }}
                              value={row.direction}
                              onChange={e => {
                                updateRow(i, 'direction', (360 + Number(e.target.value)) % 360);
                              }}
                              sx={{ width: '100%' }}
                              size="small"
                            />
                          )}
                        </TableCell>
                        <TableCell>
                          {lock ? (
                            <Typography variant="body2">
                              {formatWindSpeed(row.speedKts).value.toFixed(1)}
                            </Typography>
                          ) : (
                            <TextField
                              type="number"
                              value={formatWindSpeed(row.speedKts).value.toFixed(1)}
                              onChange={e => updateRow(i, 'speedKts', parseWindSpeed(Number(e.target.value)))}
                              sx={{ width: '100%' }}
                              size="small"
                            />
                          )}
                        </TableCell>
                        {!lock && (
                          <TableCell padding="none">
                            <Tooltip title="Remove row">
                              <IconButton size="small" onClick={() => removeRowAt(i)}>
                                <CloseIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              {!lock && (
                <Stack direction="row" spacing={1} sx={{ mt: 1, alignItems: 'center' }}>
                  <Tooltip title="Add row">
                    <IconButton size="small" onClick={addRow} color="primary">
                      <AddIcon />
                    </IconButton>
                  </Tooltip>
                  <Button variant="outlined" size="small" onClick={invertWind}>
                    Invert
                  </Button>
                </Stack>
              )}

              {lock && (
                <Button sx={{ mt: 2 }} variant="outlined" size="small" onClick={unlock}>
                  Unlock
                </Button>
              )}
            </>
          )}

          {forecastTime === null && (fetchingObserved || stationsFetched) && (
            <>
              <Divider sx={{ my: 2 }} />
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                  Observed Stations
                </Typography>
                {fetchingObserved && <CircularProgress size={12} />}
              </Stack>
              {fetchingObserved ? null : stations.length === 0 ? (
                <Typography variant="body2" color="text.disabled" sx={{ fontStyle: 'italic' }}>
                  No stations found within 10 miles.
                </Typography>
              ) : (
                <Stack spacing={1}>
                  {stations.map(station => (
                    <StationCard
                      key={station.id}
                      station={station}
                      formatWindSpeed={formatWindSpeed}
                      windSpeedLabel={windSpeedLabel}
                      formatTemperature={formatTemperature}
                      formatPressure={formatPressure}
                    />
                  ))}
                </Stack>
              )}
            </>
          )}
      </>
    </Box>
  );
}

function stationAge(date: Date): string {
  const diffMin = Math.round((Date.now() - date.getTime()) / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin} min ago`;
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function DataRow({ label, value }: { label: string; value: string | null }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Typography variant="caption" color={value !== null ? 'text.primary' : 'text.disabled'}>
        {value ?? '—'}
      </Typography>
    </Box>
  );
}

interface StationCardProps {
  station: ObservedWindStation;
  formatWindSpeed: (kts: number) => { value: number; label: string };
  windSpeedLabel: string;
  formatTemperature: (c: number) => { value: number; label: string };
  formatPressure: (hpa: number) => { value: number; label: string };
}

function StationCard({ station, formatWindSpeed, windSpeedLabel, formatTemperature, formatPressure }: StationCardProps) {
  const wind = formatWindSpeed(station.wind.speedKts);
  const gust = station.wind.gustKts !== undefined ? formatWindSpeed(station.wind.gustKts) : null;
  const distMiles = (station.distanceFt / 5280).toFixed(1);

  const CLOUD_AMOUNT_LABELS: Record<string, string> = {
    SKC: 'Clear', CLR: 'Clear', FEW: 'Few', SCT: 'Scattered',
    BKN: 'Broken', OVC: 'Overcast', VV: 'Obscured'
  };

  return (
    <Paper variant="outlined" sx={{ p: 1 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mb: 0.25 }}>
        <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.2 }}>{station.name}</Typography>
        <Typography variant="caption" color="text.secondary" sx={{ ml: 1, flexShrink: 0 }}>
          {distMiles} mi
        </Typography>
      </Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
        {station.stationUrl
          ? <a href={station.stationUrl} target="_blank" rel="noopener noreferrer">{station.source}</a>
          : station.source
        }
        {' · '}{stationAge(station.observedAt)}
      </Typography>
      {station.textDescription && (
        <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic', display: 'block', mb: 0.5 }}>
          {station.textDescription}
        </Typography>
      )}

      <DataRow label="Wind" value={`${wind.value.toFixed(1)} ${windSpeedLabel} ${Math.round(station.wind.direction)}°`} />
      <DataRow label="Gusts" value={gust !== null ? `${gust.value.toFixed(1)} ${windSpeedLabel}` : null} />

      {station.temperatureC !== undefined ? (
        <DataRow label="Temp" value={`${formatTemperature(station.temperatureC).value} ${formatTemperature(station.temperatureC).label}`} />
      ) : (
        <DataRow label="Temp" value={null} />
      )}
      {station.dewpointC !== undefined && (
        <DataRow label="Dewpoint" value={`${formatTemperature(station.dewpointC).value} ${formatTemperature(station.dewpointC).label}`} />
      )}
      {station.windChillC !== undefined && (
        <DataRow label="Wind chill" value={`${formatTemperature(station.windChillC).value} ${formatTemperature(station.windChillC).label}`} />
      )}
      {station.heatIndexC !== undefined && (
        <DataRow label="Heat index" value={`${formatTemperature(station.heatIndexC).value} ${formatTemperature(station.heatIndexC).label}`} />
      )}
      {station.humidityPct !== undefined ? (
        <DataRow label="Humidity" value={`${Math.round(station.humidityPct)}%`} />
      ) : (
        <DataRow label="Humidity" value={null} />
      )}
      {(station.seaLevelPressureHpa !== undefined || station.pressureHpa !== undefined) ? (
        <DataRow
          label={station.seaLevelPressureHpa !== undefined ? 'SLP' : 'Pressure'}
          value={(() => {
            const p = formatPressure(station.seaLevelPressureHpa ?? station.pressureHpa!);
            return `${p.value} ${p.label}`;
          })()}
        />
      ) : (
        <DataRow label="Pressure" value={null} />
      )}
      {station.visibilityM !== undefined && (
        <DataRow label="Visibility" value={`${(station.visibilityM / 1609).toFixed(1)} mi`} />
      )}
      {station.cloudLayers && station.cloudLayers.length > 0 && (
        <DataRow
          label="Sky"
          value={station.cloudLayers.map(l => {
            const label = CLOUD_AMOUNT_LABELS[l.amount] ?? l.amount;
            const base = l.baseM !== null ? ` @ ${Math.round(l.baseM * 3.28084)} ft` : '';
            return `${label}${base}`;
          }).join(', ')}
        />
      )}
    </Paper>
  );
}
