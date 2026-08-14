/**
 * Shared tooltip styling and small display helpers used by map layers.
 */
import React from 'react';

import { formatDistanceFeet } from '../../core/units';

/**
 * Tooltips render over satellite imagery (usually dark) and must stay
 * readable in both app UI themes: near-opaque background, a hairline border
 * so the box separates from dark imagery, and >= 12px full-white body text.
 */
export const TOOLTIP_STYLE: React.CSSProperties = {
  backgroundColor: 'rgba(10, 10, 10, 0.92)',
  color: '#fff',
  padding: '8px 12px',
  border: '1px solid rgba(255, 255, 255, 0.3)',
  borderRadius: '6px',
  fontSize: '12px',
  lineHeight: '1.5',
  whiteSpace: 'nowrap',
  pointerEvents: 'none',
  transform: 'translate(-50%, -100%)',
  marginTop: '-12px',
  boxShadow: '0 2px 10px rgba(0,0,0,0.5)',
  minWidth: 'max-content'
};

export const SECTION_STYLE: React.CSSProperties = {
  borderTop: '1px solid rgba(255,255,255,0.25)',
  marginTop: '6px',
  paddingTop: '6px'
};

/** Secondary text inside a tooltip (e.g. coordinates). */
export const TOOLTIP_SECONDARY_STYLE: React.CSSProperties = {
  fontSize: '11px',
  color: '#bbb'
};

/** Small inline arrow indicating a direction (degrees, "from" convention). */
export function DirectionArrow({ degrees }: { degrees: number }) {
  return (
    <span
      style={{
        display: 'inline-block',
        transform: `rotate(${degrees + 180}deg)`,
        marginLeft: '4px'
      }}
    >
      ↑
    </span>
  );
}

/** Format a distance in feet using the preferred altitude unit ('m' label → meters). */
export function formatDistance(feet: number, altitudeLabel: string): string {
  return formatDistanceFeet(feet, altitudeLabel === 'm' ? 'm' : 'ft');
}
