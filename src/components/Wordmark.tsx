import { Box, ButtonBase, Tooltip } from '@mui/material';
import React, { useId } from 'react';

/**
 * The FliP/FloP wordmark — the mark and the name as one graphic, and the
 * switch between the two halves of the joke the name has always been.
 *
 * FliP is the FLIght Planner; FloP is the FLOcking Planner, promised in the
 * README years before flocking mode existed ("you'll be able to FliP/FloP
 * between the two"). Now that it does, the wordmark IS that switch: clicking
 * it swaps between flocking and whatever non-flocking mode you were last in.
 *
 * The mark is the logo's own artwork, unchanged: an F, and the SAME F turned
 * 180 degrees in the other colour, interlocking to fill the square. That is
 * the joke drawn rather than told — FliP is an F flipped — and it is why the
 * colour swap is the right FloP mark rather than an arbitrary recolour: the
 * two halves are already each other's inversion. (Checked: all 196 cells obey
 * 180-degree rotation with the colours exchanged.)
 *
 * It is redrawn from the pixels as vector so it stays crisp at any size,
 * instead of being a 16x16 base64 PNG scaled to whatever the bar happens to
 * be, and the square corners are rounded. Nothing else about it changes.
 */

/** The pixel logo's two colours (its palette, unchanged). */
const MARK_GREEN = '#14e02c';
const MARK_BLUE = '#0b67d9';

/** The wordmark's lighter counterparts, readable on the dark app bar. */
const TEXT_GREEN = '#4ade80';
const TEXT_BLUE = '#60a5fa';

/**
 * The artwork, transcribed from the original PNG's 14x14 field: `G` is the
 * upright F, `B` the one turned 180 degrees. Read it sideways and the two
 * letterforms are visible — the green stem down the left with its two arms,
 * and the blue one upside down on the right.
 */
export const ART = [
  'GGGGGGBBBBBBBG',
  'GGGGGGBBBBBBBG',
  'GGBBBBBBBBBGGG',
  'GGBBBBBBBBBGBB',
  'GGGGGBBBBGGGBB',
  'GGGGGBBBBGGGBB',
  'GGBBBBBGGGGGBB',
  'GGBBBBBGGGGGBB',
  'GGBBBGGGGBBBBB',
  'GGBBBGGGGBBBBB',
  'GGBGGGGGGGGGBB',
  'BBBGGGGGGGGGBB',
  'BGGGGGGGBBBBBB',
  'BGGGGGGGBBBBBB'
];

const BOX = ART.length;

/** Corner radius, in artwork cells. The one thing the vector version adds. */
const CORNER = 2;

/**
 * The cells of one colour, merged into horizontal runs — a handful of rects
 * over the other colour's background rather than 196 of them.
 */
function runsOf(colour: 'G' | 'B'): [number, number, number][] {
  const runs: [number, number, number][] = [];

  ART.forEach((row, y) => {
    let x = 0;

    while (x < BOX) {
      if (row[x] !== colour) {
        x += 1;
        continue;
      }

      let width = 0;

      while (x + width < BOX && row[x + width] === colour) {
        width += 1;
      }

      runs.push([x, y, width]);
      x += width;
    }
  });

  return runs;
}

const BLUE_RUNS = runsOf('B');

interface FlipMarkProps {
  /** Flocking: the two colours are exchanged, and the mark is FloP's. */
  flocking: boolean;
  size?: number;
}

export function FlipMark({ flocking, size = 26 }: FlipMarkProps) {
  // The clip is referenced by id, and the mark can render more than once.
  const clipId = useId();
  // ONLY the colours change. The cells drawn are always the same ones — swap
  // those as well and the two swaps cancel, leaving a mark that never changes
  // (which is exactly what shipped for a moment: G cells came out green in
  // both states, one as background and one as foreground).
  const base = flocking ? MARK_BLUE : MARK_GREEN;
  const over = flocking ? MARK_GREEN : MARK_BLUE;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${BOX} ${BOX}`}
      aria-hidden="true"
      focusable="false"
      style={{ display: 'block', flexShrink: 0 }}
    >
      <defs>
        <clipPath id={clipId}>
          <rect width={BOX} height={BOX} rx={CORNER} />
        </clipPath>
      </defs>
      {/* The cells are axis-aligned, so snapping them costs no smoothness and
          keeps the letterforms from blurring at bar sizes. */}
      <g clipPath={`url(#${clipId})`} shapeRendering="crispEdges">
        <rect width={BOX} height={BOX} fill={base} />
        {BLUE_RUNS.map(([x, y, width]) => (
          <rect key={`${x},${y}`} x={x} y={y} width={width} height={1} fill={over} />
        ))}
      </g>
    </svg>
  );
}

interface WordmarkProps {
  flocking: boolean;
  /** Switch to the other planner. */
  onToggle: () => void;
}

export default function Wordmark({ flocking, onToggle }: WordmarkProps) {
  const here = flocking ? 'FloP — Flocking Planner' : 'FliP — Flight Planner';
  const there = flocking ? 'FliP — Flight Planner' : 'FloP — Flocking Planner';

  return (
    <Tooltip
      title={
        <>
          {here}
          <br />
          Click for {there}
        </>
      }
    >
      <ButtonBase
        type="button"
        onClick={onToggle}
        aria-label={`Switch to ${there}`}
        sx={{
          gap: 1,
          px: 0.5,
          py: 0.25,
          borderRadius: 1,
          '&:hover': { bgcolor: 'action.hover' }
        }}
      >
        <FlipMark flocking={flocking} />
        <Box
          component="span"
          sx={{
            // On a phone the bar cannot hold the name AND the readings it
            // exists for — whether that is the spot or the wind summary — and
            // the name is the part nobody needs to read. The mark beside it
            // still says which app this is, and still switches.
            display: { xs: 'none', sm: 'block' },
            fontSize: '1.25rem',
            fontWeight: 700,
            lineHeight: 1,
            letterSpacing: '0.5px',
            color: flocking ? TEXT_BLUE : TEXT_GREEN
          }}
        >
          Fl
          <FlippingLetter flocking={flocking} />
          P
        </Box>
      </ButtonBase>
    </Tooltip>
  );
}

/**
 * The one letter that flips, in the colour the mark just gave up.
 *
 * FliP and FloP must be the SAME WIDTH with F, l and P in the same places, so
 * that switching reads as one letter turning over rather than the whole name
 * being re-set. Both letters are therefore laid in one grid cell and the
 * inactive one is merely hidden: the slot is then as wide as the wider of the
 * two in whatever font is actually resolved, with no measured constant to go
 * stale. The narrow `i` gets the difference as air on both sides, which is
 * what makes it look deliberate rather than cramped.
 *
 * `visibility` rather than a swapped child, because the hidden twin still has
 * to occupy the cell; it is inline `style` rather than `sx` so the state is
 * legible to a test without resolving emotion's classes.
 */
function FlippingLetter({ flocking }: { flocking: boolean }) {
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-grid',
        justifyItems: 'center',
        verticalAlign: 'baseline',
        color: flocking ? TEXT_GREEN : TEXT_BLUE
      }}
    >
      <Box
        component="span"
        sx={{ gridArea: '1 / 1' }}
        style={{ visibility: flocking ? 'visible' : 'hidden' }}
        aria-hidden={!flocking}
      >
        o
      </Box>
      <Box
        component="span"
        sx={{ gridArea: '1 / 1' }}
        style={{ visibility: flocking ? 'hidden' : 'visible' }}
        aria-hidden={flocking}
      >
        i
      </Box>
    </Box>
  );
}
