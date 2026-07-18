/**
 * Wind source comparison: all OpenMeteo models plus the nearest sounding,
 * side by side per altitude band, with disagreement highlighted. Read-only
 * and behind a toggle — the active wind profile is never touched. First
 * pass for owner feedback; the visualization is expected to iterate.
 */
import {
  Box,
  Button,
  CircularProgress,
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
import React, { useMemo, useState } from 'react';

import { useAppState, useUnits, useWindComparison } from '../hooks';
import {
  ComparisonBand,
  compareProfiles,
  comparisonAltitudes
} from '../core/windCompare';
import { WindProfile } from '../core/wind';

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

function validTimeLabel(profile: WindProfile): string {
  return profile.validTime
    ? profile.validTime.toLocaleString([], {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    })
    : 'unknown time';
}

export default function WindComparison() {
  const { target, settings } = useAppState();
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
      comparisonAltitudes(settings.limitWind)
    );
  }, [sources, settings.limitWind]);

  const toggle = () => {
    if (open) {
      setOpen(false);
      clear();
    } else {
      setOpen(true);
      load(target.target);
    }
  };

  return (
    <Box sx={{ mt: 2 }}>
      <Button variant="outlined" size="small" onClick={toggle}>
        {open ? 'Hide comparison' : 'Compare sources'}
      </Button>

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
                            title={`${source.label} · valid ${validTimeLabel(source.profile as WindProfile)}`}
                          >
                            <TableCell align="right" sx={CELL_SX}>{source.label}</TableCell>
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
                Speeds in {windSpeedLabel}, sampled at the current hour.
                Highlighted rows disagree (&gt;15° or &gt;5 kts). Read-only —
                the active profile is unchanged.
              </Typography>
            </>
          )}
        </Box>
      )}
    </Box>
  );
}
