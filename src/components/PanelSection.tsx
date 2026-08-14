/**
 * A section within a panel: one heading style, one rhythm.
 *
 * The panels had grown five ways of saying "here starts a group" — an `h6`,
 * a secondary `body2`, an uppercase caption, an `overline` and an
 * accordion — so the same relationship looked different in every panel, and
 * two of the `h6`s competed with the panel's own title above them. This is
 * the flat one, and it is the default; the accordion (Flocking) is reserved
 * for sections long enough that collapsing them is worth a click.
 *
 * `action` puts a control on the heading row — "New", "Reset" — which is
 * where a section-scoped action belongs, next to what it acts on.
 */
import { Divider, Stack, Typography } from '@mui/material';
import React, { ReactNode } from 'react';

export interface SectionHeadingProps {
  children: ReactNode;
  /** Optional control on the right of the heading row. */
  action?: ReactNode;
}

export function SectionHeading({ children, action }: SectionHeadingProps) {
  return (
    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ minHeight: 28 }}>
      <Typography
        variant="caption"
        sx={{
          color: 'text.secondary',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: 0.8
        }}
      >
        {children}
      </Typography>
      {action}
    </Stack>
  );
}

export interface PanelSectionProps {
  title: string;
  action?: ReactNode;
  /** A rule above the heading, separating this section from the last one. */
  divider?: boolean;
  children: ReactNode;
}

export default function PanelSection({
  title,
  action,
  divider = false,
  children
}: PanelSectionProps) {
  return (
    <>
      {divider && <Divider />}
      <Stack spacing={1}>
        <SectionHeading action={action}>{title}</SectionHeading>
        {children}
      </Stack>
    </>
  );
}
