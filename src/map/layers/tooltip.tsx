/**
 * Shared tooltip styling and small display helpers used by map layers.
 */
import React from 'react';

import { formatDistanceFeet } from '../../core/units';

export const TOOLTIP_STYLE: React.CSSProperties = {
  backgroundColor: 'rgba(0, 0, 0, 0.85)',
  color: 'white',
  padding: '8px 12px',
  borderRadius: '6px',
  fontSize: '11px',
  lineHeight: '1.5',
  whiteSpace: 'nowrap',
  pointerEvents: 'none',
  transform: 'translate(-50%, -100%)',
  marginTop: '-12px',
  boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
  minWidth: 'max-content'
};

export const SECTION_STYLE: React.CSSProperties = {
  borderTop: '1px solid rgba(255,255,255,0.2)',
  marginTop: '6px',
  paddingTop: '6px'
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
