/**
 * The grouped shortcut list.
 *
 * Shared by the `?` overlay and the Help panel's shortcuts topic, so the
 * keys are rendered from `core/keymap` in exactly one place — a second
 * hand-maintained copy is precisely what this design is avoiding.
 */
import { Box, Stack, Typography } from '@mui/material';
import React from 'react';

import { SHORTCUT_CATEGORY_LABELS, Shortcut, groupShortcuts } from '../core/keymap';

interface ShortcutListProps {
  /** Already filtered to the active mode. */
  shortcuts: readonly Shortcut[];
  /** Two columns where there is room; one in a narrow panel. */
  columns?: 1 | 2;
}

export default function ShortcutList({ shortcuts, columns = 1 }: ShortcutListProps) {
  const groups = groupShortcuts(shortcuts);

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: columns === 2 ? { xs: '1fr', sm: '1fr 1fr' } : '1fr',
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
