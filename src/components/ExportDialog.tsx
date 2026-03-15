import { Download as DownloadIcon } from '@mui/icons-material';
import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography
} from '@mui/material';
import React, { useEffect, useState } from 'react';

import { FlightPath, LatLng } from '../types';
import { downloadFlySight2CSV, fetchGroundElevation } from '../util/exportFlySight';

interface ExportDialogProps {
  open: boolean;
  onClose: () => void;
  path: FlightPath;
  target: LatLng;
  presetName: string;
}

function toDatetimeLocal(d: Date): string {
  // Format for datetime-local input: "YYYY-MM-DDTHH:MM"
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDateTime(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

export default function ExportDialog({ open, onClose, path, target, presetName }: ExportDialogProps) {
  const [elevStr, setElevStr] = useState('');
  const [fetchingElev, setFetchingElev] = useState(false);
  const [elevError, setElevError] = useState('');
  const [startTimeStr, setStartTimeStr] = useState('');

  useEffect(() => {
    if (!open) return;
    setStartTimeStr(toDatetimeLocal(new Date()));
    setElevStr('');
    setElevError('');
    // Auto-fetch elevation when dialog opens
    setFetchingElev(true);
    fetchGroundElevation(target.lat, target.lng)
      .then(e => setElevStr(e.toFixed(1)))
      .catch(() => setElevError('Failed to fetch — enter manually'))
      .finally(() => setFetchingElev(false));
  }, [open, target.lat, target.lng]);

  const handleExport = () => {
    const groundElevM = parseFloat(elevStr);
    if (isNaN(groundElevM)) return;
    const startTime = new Date(startTimeStr);
    if (isNaN(startTime.getTime())) return;
    const safe = presetName.replace(/[^a-zA-Z0-9_-]/g, '_') || 'unnamed';
    const filename = `flip-${formatDateTime(startTime)}-${safe}.csv`;
    downloadFlySight2CSV(path, groundElevM, startTime, filename);
    onClose();
  };

  const canExport = !fetchingElev && !isNaN(parseFloat(elevStr)) && startTimeStr !== '' && path.length >= 2;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Export FlySight 2</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <TextField
              label="Ground elevation (m MSL)"
              size="small"
              fullWidth
              value={elevStr}
              onChange={e => { setElevStr(e.target.value); setElevError(''); }}
              error={!!elevError}
              helperText={elevError || ' '}
              disabled={fetchingElev}
            />
            {fetchingElev && <CircularProgress size={20} sx={{ flexShrink: 0 }} />}
          </Stack>
          <TextField
            label="Start time (local)"
            size="small"
            type="datetime-local"
            value={startTimeStr}
            onChange={e => setStartTimeStr(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
          {path.length < 2 && (
            <Typography variant="caption" color="error">
              No path to export — set up a pattern and manoeuvre first.
            </Typography>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          startIcon={<DownloadIcon />}
          onClick={handleExport}
          disabled={!canExport}
        >
          Download
        </Button>
      </DialogActions>
    </Dialog>
  );
}
