/**
 * Wind source comparison: all OpenMeteo models plus the nearest sounding,
 * side by side per altitude band, with disagreement highlighted. Read-only
 * and behind a toggle — the active wind profile is never touched. First
 * pass for owner feedback; the visualization is expected to iterate.
 */
import { ExpandMore as ExpandMoreIcon } from '@mui/icons-material';
import {
  Box,
  CircularProgress,
  Link,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography
} from '@mui/material';
import React, { useEffect, useMemo, useRef, useState } from 'react';

import { useAppState, useUnits, useWindComparison } from '../hooks';
import { ComparisonSourceResult } from '../hooks/useWindComparison';
import {
  COMPARISON_CEILING_FT,
  ComparisonBand,
  compareProfiles,
  comparisonAltitudes
} from '../core/windCompare';
import { WindProfile, forecastHourOffset, soundingStationUrl } from '../core/wind';

/** Highlight for bands where sources disagree (works in both themes). */
const DISAGREE_ROW_SX = { bgcolor: 'rgba(255, 152, 0, 0.18)' } as const;

const CELL_SX = { px: 0.5, whiteSpace: 'nowrap' } as const;

function CellArrow({ direction }: { direction: number }) {
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-block',
        transform: `rotate(${direction + 180}deg)`,
        mr: 0.25,
        fontSize: '0.85em'
      }}
    >
      ↑
    </Box>
  );
}

/** What a column IS, for its header tooltip. */
function sourceDescription(source: ComparisonSourceResult): string {
  if (source.id !== 'sounding') {
    return `${source.label} forecast model`;
  }

  if (!source.station) {
    return 'Radiosonde sounding';
  }

  // Both the id and the name: IEM ids like "_TBW" mean nothing on their
  // own, and the name ("Tampa Bay Area -- KTPA KTBW") is what tells you
  // which balloon this is.
  return `Radiosonde sounding · ${source.stationName ?? source.station} ` +
    `(${source.station}) · opens the station page`;
}

/** Column header: the sounding's links out to its station page. */
function SourceHeaderLabel({ source }: { source: ComparisonSourceResult }) {
  if (source.id !== 'sounding' || !source.station) {
    return <>{source.label}</>;
  }

  return (
    <Link
      href={soundingStationUrl(source.station)}
      target="_blank"
      rel="noopener noreferrer"
      color="inherit"
    >
      {source.label}
    </Link>
  );
}

function validTimeLabel(profile: WindProfile): string {
  return profile.validTime
    ? profile.validTime.toLocaleString([], {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    })
    : 'unknown time';
}

interface WindComparisonProps {
  /** The hour the app is planning for; null = now. */
  forecastTime?: Date | null;
}

