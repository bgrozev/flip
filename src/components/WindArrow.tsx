import { Navigation as NavigationIcon } from '@mui/icons-material';
import React from 'react';

import { beaufortColor } from '../core/wind';

/**
 * A small downwind-pointing arrow, coloured by Beaufort speed.
 *
 * The one wind glyph: the map's winds indicator and the Wind panel's table are
 * the same profile at two sizes, so they may not draw it differently — a
 * reader who learns the arrow on the map has learned the panel too.
 *
 * It points where the wind is GOING (`180 + direction`), which is why the
 * degrees it is labelled with are not the angle it is drawn at: wind is named
 * by where it comes FROM.
 */
export default function WindArrow({
  direction,
  speedKts,
  size = 15,
  degreesTooltip = false
}: {
  direction: number;
  speedKts: number;
  size?: number;
  /**
   * Name the direction in degrees on hover. For surfaces where the arrow is
   * the ONLY direction cue — the map indicator. The panel's table prints the
   * number beside it, so a tooltip there would only repeat what is on screen.
   */
  degreesTooltip?: boolean;
}) {
  return (
    <NavigationIcon
      // Renders an SVG <title>: a native tooltip, and the arrow's accessible
      // name, so the direction is available without hovering too.
      titleAccess={degreesTooltip ? `${Math.round(direction)}°` : undefined}
      sx={{
        fontSize: size,
        color: beaufortColor(speedKts),
        transform: `rotate(${180 + direction}deg)`,
        verticalAlign: 'middle'
      }}
    />
  );
}
