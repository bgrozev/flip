/**
 * How a label looks on the map.
 *
 * The layers had grown thirteen bespoke style objects between them, over
 * nine different backgrounds — `rgba(0,0,0,0.65)`, `0.72`, `0.75`, `0.85`,
 * `rgba(10,10,10,0.85)`, plain `black` — three border radii and five font
 * sizes, for what is one thing: a small dark plate holding text over
 * satellite imagery. Anything drawn on the map goes through here, so a
 * label can differ from its neighbours in *size* and *colour*, which mean
 * something, and in nothing else.
 */
import React from 'react';

/** One background, dark enough to read white text over any imagery. */
const LABEL_BACKGROUND = 'rgba(0, 0, 0, 0.78)';

/**
 * Three sizes, and they rank: `sm` annotates (a distance marker on the
 * jumprun), `md` is the default (an altitude, a name), `lg` is an answer
 * the user came to the map for.
 */
export const LABEL_FONT_SIZE = {
  sm: '11px',
  md: '13px',
  lg: '15px'
} as const;

export type LabelSize = keyof typeof LABEL_FONT_SIZE;

export interface MapLabelOptions {
  size?: LabelSize;
  /** Text colour; the default is white. A colour should mean something. */
  color?: string;
  /** Hairline border, for a label that has to separate from its own line. */
  border?: string;
  /** Fully rounded, for the one label that is the map's headline. */
  pill?: boolean;
  bold?: boolean;
  /** Where the plate sits relative to its anchor point. */
  transform?: string;
}

/**
 * A label plate. Spread it into a `style`, and add only what is genuinely
 * particular to the one label (an offset, a shadow it cannot live without).
 */
export function mapLabel({
  size = 'md',
  color = '#fff',
  border,
  pill = false,
  bold = false,
  transform
}: MapLabelOptions = {}): React.CSSProperties {
  return {
    background: LABEL_BACKGROUND,
    color,
    padding: size === 'sm' ? '1px 5px' : size === 'lg' ? '6px 10px' : '3px 7px',
    borderRadius: pill ? '14px' : '4px',
    fontSize: LABEL_FONT_SIZE[size],
    ...bold ? { fontWeight: 'bold' as const } : {},
    ...border ? { border: `1px solid ${border}` } : {},
    display: 'inline-block',
    whiteSpace: 'nowrap',
    ...transform ? { transform } : {}
  };
}
