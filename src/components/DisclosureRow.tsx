/**
 * A section that can be opened: chevron, label, and whatever it reveals.
 *
 * The Wind panel had two of these within an inch of each other in different
 * costumes — a self-renaming text button ("Show all 29 levels" / "Show
 * summary") and an uppercase disclosure row ("COMPARE SOURCES"). The label
 * is set like a `SectionHeading` because that is what a disclosure is: a
 * section whose contents are folded away. The chevron carries the state, so
 * the label does not have to rename itself.
 */
import { ExpandMore as ExpandMoreIcon } from '@mui/icons-material';
import { CircularProgress, Stack, Typography } from '@mui/material';
import React from 'react';

export interface DisclosureRowProps {
  label: string;
  open: boolean;
  onToggle: () => void;
  /** Show a spinner beside the label (loading what the section will show). */
  busy?: boolean;
}

export default function DisclosureRow({ label, open, onToggle, busy = false }: DisclosureRowProps) {
  return (
    <Stack
      direction="row"
      alignItems="center"
      spacing={0.5}
      onClick={onToggle}
      role="button"
      aria-expanded={open}
      aria-label={label}
      sx={{ cursor: 'pointer', userSelect: 'none', width: 'fit-content', minHeight: 28 }}
    >
      <ExpandMoreIcon
        fontSize="small"
        sx={{
          color: 'text.secondary',
          transform: open ? 'none' : 'rotate(-90deg)',
          transition: 'transform 150ms'
        }}
      />
      <Typography
        variant="caption"
        sx={{
          color: 'text.secondary',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: 0.8
        }}
      >
        {label}
      </Typography>
      {busy && <CircularProgress size={12} />}
    </Stack>
  );
}
