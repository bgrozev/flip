import {
  Edit as EditIcon,
  Schedule as ScheduleIcon,
  WarningAmber as WarningIcon
} from '@mui/icons-material';
import React from 'react';

import { WindTrust } from '../core/windTrust';

import MapNotice from './MapNotice';

interface WindTrustBannerProps {
  trust: WindTrust;
  /** Selected forecast time, for the "forecast for …" copy. */
  forecastTime?: Date;
}

/**
 * The one place that says whether the current winds are safe to plan a real
 * jump on. Shown in every mode; hidden when the forecast is fresh and live.
 * Unifies the old flocking "no-wind spot" text and the top-bar "verify
 * conditions" badge. Drawn as a `MapNotice`, which owns the look.
 */
export default function WindTrustBanner({ trust, forecastTime }: WindTrustBannerProps) {
  if (trust.level === 'fresh') {
    return null;
  }

  switch (trust.reason) {
    case 'empty':
      return (
        <MapNotice
          icon={WarningIcon}
          title="No forecast loaded"
          detail="Planning on zero wind — not jump-real."
        />
      );
    case 'manual':
      return (
        <MapNotice
          icon={EditIcon}
          title="Manual winds"
          detail="Hand-entered — not a live forecast. Verify before jumping."
        />
      );
    case 'future': {
      const when = forecastTime
        ? forecastTime.toLocaleString(undefined, {
          weekday: 'short',
          hour: '2-digit',
          minute: '2-digit'
        })
        : 'a future time';

      return (
        <MapNotice
          icon={ScheduleIcon}
          title={`Forecast for ${when}`}
          detail="Not current conditions — verify before jumping."
        />
      );
    }
    case 'stale':
    default:
      return (
        <MapNotice
          icon={ScheduleIcon}
          title={trust.fetchedMinsAgo !== undefined
            ? `Forecast fetched ${trust.fetchedMinsAgo} min ago`
            : 'Forecast may be stale'}
          detail="May be out of date — refresh before jumping."
        />
      );
  }
}
