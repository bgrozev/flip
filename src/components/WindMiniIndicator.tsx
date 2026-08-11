import {
  ExpandLess as ExpandLessIcon,
  ExpandMore as ExpandMoreIcon,
  Refresh as RefreshIcon,
  Terrain as TerrainIcon
} from '@mui/icons-material';
import { CircularProgress } from '@mui/material';
import React from 'react';

import {
  DaSeverity,
  TempSeverity,
  daSeverity,
  temperatureSeverity,
  tryDensityAltitudeFt
} from '../core/atmosphere';
import { groundConditions, sampleWindBands, WindProfile } from '../core/wind';
import { useUnits } from '../hooks';
import { StationDetails } from '../map/layers';
import { ObservedWindStation } from '../types';

import WindArrow from './WindArrow';

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
  /**
   * Show the chip rather than the card, for a reason the user did not choose.
   * The expand chevron withdraws with it, and the stored preference is
   * neither read nor written, so it comes back untouched afterwards.
   *
   * Two reasons, both "the card is not what is wanted here":
   * - A phone with a panel open beside the map: the expanded card is taller
   *   than the strip of map it would cover, and tapping the chip opens the
   *   Wind panel, which is the better answer on a small screen.
   * - The WIND PANEL is open, at any size: the panel's table is this same
   *   summary (both call `sampleWindBands`), so the card would be the same
   *   ten rows twice on one screen. The chip keeps a glanceable ground
   *   reading without repeating the panel.
   */
  compact?: boolean;
  /** Nearest observed station injected as ground wind — shown on GND hover. */
  groundStation?: ObservedWindStation;
  /** Forecast ground wind (when no observed station) — shown on GND hover. */
  forecastGround?: { direction: number; speedKts: number; validTime?: Date };
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

/** Density-altitude severity tint, sharing the Beaufort ramp's high end. */
const DA_SEVERITY_COLOR: Record<DaSeverity, string> = {
  normal: TEXT_COLOR,
  caution: '#ffcc44',
  warning: '#ff4400'
};

/** Temperature severity tint: blue when very cold, amber/red climbing hot. */
const TEMP_SEVERITY_COLOR: Record<TempSeverity, string> = {
  cold: '#5ac8ff',
  normal: TEXT_COLOR,
  hot: '#ffcc44',
  veryHot: '#ff4400'
};