export default function WindComparison({ forecastTime = null }: WindComparisonProps) {
  const { target } = useAppState();
  const { formatAltitude, altitudeLabel, formatWindSpeed, windSpeedLabel } = useUnits();
  const { loading, results, load, clear } = useWindComparison();
  const [open, setOpen] = useState(false);

  const sources = useMemo(
    () => results?.filter(r => r.profile !== null) ?? [],
    [results]
  );
  const failures = results?.filter(r => r.profile === null) ?? [];

  const bands: ComparisonBand[] | null = useMemo(() => {
    if (sources.length < 2) {
      return null;
    }

    return compareProfiles(
      sources.map(r => r.profile as WindProfile),
      comparisonAltitudes(COMPARISON_CEILING_FT)
    );
  }, [sources]);

  // Read at call time rather than as an effect dependency: the comparison
  // must follow the forecast hour, but re-fetching four models on every
  // frame of a target drag would be a fetch storm.
  const targetRef = useRef(target.target);

  targetRef.current = target.target;

  const toggle = () => {
    if (open) {
      clear();
    }
    setOpen(!open);
  };

  // The ONLY loader: opening and changing the hour both go through here.
  // Loading from the toggle as well raced the effect's load — the second
  // call aborts the first controller, and the sounding column came back
  // as "signal is aborted without reason".
  //
  // Following the forecast time is the point: the table used to keep
  // showing the hour it was opened at, silently, while the rest of the
  // panel moved on.
  const forecastMs = forecastTime ? forecastTime.getTime() : null;

  useEffect(() => {
    if (open) {
      load(targetRef.current, forecastHourOffset(forecastMs === null ? null : new Date(forecastMs)));
    }
  }, [open, forecastMs, load]);

  return (
    <Box sx={{ mt: 2 }}>
      {/* A disclosure row, not a button that renames itself: the old
          "Compare sources" / "Hide comparison" toggle gave no hint that a
          section was about to appear below it, or that it was already open. */}
      <Stack
        direction="row"
        alignItems="center"
        spacing={0.5}
        onClick={toggle}
        role="button"
        aria-expanded={open}
        aria-label="Compare sources"
        sx={{ cursor: 'pointer', userSelect: 'none', width: 'fit-content' }}
      >
        <ExpandMoreIcon
          fontSize="small"
          sx={{
            color: 'text.secondary',
            transform: open ? 'none' : 'rotate(-90deg)',
            transition: 'transform 150ms'
          }}
        />
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8 }}
        >
          Compare sources
        </Typography>
        {open && loading && <CircularProgress size={12} />}
      </Stack>

      {open && (
        <Box sx={{ mt: 1 }}>
          {loading ? (
            <Stack direction="row" spacing={1} alignItems="center" sx={{ my: 1 }}>
              <CircularProgress size={16} />
              <Typography variant="caption" color="text.secondary">
                Fetching models and sounding…
              </Typography>
            </Stack>
          ) : (
            <>
              {bands ? (
                <TableContainer>
                  <Table size="small" padding="none">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={CELL_SX}>{altitudeLabel}</TableCell>
                        {sources.map(source => (
                          <Tooltip
                            key={source.id}
                            title={`${sourceDescription(source)} · valid ` +
                              `${validTimeLabel(source.profile as WindProfile)}`}
                          >
                            <TableCell align="right" sx={CELL_SX}>
                              <SourceHeaderLabel source={source} />
                            </TableCell>
                          </Tooltip>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {bands.map(band => (
                        <TableRow
                          key={band.altFt}
                          sx={band.disagree ? DISAGREE_ROW_SX : undefined}
                        >
                          <Tooltip
                            title={band.disagree
                              ? `Spread: ${Math.round(band.directionSpreadDeg)}° / ` +
                                `${formatWindSpeed(band.speedSpreadKts).value.toFixed(1)} ${windSpeedLabel}`
                              : ''}
                          >
                            <TableCell sx={CELL_SX}>
                              {Math.round(formatAltitude(band.altFt).value)}
                            </TableCell>
                          </Tooltip>
                          {band.cells.map((cell, i) => (
                            <TableCell key={sources[i].id} align="right" sx={CELL_SX}>
                              {cell ? (
                                <Tooltip
                                  title={`${Math.round(cell.direction)}° · ` +
                                    `${formatWindSpeed(cell.speedKts).value.toFixed(1)} ${windSpeedLabel}`}
                                >
                                  <Box component="span">
                                    <CellArrow direction={cell.direction} />
                                    {Math.round(formatWindSpeed(cell.speedKts).value)}
                                  </Box>
                                </Tooltip>
                              ) : (
                                <Typography component="span" variant="caption" color="text.disabled">
                                  —
                                </Typography>
                              )}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : (
                <Typography variant="caption" color="text.secondary">
                  Not enough sources to compare.
                </Typography>
              )}

              {failures.map(f => (
                <Typography
                  key={f.id}
                  variant="caption"
                  color="text.disabled"
                  sx={{ display: 'block', mt: 0.5 }}
                >
                  {f.label}: {f.error}
                </Typography>
              ))}

              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: 'block', mt: 0.5 }}
              >
                Every forecast model plus the nearest radiosonde
                (&ldquo;Sounding&rdquo;), in {windSpeedLabel}, sampled at{' '}
                {forecastTime ? validTimeLabel({ validTime: forecastTime } as WindProfile) : 'the current hour'}.
                A sounding is whatever was last launched, so its column
                ignores the forecast time. Highlighted rows disagree
                (&gt;15° or &gt;5 kts). Read-only — the active profile is
                unchanged.
              </Typography>
            </>
          )}
        </Box>
      )}
    </Box>
  );
}
