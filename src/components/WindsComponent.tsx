import {
  Add as AddIcon,
  Close as CloseIcon,
  Remove as RemoveIcon
} from '@mui/icons-material';
import {
  Box,
  Button,
  CircularProgress,
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
import { WindRow, Winds } from '../util/wind';

interface WindsComponentProps {
  winds: Winds;
  setWinds: (winds: Winds) => void;
  fetching: boolean;
  fetch: (ft?: Date | null) => void;
  forecastTime: Date | null;
  onForecastTimeChange: (t: Date | null) => void;
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
  onForecastTimeChange
}: WindsComponentProps) {
  const {
    formatAltitude,
    parseAltitude,
    altitudeLabel,
    formatWindSpeed,
    parseWindSpeed,
    windSpeedLabel
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
            <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
              Forecast time
            </Typography>
            <Stack direction="row" spacing={0.5} alignItems="center">
              <Tooltip title="One hour earlier">
                <IconButton size="small" onClick={() => adjustForecastHour(-1)}>
                  <RemoveIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <TextField
                type="datetime-local"
                size="small"
                value={forecastInputValue}
                inputProps={{
                  min: toDateTimeLocalString(minDate),
                  max: toDateTimeLocalString(maxDate)
                }}
                onChange={e => {
                  if (!e.target.value) {
                    onForecastTimeChange(null);
                  } else {
                    onForecastTimeChange(new Date(e.target.value));
                  }
                }}
                onBlur={e => {
                  const newTime = e.target.value ? new Date(e.target.value) : null;
                  fetch(newTime);
                }}
                sx={{ flex: 1 }}
              />
              <Tooltip title="One hour later">
                <IconButton size="small" onClick={() => adjustForecastHour(1)}>
                  <AddIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              {forecastTime && (
                <Button
                  variant="text"
                  size="small"
                  onClick={() => onForecastTimeChange(null)}
                  sx={{ minWidth: 0, px: 0.5 }}
                >
                  Now
                </Button>
              )}
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
      </>
    </Box>
  );
}