/** Ground-wind detail popover, anchored to the left of the indicator. */
const GROUND_TOOLTIP_STYLE: React.CSSProperties = {
  position: 'absolute',
  right: 'calc(100% + 8px)',
  top: 0,
  width: 200,
  background: 'rgba(16, 20, 16, 0.95)',
  color: 'white',
  border: '1px solid rgba(255,255,255,0.15)',
  borderRadius: 8,
  padding: '8px 10px',
  fontSize: 12,
  lineHeight: 1.35,
  textAlign: 'left',
  whiteSpace: 'normal',
  boxShadow: '0 2px 10px rgba(0,0,0,0.5)',
  cursor: 'default',
  pointerEvents: 'auto',
  zIndex: 1001
};

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
  topOffset = 10,
  groundStation,
  forecastGround,
  compact = false
}: WindMiniIndicatorProps) {
  const { formatWindSpeed, windSpeedLabel, formatAltitude, altitudeLabel, formatTemperature } = useUnits();
  const [storedCollapsed, setCollapsed] = useCollapsed();
  const collapsed = compact || storedCollapsed;
  const [groundHover, setGroundHover] = React.useState(false);
  const groundHideTimer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  if (!winds.winds || winds.winds.length === 0) {
    return null;
  }

  const ground = winds.winds[0];

  const { tempC, humidityPct, elevationFt } = groundConditions(winds);
  const densityAltFt = tryDensityAltitudeFt(elevationFt, tempC, humidityPct);
  const densitySeverity = daSeverity(densityAltFt, elevationFt);
  const tempSeverity = temperatureSeverity(tempC);
  const daTitle = 'Density altitude: how the air performs, correcting field elevation for '
    + 'temperature and humidity.'
    + (elevationFt !== undefined
      ? ` Elevation ${Math.round(formatAltitude(elevationFt).value)} ${altitudeLabel}.`
      : '');

  // Ground + the plan bands within the profile. Shared with the Wind
  // panel's collapsed table (core/wind), so the two summaries cannot drift.
  const rows: Row[] = sampleWindBands(winds, altitudesFt, interpolate).map(band => ({
    label: band.ground ? 'GND' : String(formatAltitude(band.altFt).value),
    direction: band.direction,
    speedKts: band.speedKts
  }));

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

  const showGround = () => {
    if (groundHideTimer.current) {
      clearTimeout(groundHideTimer.current);
    }
    setGroundHover(true);
  };
  const hideGround = () => {
    if (groundHideTimer.current) {
      clearTimeout(groundHideTimer.current);
    }
    groundHideTimer.current = setTimeout(() => setGroundHover(false), 150);
  };

  const groundInfo = groundStation ?? forecastGround;
  const groundTooltip = groundHover && groundInfo ? (
    <div style={GROUND_TOOLTIP_STYLE} onMouseEnter={showGround} onMouseLeave={hideGround}>
      {groundStation ? (
        <StationDetails station={groundStation} />
      ) : forecastGround ? (
        <>
          <div style={{ fontWeight: 'bold', marginBottom: 2 }}>Forecast ground wind</div>
          <div>
            {Math.round(forecastGround.direction) % 360}° at {fmtSpeed(forecastGround.speedKts)} {windSpeedLabel}
          </div>
          {forecastGround.validTime && (
            <div style={{ color: '#aaa', fontSize: 11, marginTop: 2 }}>
              Valid {forecastGround.validTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          )}
        </>
      ) : null}
    </div>
  ) : null;

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
        onMouseEnter={showGround}
        onMouseLeave={hideGround}
        role="button"
        tabIndex={0}
        aria-label="Winds; open the wind panel"
      >
        <WindArrow direction={ground.direction} speedKts={ground.speedKts} degreesTooltip />
        <span style={{ whiteSpace: 'nowrap' }}>{fmtSpeed(ground.speedKts)}</span>
        {!compact && (
          <ExpandMoreIcon onClick={toggle} sx={{ ...chevron }} aria-label="Expand winds" />
        )}
        {groundTooltip}
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
          fontSize: 13,
          marginBottom: 6
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <span
            style={{
              color: tempC !== undefined ? TEMP_SEVERITY_COLOR[tempSeverity] : LABEL_COLOR,
              fontWeight: tempSeverity !== 'normal' && tempC !== undefined ? 700 : 400,
              whiteSpace: 'nowrap'
            }}
            title="Ground temperature"
          >
            {tempC !== undefined
              ? `${formatTemperature(tempC).value.toFixed(0)}${formatTemperature(tempC).label}`
              : '—°'}
          </span>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 2,
              color: DA_SEVERITY_COLOR[densitySeverity],
              fontWeight: densitySeverity !== 'normal' ? 700 : 400,
              whiteSpace: 'nowrap'
            }}
            title={daTitle}
          >
            <TerrainIcon sx={{ fontSize: 14 }} />
            {densityAltFt !== undefined
              ? `${Math.round(formatAltitude(densityAltFt).value)} ${altitudeLabel}`
              : '—'}
          </span>
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: LABEL_COLOR, fontSize: 11 }}>
          {forecastLabel && <span>{forecastLabel}</span>}
          {fetching ? (
            <CircularProgress size={13} sx={{ color: LABEL_COLOR }} />
          ) : (
            <RefreshIcon onClick={refresh} sx={{ fontSize: 15, ...ICON_BTN }} aria-label="Refresh winds" />
          )}
          <ExpandLessIcon onClick={toggle} sx={{ ...chevron }} aria-label="Collapse winds" />
        </span>
      </div>
      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr>
            <td style={{ padding: '0 8px 3px 0', color: LABEL_COLOR, fontSize: 10, whiteSpace: 'nowrap' }}>
              {altitudeLabel}
            </td>
            <td style={{ padding: '0 6px 3px' }} />
            <td style={{ padding: '0 0 3px 8px', textAlign: 'right', color: LABEL_COLOR, fontSize: 10, whiteSpace: 'nowrap' }}>
              {windSpeedLabel}
            </td>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => {
            const isGround = row.label === 'GND';
            return (
              <tr
                key={row.label}
                onMouseEnter={isGround ? showGround : undefined}
                onMouseLeave={isGround ? hideGround : undefined}
                style={isGround && groundInfo ? { cursor: 'help' } : undefined}
              >
                <td style={{ padding: '1px 8px 1px 0', color: LABEL_COLOR, whiteSpace: 'nowrap' }}>
                  {row.label}
                </td>
                <td style={{ padding: '1px 6px', lineHeight: 1 }}>
                  <WindArrow direction={row.direction} speedKts={row.speedKts} size={14} degreesTooltip />
                </td>
                <td style={{ padding: '1px 0 1px 8px', textAlign: 'right' }}>
                  {fmtSpeed(row.speedKts)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {groundTooltip}
    </div>
  );
}
