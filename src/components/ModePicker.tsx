import {
  Card,
  CardActionArea,
  CardContent,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  Stack,
  Typography
} from '@mui/material';
import React from 'react';

import { MODES, ModeId } from '../modes';

interface ModePickerProps {
  open: boolean;
  onSelect: (id: ModeId) => void;
}

/**
 * First-run mode picker: "What are you planning?" with one card per mode.
 * Disabled (stub) modes are shown greyed out as coming soon.
 */
export default function ModePicker({ open, onSelect }: ModePickerProps) {
  return (
    <Dialog open={open} fullWidth maxWidth="xs">
      <DialogTitle>What are you planning?</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {MODES.map(mode => (
            <Card key={mode.id} variant="outlined" sx={mode.enabled ? undefined : { opacity: 0.5 }}>
              <CardActionArea
                disabled={!mode.enabled}
                onClick={() => onSelect(mode.id)}
                // The card's text is laid out as separate nodes, so without
                // this the button has no accessible name.
                aria-label={mode.enabled
                  ? `${mode.label}: ${mode.description}`
                  : `${mode.label} (coming soon): ${mode.description}`}
              >
                <CardContent>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="h6">{mode.label}</Typography>
                    {!mode.enabled && <Chip label="coming soon" size="small" />}
                  </Stack>
                  <Typography variant="body2" color="text.secondary">
                    {mode.description}
                  </Typography>
                </CardContent>
              </CardActionArea>
            </Card>
          ))}
        </Stack>
      </DialogContent>
    </Dialog>
  );
}
