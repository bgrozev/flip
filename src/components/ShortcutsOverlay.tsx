/**
 * The `?` overlay: what you can do right now, from one table.
 *
 * Everything shown is derived from `core/keymap` filtered to the active
 * mode, so this list cannot claim a key that isn't bound (or miss one that
 * is). Mouse gestures appear alongside the keys — "how do I move the
 * target" is the question people actually arrive with.
 */
import KeyboardIcon from '@mui/icons-material/Keyboard';
import {
  Box,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Typography
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import React from 'react';

import { Shortcut } from '../core/keymap';

import ShortcutList from './ShortcutList';

interface ShortcutsOverlayProps {
  open: boolean;
  onClose: () => void;
  /** Already filtered to the active mode. */
  shortcuts: readonly Shortcut[];
  /** Mode label, so it is obvious the list is mode-specific. */
  modeLabel: string;
}

export default function ShortcutsOverlay({
  open, onClose, shortcuts, modeLabel
}: ShortcutsOverlayProps) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth scroll="paper">
      <DialogTitle sx={{ pb: 1 }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <KeyboardIcon fontSize="small" sx={{ color: 'text.secondary' }} />
          <Typography variant="h6" component="span" sx={{ fontSize: '1rem' }}>
            Keyboard shortcuts
          </Typography>
          <Chip label={modeLabel} size="small" color="primary" variant="outlined" />
          <Box sx={{ flex: 1 }} />
          <IconButton size="small" onClick={onClose} aria-label="Close shortcuts">
            <CloseIcon fontSize="small" />
          </IconButton>
        </Stack>
      </DialogTitle>

      <DialogContent dividers>
        <ShortcutList shortcuts={shortcuts} columns={2} />

        <Typography variant="caption" sx={{ display: 'block', mt: 2, color: 'text.secondary' }}>
          Shows only what this mode can do. Keys are ignored while you are typing in a field.
        </Typography>
      </DialogContent>
    </Dialog>
  );
}
