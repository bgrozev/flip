import {
  Add as AddIcon,
  Close as CloseIcon,
  Cyclone as CycloneIcon,
  ExpandMore as ExpandMoreIcon,
  CloudOutlined as CloudOutlinedIcon,
  DeviceThermostat as DeviceThermostatIcon,
  EditOutlined as EditOutlinedIcon,
  Remove as RemoveIcon,
  Sensors as SensorsIcon,
  Terrain as TerrainIcon,
  WaterDrop as WaterDropIcon
} from '@mui/icons-material';
import {
  Box,
  Button,
  CircularProgress,
  Divider,
  IconButton,
  Link,
  Paper,
  Slider,
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
import React, { useCallback, useEffect, useState } from 'react';

import { useAppState, useUnits } from '../hooks';
import WindComparison from './WindComparison';
import { LatLng, ObservedWindStation } from '../types';
import {
  DaSeverity,
  TempSeverity,
  daSeverity,
  temperatureSeverity,
  tryDensityAltitudeFt
} from '../core/atmosphere';
import { LIMITS, clampNumber, normalizeDirection } from '../core/validation';
import {
  SOURCE_MANUAL,
  SOURCE_OPEN_METEO,
  SOURCE_SOUNDING,
  WindProfile,
  WindRow,
  beaufortColor,
  createWindProfile,
  createWindRow,
  groundConditions,
  sampleWindBands,
  soundingStationUrl,
  windModelLabel,
  windRowSourceKind
} from '../core/wind';

interface WindsComponentProps {
  winds: WindProfile;
  setWinds: (winds: WindProfile) => void;
  fetching: boolean;
  fetch: (ft?: Date | null, opts?: { force?: boolean }) => void;
  forecastTime: Date | null;
  onForecastTimeChange: (t: Date | null) => void;
  /**
   * Whether hand-editing the profile is offered at all (nerd mode). With
   * it off the table is read-only and the Unlock button is not rendered.
   */
  allowManualEdit?: boolean;
  stations?: ObservedWindStation[];
  stationsFetched?: boolean;
  fetchingObserved?: boolean;
  /** Hours from now covered by the local forecast cache (scrubber range). */
  scrubHours?: number | null;
  /**
   * Altitude bands for the collapsed summary — the same list the map's
   * winds indicator uses, so both surfaces show the same summary.
   */
  bandAltitudesFt?: readonly number[];
  /** Whether band values are interpolated between levels (effective setting). */
  interpolate?: boolean;
}

/** Format a Date to the value string required by datetime-local inputs (YYYY-MM-DDTHH:mm) */
/**
 * Editable wind rows are cramped: three number fields (each with a spinner)
 * plus a remove button share the panel's width, and MUI's default cell and
 * input padding left too little room for e.g. a five-digit altitude. Trim both
 * so typed values are not clipped.
 */
const EDIT_CELL_SX = { px: 0.5 };
const NUMBER_FIELD_SX = { width: '100%', minWidth: 56, '& input': { px: 0.75 } };

/** Select a field's value on focus: these are retyped, not edited in place. */
function selectOnFocus(e: React.FocusEvent<HTMLInputElement>): void {
  e.target.select();
}

/** Windy deep link for a location: `?lat,lng,zoom`. */
function windyUrl({ lat, lng }: LatLng): string {
  return `https://www.windy.com/?${lat.toFixed(4)},${lng.toFixed(4)},11`;
}

function toDateTimeLocalString(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

/**
 * Subtle per-row provenance indicator for the read-only wind table: an
 * observed-station row stands out (it is real, current data injected among
 * forecast rows); forecast and manual rows get a muted icon. Detail lives
 * in the tooltip so the table itself stays quiet.
 */
function RowSourceIndicator({ row }: { row: WindRow }) {
  const kind = windRowSourceKind(row.source);
  const mutedSx = { fontSize: 14, color: 'text.disabled', display: 'block' } as const;

  if (kind === 'station') {
    const age = row.validTime ? ` · ${stationAge(row.validTime)}` : '';

    return (
      <Tooltip title={`Observed · ${row.source}${age}`}>
        <SensorsIcon sx={{ ...mutedSx, color: 'success.main' }} />
      </Tooltip>
    );
  }

  if (kind === 'manual') {
    return (
      <Tooltip title="Manually entered">
        <EditOutlinedIcon sx={mutedSx} />
      </Tooltip>
    );
  }

  return (
    <Tooltip title={kind === 'sounding' ? 'Sounding' : 'OpenMeteo forecast'}>
      <CloudOutlinedIcon sx={mutedSx} />
    </Tooltip>
  );
}

/** Age beyond which fetched winds are flagged as stale (with a refresh nudge). */
const STALE_AFTER_MS = 30 * 60_000;

/**
 * "· fetched N min ago" staleness suffix for the source badge of a fetched
 * profile (restored ones included — winds persist across reloads). Re-renders
 * itself once a minute; past the staleness threshold the age turns into a
 * warning and grows a refresh link.
 */
function FetchedAgo({ fetchedAt, onRefresh }: { fetchedAt: Date; onRefresh: () => void }) {
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60_000);

    return () => clearInterval(id);
  }, []);

  const stale = Date.now() - fetchedAt.getTime() > STALE_AFTER_MS;

  return (
    <>
      {' · '}
      <Box component="span" sx={stale ? { color: 'warning.main' } : undefined}>
        fetched {stationAge(fetchedAt)}
      </Box>
      {stale && (
        <>
          {' '}
          <Link
            component="button"
            type="button"
            variant="caption"
            onClick={onRefresh}
            sx={{ verticalAlign: 'baseline' }}
          >
            refresh
          </Link>
        </>
      )}
    </>
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
  allowManualEdit = false,
  bandAltitudesFt = [],
  interpolate = false,
  stations = [],
  stationsFetched = false,
  fetchingObserved = false,
  scrubHours = null
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

  const { settings, target } = useAppState();
  // Keyed off the *selected* source, not the fetched profile's, so the picker
  // disappears as soon as soundings are chosen — before any fetch.
  const soundingSelected = settings.windAloftSource === 'sounding';

  const { tempC, humidityPct, elevationFt } = groundConditions(winds);
  const densityAltFt = tryDensityAltitudeFt(elevationFt, tempC, humidityPct);
  const densitySeverity = daSeverity(densityAltFt, elevationFt);

  // Without the manual-wind feature the table is always read-only, even if
  // the stored profile is already manual (entered in a previous nerd
  // session). The values are kept — masking the editor does not discard
  // data — and Refresh still replaces them with the forecast.
  const lock =
    !allowManualEdit ||
    winds.groundSource !== SOURCE_MANUAL || winds.aloftSource !== SOURCE_MANUAL;

  // The table opens as the same by-altitude summary the map indicator
  // shows, and expands to every level the source returned (~35 rows).
  // Editing needs the real levels, so unlocking forces the full table.
  const [showAllLevels, setShowAllLevels] = useState(false);
  const summary = sampleWindBands(winds, bandAltitudesFt, interpolate);
  // A summary of nothing but GND is not a summary — fall back to the full
  // table rather than hiding every level behind an expander.
  const fullTable = showAllLevels || !lock || summary.length < 2;

  const reset = useCallback(() => {
    setWinds(createWindProfile());
  }, [setWinds]);

  // Forecast time picker
  const now = new Date();
  const minDate = roundUpToHour(now);
  const maxDate = new Date(now.getTime() + 7 * 24 * 3600 * 1000);
  const forecastInputValue = forecastTime
    ? toDateTimeLocalString(forecastTime)
    : toDateTimeLocalString(minDate);

  // Scrubber position: the currently selected hour offset from now
  const scrubValue = forecastTime
    ? Math.max(0, Math.round((forecastTime.getTime() - Date.now()) / 3600000))
    : 0;

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

  // Note: the row-editing actions below intentionally produce a fresh
  // manual-source profile (they are only reachable when unlocked).
  const addRow = () => {
    setWinds(createWindProfile([...winds.winds, createWindRow(0, 0, 0)]));
  };

  const removeRowAt = (index: number) => {
    setWinds(createWindProfile(winds.winds.filter((_, i) => i !== index)));
  };

  const updateRow = (index: number, field: 'altFt' | 'direction' | 'speedKts', value: number) => {
    // Clamp/normalize so absurd manual entries never reach the path math
    const safeValue = field === 'direction'
      ? normalizeDirection(value)
      : field === 'altFt'
        ? clampNumber(value, LIMITS.windAltFt.min, LIMITS.windAltFt.max)
        : clampNumber(value, LIMITS.windSpeedKts.min, LIMITS.windSpeedKts.max);
    const updated = winds.winds.map((row, i) => {
      if (i !== index) return row;
      return createWindRow(
        field === 'altFt' ? safeValue : row.altFt,
        field === 'direction' ? safeValue : row.direction,
        field === 'speedKts' ? safeValue : row.speedKts
      );
    });
    setWinds(createWindProfile(updated));
  };

  const unlock = () => {
    setWinds(createWindProfile([...winds.winds]));
  };

  const invertWind = () => {
    const inverted = winds.winds.map(
      row => createWindRow(row.altFt, (row.direction + 180) % 360, row.speedKts)
    );
    setWinds(createWindProfile(inverted));
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', paddingLeft: 0 }}>
      <>
        {/* Forecast time picker. Hidden for soundings: a radiosonde profile is
            whatever was last launched, so the source ignores hourOffset and a
            time control here would be inert. */}
        {!soundingSelected && <Box sx={{ mb: 1.5 }}>
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
          {/* Time scrubber: drag through the locally cached forecast hours.
              Each step re-selects the hour from the prefetched window (no
              network fetch), so the table and the map paths morph live. The
              fast path to the picker's precise path; hidden until a fetch
              has filled the cache. */}
          {scrubHours !== null && scrubHours > 1 && (
            <Box sx={{ px: 1 }}>
              <Slider
                size="small"
                aria-label="Scrub forecast hour"
                min={0}
                max={scrubHours - 1}
                step={1}
                value={Math.min(scrubValue, scrubHours - 1)}
                onChange={(_e, v) => {
                  const h = v as number;
                  const newTime = h === 0 ? null : new Date(Date.now() + h * 3600000);

                  onForecastTimeChange(newTime);
                  fetch(newTime);
                }}
                valueLabelDisplay="auto"
                valueLabelFormat={(h: number) => (h === 0 ? 'now' : `+${h}h`)}
              />
            </Box>
          )}
        </Box>}

        {/* Fetching lives in the panel header's refresh icon (App), not in a
            full-width button down here; Reset moved down next to Unlock,
            since both are editing actions and both are nerd-only. */}

        <Stack direction="row" spacing={2.5} sx={{ mb: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
          <ConditionStat
            icon={<DeviceThermostatIcon fontSize="small" />}
            label="Temperature"
            value={tempC !== undefined ? `${formatTemperature(tempC).value.toFixed(0)}${formatTemperature(tempC).label}` : null}
            severity={temperatureSeverity(tempC)}
          />
          <ConditionStat
            icon={<WaterDropIcon fontSize="small" />}
            label="Humidity"
            value={humidityPct !== undefined ? `${Math.round(humidityPct)}%` : null}
          />
          <ConditionStat
            icon={<TerrainIcon fontSize="small" />}
            label={`Density altitude (elevation ${elevationFt !== undefined ? Math.round(formatAltitude(elevationFt).value) : '?'} ${altitudeLabel})`}
            value={densityAltFt !== undefined ? `${Math.round(formatAltitude(densityAltFt).value)} ${altitudeLabel}` : null}
            severity={densitySeverity}
          />
          {/* Second opinion: the same spot on Windy's own maps. An icon on
              this row rather than its own line of prose — it is a side
              door, not a step in the workflow. A swirl rather than
              Windy's own mark: their logo would mean either fetching it
              from windy.com on every render (a third-party request from
              a PWA that is meant to work offline) or shipping their
              trademark artwork. `Air` is taken by the Wind nav item. */}
          <Tooltip title="Open this location in Windy">
            <IconButton
              size="small"
              aria-label="Open this location in Windy"
              href={windyUrl(target.target)}
              target="_blank"
              rel="noopener noreferrer"
              sx={{ color: 'text.secondary' }}
            >
              <CycloneIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>

        {fetching ? (
          <Box sx={{ mt: 2 }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            {winds.aloftSource === SOURCE_MANUAL && (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ mb: 0.5, textAlign: 'left' }}
              >
                {'Manually entered'}
              </Typography>
            )}
            {winds.aloftSource === SOURCE_OPEN_METEO && (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ mb: 0.5, textAlign: 'left' }}
              >
                {'OpenMeteo'}
                {winds.meta?.model ? ` · ${windModelLabel(winds.meta.model)}` : ''}
                {winds.validTime
                  ? ` · valid ${winds.validTime.toLocaleString([], {
                    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                  })}`
                  : ''}
                {winds.meta?.fetchedAt && (
                  <FetchedAgo
                    fetchedAt={winds.meta.fetchedAt}
                    onRefresh={() => fetch(undefined, { force: true })}
                  />
                )}
              </Typography>
            )}
            {winds.aloftSource === SOURCE_SOUNDING && (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ mb: 0.5, textAlign: 'left' }}
              >
                {'Sounding'}
                {/* Prefer the human-readable station name; fall back to its id.
                    Linked to IEM's page for that station when we know the id. */}
                {winds.meta?.stationName || winds.meta?.station
                  ? <>
                    {' · '}
                    {winds.meta.station
                      ? (
                        <Link
                          href={soundingStationUrl(winds.meta.station)}
                          target="_blank"
                          rel="noopener noreferrer"
                          color="inherit"
                        >
                          {winds.meta.stationName ?? winds.meta.station}
                        </Link>
                      )
                      : winds.meta.stationName}
                  </>
                  : ''}
                {winds.meta?.stationDistanceFt !== undefined
                  ? ` (${(winds.meta.stationDistanceFt / 5280).toFixed(0)} mi)`
                  : ''}
                {winds.validTime
                  ? ` · launched ${winds.validTime.toLocaleString([], {
                    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                  })}`
                  : ''}
                {winds.meta?.fetchedAt && (
                  <FetchedAgo
                    fetchedAt={winds.meta.fetchedAt}
                    onRefresh={() => fetch(undefined, { force: true })}
                  />
                )}
              </Typography>
            )}
            <TableContainer
              component={Paper}
              sx={{ flexGrow: 1, padding: 0, overflow: 'hidden' }}
            >
              <Table size="small">
                <TableHead>
                  <TableRow>
                    {lock && <TableCell padding="none" sx={{ width: 24 }} />}
                    <TableCell sx={{ width: '38%' }}>Altitude ({altitudeLabel})</TableCell>
                    <TableCell sx={{ width: '31%' }}>Direction</TableCell>
                    <TableCell sx={{ width: '31%' }}>Speed ({windSpeedLabel})</TableCell>
                    {!lock && <TableCell padding="none" />}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {!fullTable && summary.map(band => (
                    <TableRow
                      key={`band-${band.altFt}`}
                      sx={band.ground ? { bgcolor: 'action.selected' } : undefined}
                    >
                      <TableCell padding="none" sx={{ pl: 1 }}>
                        {/* Only the ground row is a real level here; the bands
                            are sampled, so they carry no provenance icon. */}
                        {band.ground && <RowSourceIndicator row={winds.winds[0]} />}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {band.ground
                            ? 'GND'
                            : Math.round(formatAltitude(band.altFt).value)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{Math.round(band.direction)}</Typography>
                      </TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={0.75} alignItems="center">
                          <Box
                            component="span"
                            sx={{
                              width: 10,
                              height: 10,
                              borderRadius: '50%',
                              flexShrink: 0,
                              bgcolor: beaufortColor(band.speedKts),
                              border: '1px solid rgba(0,0,0,0.25)'
                            }}
                          />
                          <Typography variant="body2">
                            {formatWindSpeed(band.speedKts).value.toFixed(1)}
                          </Typography>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                  {fullTable && winds.winds.map((row, i) => (
                    <TableRow
                      key={`tr-${i}`}
                      sx={i === 0 ? { bgcolor: 'action.selected' } : undefined}
                    >
                      {lock && (
                        <TableCell padding="none" sx={{ pl: 1 }}>
                          <RowSourceIndicator row={row} />
                        </TableCell>
                      )}
                      <TableCell sx={lock ? undefined : EDIT_CELL_SX}>
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
                            onFocus={selectOnFocus}
                            sx={NUMBER_FIELD_SX}
                            size="small"
                          />
                        )}
                      </TableCell>
                      <TableCell sx={lock ? undefined : EDIT_CELL_SX}>
                        {lock ? (
                          <Typography variant="body2">{row.direction}</Typography>
                        ) : (
                          <TextField
                            type="number"
                            inputProps={{ step: 5 }}
                            value={row.direction}
                            onChange={e => {
                              updateRow(i, 'direction', Number(e.target.value));
                            }}
                            onFocus={selectOnFocus}
                            sx={NUMBER_FIELD_SX}
                            size="small"
                          />
                        )}
                      </TableCell>
                      <TableCell sx={lock ? undefined : EDIT_CELL_SX}>
                        {lock ? (
                          <Stack direction="row" spacing={0.75} alignItems="center">
                            <Box
                              component="span"
                              sx={{
                                width: 10,
                                height: 10,
                                borderRadius: '50%',
                                flexShrink: 0,
                                bgcolor: beaufortColor(row.speedKts),
                                border: '1px solid rgba(0,0,0,0.25)'
                              }}
                            />
                            <Typography variant="body2">
                              {formatWindSpeed(row.speedKts).value.toFixed(1)}
                            </Typography>
                          </Stack>
                        ) : (
                          <TextField
                            type="number"
                            value={formatWindSpeed(row.speedKts).value.toFixed(1)}
                            onChange={e => updateRow(i, 'speedKts', parseWindSpeed(Number(e.target.value)))}
                            onFocus={selectOnFocus}
                            sx={NUMBER_FIELD_SX}
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

            {lock && summary.length > 1 && (
              <Button
                variant="text"
                size="small"
                onClick={() => setShowAllLevels(v => !v)}
                startIcon={
                  <ExpandMoreIcon
                    fontSize="small"
                    sx={{
                      transform: showAllLevels ? 'rotate(180deg)' : 'none',
                      transition: 'transform 150ms'
                    }}
                  />
                }
                sx={{ mt: 0.5, alignSelf: 'flex-start', textTransform: 'none' }}
              >
                {showAllLevels
                  ? 'Show summary'
                  : `Show all ${winds.winds.length} levels`}
              </Button>
            )}

            {/* Every editing action in one row, all of it nerd-only. */}
            {allowManualEdit && (
              <Stack direction="row" spacing={1} sx={{ mt: 2, alignItems: 'center' }}>
                {lock ? (
                  <Button variant="outlined" size="small" onClick={unlock}>
                      Unlock
                  </Button>
                ) : (
                  <>
                    <Tooltip title="Add row">
                      <IconButton size="small" onClick={addRow} color="primary">
                        <AddIcon />
                      </IconButton>
                    </Tooltip>
                    <Button variant="outlined" size="small" onClick={invertWind}>
                        Invert
                    </Button>
                  </>
                )}
                <Button variant="outlined" size="small" onClick={reset}>
                    Reset
                </Button>
              </Stack>
            )}
          </>
        )}

        {/* Read-only model/sounding comparison, behind its own toggle.
            Outside the fetching branch so a main-profile fetch does not
            unmount it (which would silently close an open comparison). */}
        <WindComparison forecastTime={forecastTime} />

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

/**
 * A ground-condition readout (temp/humidity/DA) at the top of the Wind
 * panel: an icon + value, muted with an em-dash when the source doesn't
 * have it, tinted when a severity (density-altitude caution/warning) applies.
 */
function ConditionStat({
  icon,
  label,
  value,
  severity = 'normal'
}: {
  icon: React.ReactNode;
  label: string;
  value: string | null;
  severity?: DaSeverity | TempSeverity;
}) {
  const color = value === null
    ? 'text.disabled'
    : severity === 'warning' || severity === 'veryHot'
      ? 'error.main'
      : severity === 'caution' || severity === 'hot'
        ? 'warning.main'
        : severity === 'cold'
          ? 'info.main'
          : 'text.primary';

  return (
    <Tooltip title={label}>
      <Stack direction="row" spacing={0.5} alignItems="center" sx={{ color }}>
        {icon}
        <Typography variant="body2" sx={{ color: 'inherit', fontWeight: severity !== 'normal' && value !== null ? 700 : 400 }}>
          {value ?? '—'}
        </Typography>
      </Stack>
    </Tooltip>
  );
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
