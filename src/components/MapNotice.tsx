import React from 'react';

/**
 * A full-width status strip across the top of the map: the place the map
 * itself gets to say something, for the things a user would otherwise have to
 * infer from what is NOT drawn.
 *
 * There are two so far — the wind-trust verdict and flocking's "nothing to
 * solve" — and they stack, so this component owns the look and the caller owns
 * the position.
 */
export interface MapNoticeProps {
  /** Leading icon. Sized and coloured here, so pass the component itself. */
  icon: React.ElementType;
  title: string;
  detail: string;
}

const PALETTE = {
  bg: 'rgba(58,47,18,0.92)',
  border: '#ef9f27',
  text: '#fac775',
  icon: '#efb44f'
} as const;

/** Height of one strip, for callers stacking below it. */
export const MAP_NOTICE_HEIGHT = 36;

export default function MapNotice({ icon: Icon, title, detail }: MapNoticeProps) {
  return (
    <div
      role="status"
      style={{
        display: 'flex',
        // Top, not centre: on a phone the text wraps to two or three lines and
        // a centred icon floats away from the sentence it belongs to.
        alignItems: 'flex-start',
        gap: 8,
        padding: '6px 12px',
        background: PALETTE.bg,
        borderBottom: `2px solid ${PALETTE.border}`,
        color: PALETTE.text,
        fontFamily: 'inherit',
        fontSize: 13,
        boxShadow: '0 2px 6px rgba(0,0,0,0.3)'
      }}
    >
      <Icon style={{ fontSize: 18, color: PALETTE.icon, flexShrink: 0 }} />
      {/* One flowing sentence, not two columns: as flex items the title and
          the detail wrapped independently and left the "·" stranded. */}
      <div>
        <span style={{ fontWeight: 500 }}>{title}</span>
        <span style={{ opacity: 0.85 }}> · {detail}</span>
      </div>
    </div>
  );
}
