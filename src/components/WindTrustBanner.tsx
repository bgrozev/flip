import {
  Edit as EditIcon,
  Schedule as ScheduleIcon,
  WarningAmber as WarningIcon
} from '@mui/icons-material';
import React from 'react';

import { WindTrust } from '../core/windTrust';

interface WindTrustBannerProps {
  trust: WindTrust;
  /** Selected forecast time, for the "forecast for …" copy. */
  forecastTime?: Date;
}

type Palette = { bg: string; border: string; text: string; icon: string };

const AMBER: Palette = { bg: 'rgba(58,47,18,0.92)', border: '#ef9f27', text: '#fac775', icon: '#efb44f' };

/**
 * Full-width status strip across the top of the map: the one place that
 * says whether the current winds are safe to plan a real jump on. Shown in
 * every mode; hidden when the forecast is fresh and live. Unifies the old
 * flocking "no-wind spot" text and the top-bar "verify conditions" badge.
 */
export default function WindTrustBanner({ trust, forecastTime }: WindTrustBannerProps) {
  if (trust.level === 'fresh') {
    return null;
  }

  let palette: Palette;
  let Icon: typeof WarningIcon;
  let title: string;
  let detail: string;

  switch (trust.reason) {
    case 'empty':
      palette = AMBER;
      Icon = WarningIcon;
      title = 'No forecast loaded';
      detail = 'Planning on zero wind — not jump-real.';
      break;
    case 'manual':
      palette = AMBER;
      Icon = EditIcon;
      title = 'Manual winds';
      detail = 'Hand-entered — not a live forecast. Verify before jumping.';
      break;
    case 'future': {
      palette = AMBER;
      Icon = ScheduleIcon;
      const when = forecastTime
        ? forecastTime.toLocaleString(undefined, {
          weekday: 'short',
          hour: '2-digit',
          minute: '2-digit'
        })
        : 'a future time';
      title = `Forecast for ${when}`;
      detail = 'Not current conditions — verify before jumping.';
      break;
    }
    case 'stale':
    default:
      palette = AMBER;
      Icon = ScheduleIcon;
      title = trust.fetchedMinsAgo !== undefined
        ? `Forecast fetched ${trust.fetchedMinsAgo} min ago`
        : 'Forecast may be stale';
      detail = 'May be out of date — refresh before jumping.';
      break;
  }

  return (
    <div
      role="status"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1100,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 12px',
        background: palette.bg,
        borderBottom: `2px solid ${palette.border}`,
        color: palette.text,
        fontFamily: 'inherit',
        fontSize: 13,
        boxShadow: '0 2px 6px rgba(0,0,0,0.3)'
      }}
    >
      <Icon sx={{ fontSize: 18, color: palette.icon }} />
      <span style={{ fontWeight: 500 }}>{title}</span>
      <span style={{ opacity: 0.85 }}>· {detail}</span>
    </div>
  );
}
