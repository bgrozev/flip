import DeleteIcon from '@mui/icons-material/Delete';
import {
    Box,
    Button,
    Checkbox,
    Divider,
    FormControl,
    FormControlLabel,
    IconButton,
    InputLabel,
    MenuItem,
    Select,
    Stack,
    TextField,
    Tooltip,
    Typography
} from '@mui/material';
import { useLocalStorageState } from '@toolpad/core/useLocalStorageState';
import { csvParse } from 'd3';
import React, { useState } from 'react';

import { convertFromGnss, extractPathFromCsv } from '../util/csv.js';
import { CODEC_JSON, mirror as mirrorPath } from '../util/util.js';

export default function ManoeuvreTrackComponent({ manoeuvreToSave, onChange }) {
    const [ tracks, setTracks ] = useLocalStorageState('flip.manoeuvre.track.tracks', [], { codec: CODEC_JSON });
    const [ name, setName ] = useState('');
    const [ mirror, setMirror ] = useState(false);
    const [ description, setDescription ] = useState('');
    const [ selected, setSelected ] = useLocalStorageState('flip.manoeuvre.track.selected', '');

    function loadFile(f) {
        console.log(`Loading ${f}`);

        f.text().then(data => {
            let points = extractPathFromCsv(csvParse(convertFromGnss(data)));

            if (mirror) {
                points = mirrorPath(points);
            }
            points[points.length - 1].pom = 1;

            onChange(points);
        });
    }

    const save = ev => {
        ev.preventDefault();

        const newTrack = { name, description, track: manoeuvreToSave };

        setTracks([
            ...tracks.filter(t => t.name !== name),
            newTrack
        ]);
    };

    const remove = n => {
        setTracks(tracks.filter(t => t.name !== n));

        if (selected === n) {
            setSelected('');
        }
    };

    const handleSelected = selectedName => {
        setSelected(selectedName);
        const track = tracks.find(t => t.name === selectedName);

        if (track) {
            onChange(track.track);
        }
    };

    return <Stack spacing={3}>
        <Typography variant="h6">My tracks</Typography>
        <FormControl fullWidth sx={{ mt: 2 }}>
            <InputLabel>Select track</InputLabel>
            <Select
                value={selected}
                label="Select track"
                onChange={e => handleSelected(e.target.value)}
                renderValue={value => value || ''}
            >
                {tracks.map(opt => (
                    <MenuItem key={opt.name} value={opt.name}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                            <Tooltip title={opt.description || ''} arrow>
                                <span>{opt.name}</span>
                            </Tooltip>
                            <IconButton
                                size="small"
                                onClick={e => {
                                    e.stopPropagation();
                                    remove(opt.name);
                                }}
                            >
                                <DeleteIcon fontSize="small" />
                            </IconButton>
                        </Box>
                    </MenuItem>
                ))}
            </Select>
        </FormControl>

        <Box mt={4} component="form" onSubmit={save}>
            <TextField
                label="Name"
                value={name}
                onChange={ev => setName(ev.target.value)}
                required
                fullWidth
                sx={{ mb: 2 }}
            />
            <TextField
                label="Description"
                value={description}
                onChange={ev => setDescription(ev.target.value)}
                fullWidth
                sx={{ mb: 2 }}
            />
            <Tooltip
                title="Save the current manoeuvre, with wind correction applied. It will be added to the list above."
            >
                <Button variant="contained" type="submit">Save current manoeuvre</Button>
            </Tooltip>
        </Box>

        <Divider sx={{ mt: 3, mb: 1 }} />
        <Typography variant="h6">Import</Typography>
        <Tooltip title="Import a FlySight file. It has to be trimmed in FlySight Viewer first.">
            <Button
                variant="outlined"
                component="label"
                sx={{ my: 2 }}
            >
                Choose file
                <input type="file" hidden onChange={e => loadFile(e.target.files[0])} />
            </Button>
        </Tooltip>
        <Tooltip title='Change left-hand to right-hand when importing.' key='mirror checkbox' placement="right">
            <FormControlLabel
                control={
                    <Checkbox
                        checked={mirror}
                        onChange={ () => setMirror(!mirror) }
                    />
                }
                label='Mirror'
            />
        </Tooltip>
    </Stack>;
}
