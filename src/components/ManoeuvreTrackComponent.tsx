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
  SelectChangeEvent,
  Stack,
  TextField,
  Tooltip,
  Typography
} from '@mui/material';
import { useLocalStorageState } from '@toolpad/core/useLocalStorageState';
import { csvParse } from 'd3';
import React, { useEffect, useState } from 'react';

import { CsvRow, FlightPath } from '../types';
import { convertFromGnss, extractPathFromCsv } from '../util/csv';
import { mirror as mirrorPath } from '../util/geo';
import { createSimpleCodec } from '../util/storage';

interface Track {
  name: string;
  description: string;
  track: FlightPath;
}

interface ManoeuvreTrackComponentProps {
  manoeuvreToSave: FlightPath;
  selectedTrackName?: string;
  selectedTrackData?: FlightPath;
  onTrackChange: (trackName: string | null, trackData: FlightPath) => void;
}

export default function ManoeuvreTrackComponent({
  manoeuvreToSave,
  selectedTrackName,
  selectedTrackData,
  onTrackChange
}: ManoeuvreTrackComponentProps) {
  const [storedTracks, setTracks] = useLocalStorageState<Track[]>(
    'flip.manoeuvre.track.tracks',
    [],
    { codec: createSimpleCodec<Track[]>([]) }
  );
  const tracks = storedTracks ?? [];
  const [name, setName] = useState('');
  const [mirror, setMirror] = useState(false);
  const [description, setDescription] = useState('');

  // When a preset is loaded with a track that isn't in the library, add it.
  useEffect(() => {
    if (selectedTrackName && selectedTrackData && selectedTrackData.length > 0) {
      const exists = (storedTracks ?? []).some(t => t.name === selectedTrackName);
      if (!exists) {
        setTracks(prev => [
          ...(prev ?? []),
          { name: selectedTrackName, description: 'Restored from preset', track: selectedTrackData }
        ]);
      }
    }
  }, [selectedTrackName, selectedTrackData]); // eslint-disable-line react-hooks/exhaustive-deps

  function loadFile(f: File) {
    f.text().then(data => {
      let points = extractPathFromCsv(csvParse(convertFromGnss(data)) as unknown as CsvRow[]);

      if (mirror) {
        points = mirrorPath(points);
      }
      if (points.length > 0) {
        points[points.length - 1].properties.pom = 1;
      }

      onTrackChange(null, points);
    });
  }

  const save = (ev: React.FormEvent) => {
    ev.preventDefault();

    const newTrack: Track = { name, description, track: manoeuvreToSave };
    setTracks([...tracks.filter(t => t.name !== name), newTrack]);
  };

  const remove = (n: string) => {
    setTracks(tracks.filter(t => t.name !== n));

    if (selectedTrackName === n) {
      onTrackChange(null, []);
    }
  };

  const handleSelected = (selectedName: string) => {
    const track = tracks.find(t => t.name === selectedName);
    if (track) {
      onTrackChange(selectedName, track.track);
    }
  };

  return (
    <Stack spacing={3}>
      <Typography variant="h6">My tracks</Typography>
      <FormControl fullWidth sx={{ mt: 2 }}>
        <InputLabel>Select track</InputLabel>
        <Select
          value={selectedTrackName ?? ''}
          label="Select track"
          onChange={(e: SelectChangeEvent) => handleSelected(e.target.value)}
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
        <Tooltip title="Save the current manoeuvre, with wind correction applied. It will be added to the list above.">
          <Button variant="contained" type="submit">
            Save current manoeuvre
          </Button>
        </Tooltip>
      </Box>

      <Divider sx={{ mt: 3, mb: 1 }} />
      <Typography variant="h6">Import</Typography>
      <Tooltip title="Import a FlySight file. It has to be trimmed in FlySight Viewer first.">
        <Button variant="outlined" component="label" sx={{ my: 2 }}>
          Choose file
          <input
            type="file"
            hidden
            onChange={e => e.target.files && loadFile(e.target.files[0])}
          />
        </Button>
      </Tooltip>
      <Tooltip
        title="Change left-hand to right-hand when importing."
        key="mirror checkbox"
        placement="right"
      >
        <FormControlLabel
          control={<Checkbox checked={mirror} onChange={() => setMirror(!mirror)} />}
          label="Mirror"
        />
      </Tooltip>
    </Stack>
  );
}
