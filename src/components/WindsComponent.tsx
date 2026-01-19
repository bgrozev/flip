import {
  Box,
  Button,
  CircularProgress,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography
} from '@mui/material';
import React, { useCallback } from 'react';

import { SOURCE_MANUAL, forecastSourceLabel } from '../forecast/forecast';
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
  const lock =
    winds.groundSource !== SOURCE_MANUAL || winds.aloftSource !== SOURCE_MANUAL;

  const reset = useCallback(() => {
    setWinds(Winds.createDefault());
  }, [setWinds]);

  const addRow = () => {
    winds.addRow(new WindRow(0, 0, 0));
    setWinds(new Winds([...winds.winds]));
  };

  const removeRow = () => {
    winds.winds.pop();
    setWinds(new Winds([...winds.winds]));
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

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        paddingLeft: 0
      }}
    >
      {!fetching && (
        <>
          <Box sx={{ marginBottom: 2 }}>
            <Typography>
              Ground winds source: {forecastSourceLabel(winds.groundSource)}
            </Typography>
            <Typography>
              Upper winds source: {forecastSourceLabel(winds.aloftSource)}
            </Typography>
          </Box>

          <Stack
            direction="row"
            spacing={2}
            sx={{ marginTop: 2, marginBottom: 2, alignItems: 'center' }}
          >
            <Button variant="outlined" onClick={fetch}>
              Fetch forecast
            </Button>
            <Button variant="outlined" onClick={reset}>
              Reset
            </Button>
          </Stack>

          <TableContainer
            component={Paper}
            sx={{
              flexGrow: 1, // Makes the table container take available space
              padding: 0,
              overflow: 'hidden' // Disables scrolling
            }}
          >
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Altitude (ft)</TableCell>
                  <TableCell>Direction</TableCell>
                  <TableCell>Speed (kts)</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {winds.winds.map((row, i) => (
                  <TableRow key={`tr-${i}`}>
                    <TableCell sx={{ width: '30%' }}>
                      <TextField
                        type="number"
                        disabled={lock}
                        inputProps={{ step: 100, min: 0 }}
                        value={Math.round(row.altFt)}
                        onChange={e => updateRow(i, 'altFt', Number(e.target.value))}
                        sx={{ width: '100%' }} // Set width explicitly
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
                        sx={{ width: '100%' }} // Set width explicitly
                      />
                    </TableCell>
                    <TableCell sx={{ width: '30%' }}>
                      <TextField
                        type="number"
                        disabled={lock}
                        value={row.speedKts.toFixed(1)}
                        onChange={e => updateRow(i, 'speedKts', Number(e.target.value))}
                        sx={{ width: '100%' }} // Set width explicitly
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {/* Row Buttons */}
          {!lock && (
            <Stack direction="row" spacing={2} sx={{ marginTop: 2 }}>
              <Button variant="outlined" onClick={addRow}>
                Add row
              </Button>
              <Button variant="outlined" onClick={removeRow}>
                Remove row
              </Button>
            </Stack>
          )}

          {lock && (
            <Button sx={{ marginTop: 2 }} variant="outlined" onClick={unlock}>
              Unlock
            </Button>
          )}
        </>
      )}

      {fetching && (
        <Box sx={{ marginTop: 2 }}>
          <Typography variant="body2">Fetching forecast...</Typography>
          <CircularProgress />
        </Box>
      )}
    </Box>
  );
}
