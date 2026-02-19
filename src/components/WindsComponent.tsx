import {
  Add as AddIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import {
  Box,
  Button,
  Chip,
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
  Tooltip
} from '@mui/material';
import React, { useCallback } from 'react';

import { SOURCE_MANUAL, forecastSourceLabel } from '../forecast/forecast';
import { useUnits } from '../hooks';
import { WindRow, Winds } from '../util/wind';

interface WindsComponentProps {
  winds: Winds;
  setWinds: (winds: Winds) => void;
  fetching: boolean;
  fetch: () => void;
}

export default function WindsComponent({
  winds,
  setWinds,
  fetching,
  fetch
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
      {!fetching && (
        <>
          {/* Source chips */}
          <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap', gap: 1 }}>
            <Chip
              size="small"
              label={`Ground: ${forecastSourceLabel(winds.groundSource)}`}
              color={winds.groundSource === SOURCE_MANUAL ? 'default' : 'info'}
              variant={winds.groundSource === SOURCE_MANUAL ? 'outlined' : 'filled'}
            />
            <Chip
              size="small"
              label={`Upper: ${forecastSourceLabel(winds.aloftSource)}`}
              color={winds.aloftSource === SOURCE_MANUAL ? 'default' : 'info'}
              variant={winds.aloftSource === SOURCE_MANUAL ? 'outlined' : 'filled'}
            />
          </Stack>

          <Stack direction="row" spacing={2} sx={{ mb: 2, alignItems: 'center' }}>
            <Button variant="outlined" onClick={fetch}>
              Fetch forecast
            </Button>
            <Button variant="outlined" onClick={reset}>
              Reset
            </Button>
          </Stack>

          <TableContainer
            component={Paper}
            sx={{ flexGrow: 1, padding: 0, overflow: 'hidden' }}
          >
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Altitude ({altitudeLabel})</TableCell>
                  <TableCell>Direction</TableCell>
                  <TableCell>Speed ({windSpeedLabel})</TableCell>
                  {!lock && <TableCell padding="none" />}
                </TableRow>
              </TableHead>
              <TableBody>
                {winds.winds.map((row, i) => (
                  <TableRow
                    key={`tr-${i}`}
                    sx={i === 0 ? { bgcolor: 'action.selected' } : undefined}
                  >
                    <TableCell sx={{ width: '30%' }}>
                      <TextField
                        type="number"
                        disabled={lock}
                        inputProps={{ step: altitudeLabel === 'ft' ? 100 : 30, min: 0 }}
                        value={Math.round(formatAltitude(row.altFt).value)}
                        onChange={e => updateRow(i, 'altFt', parseAltitude(Number(e.target.value)))}
                        sx={{ width: '100%' }}
                        size="small"
                      />
                    </TableCell>
                    <TableCell sx={{ width: '30%' }}>
                      <TextField
                        type="number"
                        disabled={lock}
                        inputProps={{ step: 5 }}
                        value={row.direction}
                        onChange={e => {
                          updateRow(i, 'direction', (360 + Number(e.target.value)) % 360);
                        }}
                        sx={{ width: '100%' }}
                        size="small"
                      />
                    </TableCell>
                    <TableCell sx={{ width: '30%' }}>
                      <TextField
                        type="number"
                        disabled={lock}
                        value={formatWindSpeed(row.speedKts).value.toFixed(1)}
                        onChange={e => updateRow(i, 'speedKts', parseWindSpeed(Number(e.target.value)))}
                        sx={{ width: '100%' }}
                        size="small"
                      />
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
            <Button sx={{ mt: 2 }} variant="outlined" onClick={unlock}>
              Unlock
            </Button>
          )}
        </>
      )}

      {fetching && (
        <Box sx={{ mt: 2 }}>
          <CircularProgress />
        </Box>
      )}
    </Box>
  );
}
