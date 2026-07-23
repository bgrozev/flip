import {
  ExpandLess as ExpandLessIcon,
  ExpandMore as ExpandMoreIcon,
  Navigation as NavigationIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { CircularProgress } from '@mui/material';
import React from 'react';

import { beaufortColor, getWindAt, WindProfile } from '../core/wind';
import { useUnits } from '../hooks';

interface WindMiniIndicatorProps {
  /** The effective wind profile (aloft + any observed ground). */
  winds: WindProfile;
  /** Plan-relevant altitudes to show, in feet AGL (besides ground). */
  altitudesFt: number[];
  /** Whether to interpolate between wind rows. */
  interpolate: boolean;
  /** Forecast valid time, shown in the header when present. */
  forecastTime?: Date;
  /** Open the full Wind panel (tap on the card). */
  onOpen: () => void;
  /** Re-fetch the winds (header refresh button). */
  onRefresh: () => void;
  /** Whether a wind fetch is in progress. */
  fetching: boolean;
  /** Distance from the top of the map, in px (raised when a banner shows). */
  topOffset?: number;
}

interface Row {
  label: string;
  direction: number;
  speedKts: number;
}

const ICON_BTN = {
  color: '#9fb39a',
  cursor: 'pointer'
} as const;

const PANEL_BG = 'rgba(20, 28, 20, 0.82)';
const LABEL_COLOR = '#9fb39a';
const TEXT_COLOR = '#e8efe6';
const COLLAPSED_KEY = 'flip.ui.windIndicatorCollapsed';

/** Collapse state, persisted as an explicit 'true'/'false' string. */
function useCollapsed(): [boolean, (v: boolean) => void] {
  const [collapsed, setCollapsed] = React.useState<boolean>(() => {
    try {
      return localStorage.getItem(COLLAPSED_KEY) === 'true';
    } catch {
      return false;
    }
  });
  const set = React.useCallback((v: boolean) => {
    setCollapsed(v);
    try {
      localStorage.setItem(COLLAPSED_KEY, String(v));
    } catch {
      // ignore storage failures (private mode, quota)
    }
  }, []);
  return [collapsed, set];
}

/** A small downwind-pointing arrow coloured by Beaufort speed. */
function WindArrow({ direction, speedKts, size = 15 }: { direction: number; speedKts: number; size?: number }) {
  return (
    <NavigationIcon
      sx={{
        fontSize: size,
        color: beaufortColor(speedKts),
        transform: `rotate(${180 + direction}deg)`,
        verticalAlign: 'middle'
      }}
    />
  );
}

/**
 * Compact winds-by-altitude readout for the map corner. Visible in every
 * mode so the winds can be referenced without opening the Wind panel.
 * Expanded: a column of ground + plan-relevant bands. Collapsed: a single
 * ground-wind chip. Tapping the body opens the full Wind panel.
 */
export default function WindMiniIndicator({
  winds,
  altitudesFt,
  interpolate,
  forecastTime,
  onOpen,
  onRefresh,
  fetching,
  topOffset = 10
}: WindMiniIndicatorProps) {
  const { formatWindSpeed, windSpeedLabel, formatAltitude, altitudeLabel } = useUnits();
  const [collapsed, setCollapsed] = useCollapsed();

  if (!winds.winds || winds.winds.length === 0) {
    return null;
  }

  const ground = winds.winds[0];
  const maxAltFt = winds.winds[winds.winds.length - 1].altFt;

  // Ground + the plan bands within the profile, de-duplicated and ascending.
  const seen = new Set<number>([Math.round(ground.altFt)]);
  const rows: Row[] = [
    { label: 'GND', direction: ground.direction, speedKts: ground.speedKts }
  ];
  altitudesFt
    .filter(a => a > ground.altFt + 1 && a <= maxAltFt + 1)
    .map(a => Math.round(a))
    .sort((x, y) => x - y)
    .forEach(altFt => {
      if (seen.has(altFt)) {
        return;
      }
      seen.add(altFt);
      const w = getWindAt(winds, altFt, interpolate);
      rows.push({
        label: String(formatAltitude(altFt).value),
        direction: w.direction,
        speedKts: w.speedKts
      });
    });

  const forecastLabel = forecastTime
    ? forecastTime.toLocaleString(undefined, { hour: '2-digit', minute: '2-digit' })
    : '';

  const chevron = {
    fontSize: 18,
    color: LABEL_COLOR,
    cursor: 'pointer'
  } as const;

  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCollapsed(!collapsed);
  };

  const refresh = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!fetching) {
      onRefresh();
    }
  };

  const fmtSpeed = (kts: number) => formatWindSpeed(kts).value.toFixed(0);

  if (collapsed) {
    return (
      <div
        style={{
          position: 'absolute',
          top: topOffset,
          right: 10,
          zIndex: 1000,
          background: PANEL_BG,
          borderRadius: 18,
          padding: '5px 8px 5px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          color: TEXT_COLOR,
          fontSize: 13,
          fontFamily: 'inherit',
          cursor: 'pointer',
          boxShadow: '0 2px 6px rgba(0,0,0,0.3)'
        }}
        onClick={onOpen}
        role="button"
        tabIndex={0}
        aria-label="Winds; open the wind panel"
      >
        <WindArrow direction={ground.direction} speedKts={ground.speedKts} />
        <span style={{ whiteSpace: 'nowrap' }}>{fmtSpeed(ground.speedKts)}</span>
        <ExpandMoreIcon onClick={toggle} sx={{ ...chevron }} aria-label="Expand winds" />
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'absolute',
        top: topOffset,
        right: 10,
        zIndex: 1000,
        background: PANEL_BG,
        borderRadius: 10,
        padding: '8px 10px',
        color: TEXT_COLOR,
        fontSize: 13,
        fontFamily: 'inherit',
        cursor: 'pointer',
        minWidth: 128,
        boxShadow: '0 2px 6px rgba(0,0,0,0.3)'
      }}
      onClick={onOpen}
      role="button"
      tabIndex={0}
      aria-label="Winds by altitude; open the wind panel"
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 10,
          color: LABEL_COLOR,
          fontSize: 11,
          letterSpacing: '0.04em',
          marginBottom: 5
        }}
      >
        <span>WINDS · {altitudeLabel} · {windSpeedLabel}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {forecastLabel && <span>{forecastLabel}</span>}
          {fetching ? (
            <CircularProgress size={13} sx={{ color: LABEL_COLOR }} />
          ) : (
            <RefreshIcon onClick={refresh} sx={{ fontSize: 15, ...ICON_BTN }} aria-label="Refresh winds" />
          )}
          <ExpandLessIcon onClick={toggle} sx={{ ...chevron }} aria-label="Collapse winds" />
        </span>
      </div>
      <table style={{ borderCollapse: 'collapse' }}>
        <tbody>
          {rows.map(row => (
            <tr key={row.label}>
              <td style={{ padding: '1px 8px 1px 0', color: LABEL_COLOR, whiteSpace: 'nowrap' }}>
                {row.label}
              </td>
              <td style={{ padding: '1px 6px', lineHeight: 1 }}>
                <WindArrow direction={row.direction} speedKts={row.speedKts} size={14} />
              </td>
              <td style={{ padding: '1px 0 1px 8px', textAlign: 'right' }}>
                {fmtSpeed(row.speedKts)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
