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

import { SHORTCUT_CATEGORY_LABELS, Shortcut, groupShortcuts } from '../core/keymap';

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
  const groups = groupShortcuts(shortcuts);

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
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
            columnGap: 4,
            rowGap: 2,
            alignItems: 'start'
          }}
        >
          {groups.map(([category, entries]) => (
            <Box key={category}>
              <Typography
                variant="caption"
                sx={{ color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.06em' }}
              >
                {SHORTCUT_CATEGORY_LABELS[category]}
              </Typography>
              {entries.map(entry => (
                <ShortcutRow key={entry.id} shortcut={entry} />
              ))}
            </Box>
          ))}
        </Box>

        <Typography variant="caption" sx={{ display: 'block', mt: 2, color: 'text.secondary' }}>
          Shows only what this mode can do. Keys are ignored while you are typing in a field.
        </Typography>
      </DialogContent>
    </Dialog>
  );
}

function ShortcutRow({ shortcut }: { shortcut: Shortcut }) {
  return (
    <Stack
      direction="row"
      spacing={1}
      alignItems="center"
      sx={{ py: 0.5, borderBottom: '1px solid', borderColor: 'divider' }}
    >
      <Typography variant="body2" sx={{ flex: 1 }}>{shortcut.label}</Typography>
      {shortcut.gestureText ? (
        <Typography variant="caption" sx={{ color: 'text.secondary', whiteSpace: 'nowrap' }}>
          {shortcut.gestureText}
        </Typography>
      ) : (
        <Stack direction="row" spacing={0.5}>
          {shortcut.keys.map(key => <KeyCap key={key} combo={key} />)}
        </Stack>
      )}
    </Stack>
  );
}

/** Human-readable key names; the table stores them normalized for matching. */
const KEY_LABELS: Record<string, string> = {
  arrowleft: '←',
  arrowright: '→',
  arrowup: '↑',
  arrowdown: '↓',
  escape: 'Esc'
};

export function keyCapLabel(combo: string): string {
  const shifted = combo.startsWith('shift+');
  const base = shifted ? combo.slice('shift+'.length) : combo;
  const label = KEY_LABELS[base] ?? (base.length === 1 ? base.toUpperCase() : base);

  return shifted ? `⇧${label}` : label;
}

function KeyCap({ combo }: { combo: string }) {
  return (
    <Box
      component="kbd"
      sx={{
        fontFamily: 'monospace',
        fontSize: '0.72rem',
        lineHeight: 1.6,
        px: 0.75,
        borderRadius: 0.5,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'action.hover',
        color: 'text.primary',
        minWidth: 20,
        textAlign: 'center'
      }}
    >
      {keyCapLabel(combo)}
    </Box>
  );
}
