/**
 * A one-time nudge that keyboard shortcuts exist.
 *
 * Shown once on the map, dismissed forever the moment it is closed or the
 * shortcuts are opened. Desktop only — on a phone there is no keyboard and
 * this would just be one more thing in the way.
 */
import CloseIcon from '@mui/icons-material/Close';
import KeyboardIcon from '@mui/icons-material/Keyboard';
import { Box, IconButton, Paper, Typography } from '@mui/material';
import { useLocalStorageState } from '@toolpad/core/useLocalStorageState';
import React from 'react';

const STORAGE_KEY = 'flip.ui.shortcutHintSeen';

interface ShortcutHintProps {
  /** False on mobile, or wherever the hint would be noise. */
  show: boolean;
  onOpenShortcuts: () => void;
}

export default function ShortcutHint({ show, onOpenShortcuts }: ShortcutHintProps) {
  // Plain string storage: this is UI ephemera, not a document, and an
  // unreadable value simply means "show it again".
  const [seen, setSeen] = useLocalStorageState<string>(STORAGE_KEY, '');

  if (!show || seen === 'true') {
    return null;
  }

  return (
    <Paper
      elevation={3}
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        px: 1.25,
        py: 0.5,
        gap: 1,
        bgcolor: 'background.paper',
        opacity: 0.95
      }}
    >
      <KeyboardIcon fontSize="small" sx={{ color: 'text.secondary' }} />
      <Typography
        variant="caption"
        sx={{ color: 'text.secondary', cursor: 'pointer' }}
        onClick={() => {
          setSeen('true');
          onOpenShortcuts();
        }}
      >
        Press <KeyCap>?</KeyCap> for shortcuts
      </Typography>
      <IconButton size="small" aria-label="Dismiss shortcut hint" onClick={() => setSeen('true')}>
        <CloseIcon sx={{ fontSize: 14 }} />
      </IconButton>
    </Paper>
  );
}

function KeyCap({ children }: { children: React.ReactNode }) {
  return (
    <Box
      component="kbd"
      sx={{
        fontFamily: 'monospace',
        fontSize: '0.72rem',
        px: 0.6,
        mx: 0.3,
        borderRadius: 0.5,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'action.hover'
      }}
    >
      {children}
    </Box>
  );
}

/** Exported for tests and for anything that wants to re-show the hint. */
export const SHORTCUT_HINT_STORAGE_KEY = STORAGE_KEY;
