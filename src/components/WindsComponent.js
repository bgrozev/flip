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

import { SOURCE_MANUAL, forecastSourceLabel } from '../forecast/forecast.js';
import { WindRow, Winds } from '../util/wind.js';

export default function WindsComponent({ winds, setWinds, fetching, fetch }) {
    const lock = winds.groundSource !== SOURCE_MANUAL || winds.aloftSource !== SOURCE_MANUAL;

    const reset = useCallback(() => {
        const newWinds = new Winds([ new WindRow(0, 0, 0) ]);

        setWinds(newWinds);
    }, []);

    const addRow = () => {
        winds.addRow(new WindRow(0, 0, 0));
        setWinds(new Winds([ ...winds.winds ]));
    };

    const removeRow = () => {
        winds.winds.pop();
        setWinds(new Winds([ ...winds.winds ]));
    };

    const updateRow = (index, field, value) => {
        const updated = [ ...winds.winds ];

        updated[index][field] = value;
        setWinds(new Winds(updated));
    };

    const unlock = () => {
        winds.groundSource = SOURCE_MANUAL;
        winds.aloftSource = SOURCE_MANUAL;
        setWinds(new Winds([ ...winds.winds ], SOURCE_MANUAL, SOURCE_MANUAL));
    };

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', paddingLeft: 0 }}>
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

                    <Stack direction="row" spacing={2} sx={{ marginTop: 2, marginBottom: 2, alignItems: 'center' }}>
                        <Button variant="outlined" onClick={fetch}>Fetch forecast</Button>
                        <Button variant="outlined" onClick={reset}>Reset</Button>
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
                            <Button variant="outlined" onClick={addRow}>Add row</Button>
                            <Button variant="outlined" onClick={removeRow}>Remove row</Button>
                        </Stack>
                    )}

                    {lock
                        && <Button sx={{ marginTop: 2 }} variant="outlined" onClick={unlock}>Unlock</Button>
                    }
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
