import {
  Alert,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography
} from '@mui/material';
import React, { useEffect, useMemo, useState } from 'react';

import { DEFAULT_MANOEUVRE_PARAMS } from '../core/model';
import { manoeuvreBounds, solveManoeuvre } from '../core/manoeuvre';
import { useUnits } from '../hooks';
import { ManoeuvreParams } from '../types';
import { LIMITS, NumericLimits, clampNumber } from '../core/validation';

import DirectionSwitch from './DirectionSwitch';
import NumberField from './NumberField';

// Canonical definition lives in core/model; re-exported for existing users
export { DEFAULT_MANOEUVRE_PARAMS };

/** The turns people actually fly; anything else goes in Custom. */
const ROTATION_PRESETS = [90, 135, 270, 450];

interface ManoeuvreParametersComponentProps {
  params: ManoeuvreParams;
  onParamsChange: (params: ManoeuvreParams) => void;
}

export default function ManoeuvreParametersComponent({
  params,
  onParamsChange
}: ManoeuvreParametersComponentProps) {
  const { formatAltitude, parseAltitude, altitudeLabel } = useUnits();

  const change = <K extends keyof ManoeuvreParams>(key: K, value: ManoeuvreParams[K]) => {
    onParamsChange({ ...params, [key]: value });
  };

  /**
   * Changing the rotation moves the goalposts: a depth a 270 was happy with
   * may be one a 90 cannot start from. Pull both into the new turn's range
   * rather than leaving numbers the map has to disagree with.
   */
  const changeRotation = (rotationDeg: number) => {
    const next = { ...params, rotationDeg };
    const allowed = manoeuvreBounds(next);

    onParamsChange({
      ...next,
      depthFt: clampNumber(next.depthFt, allowed.depthFt.min, allowed.depthFt.max),
      offsetFt: clampNumber(next.offsetFt, allowed.offsetFt.min, allowed.offsetFt.max)
    });
  };

  // Length limits are stored in feet but entered in the display unit.
  const lengthLimits = (limits: NumericLimits): NumericLimits => ({
    min: Math.round(formatAltitude(limits.min).value),
    max: Math.round(formatAltitude(limits.max).value)
  });

  const { reaches } = solveManoeuvre(params);
  // What the geometry actually allows, given everything else. Recomputed
  // only when the turn changes: each bound is found by bisection.
  const bounds = useMemo(() => manoeuvreBounds(params), [params]);
  const toDisplay = (feet: number) => Math.round(formatAltitude(feet).value);
  // Only worth saying when it is tighter than the field's own range.
  const boundNote = (limits: NumericLimits, stored: NumericLimits) => {
    const parts: string[] = [];

    if (limits.min > stored.min) {
      parts.push(`min ${toDisplay(limits.min)}`);
    }
    if (limits.max < stored.max) {
      parts.push(`max ${toDisplay(limits.max)}`);
    }

    return parts.length > 0 ? `${parts.join(', ')} ${altitudeLabel} for a ${params.rotationDeg}° turn` : undefined;
  };
  const isPreset = ROTATION_PRESETS.includes(params.rotationDeg);
  const [rotationCustom, setRotationCustom] = useState(!isPreset);

  // "The user asked for Custom" must not outlive the rotation it describes: a
  // setup load or a preset restore can put a 450 in from outside, and the flag
  // alone left the panel showing the custom field with no preset lit. Same
  // rule (and same effect) as the pattern panel's leg-altitude selector.
  useEffect(() => {
    if (isPreset) {
      setRotationCustom(false);
    }
  }, [params.rotationDeg]); // eslint-disable-line react-hooks/exhaustive-deps

  const showCustomRotation = rotationCustom || !isPreset;

  return (
    <Stack direction="column" spacing={2}>
      {/* Which way you rotate. The offset is measured on the side you turn
          from, so flipping this mirrors the whole turn. */}
      <DirectionSwitch
        title="Which way you turn onto final. A left-hand 270 rotates left through 270°."
        value={params.turnDirection === 'right'}
        onChange={right => change('turnDirection', right ? 'right' : 'left')}
      />

      <Tooltip title="How far you rotate onto final. The heading you start on follows from this: a 270 to the left starts 270° to the right of your final heading.">
        <ToggleButtonGroup
          value={showCustomRotation ? 'custom' : String(params.rotationDeg)}
          exclusive
          fullWidth
          size="small"
          onChange={(_event, value: string | null) => {
            if (!value) {
              return;
            }
            if (value === 'custom') {
              setRotationCustom(true);

              return;
            }
            setRotationCustom(false);
            changeRotation(Number(value));
          }}
        >
          {ROTATION_PRESETS.map(deg => (
            <ToggleButton key={deg} value={String(deg)}>{deg}°</ToggleButton>
          ))}
          <ToggleButton value="custom">Custom</ToggleButton>
        </ToggleButtonGroup>
      </Tooltip>

      {showCustomRotation && (
        <NumberField
          label="Rotation"
          title="Total degrees rotated onto final."
          value={params.rotationDeg}
          unit="°"
          step={5}
          limits={LIMITS.manoeuvreRotationDeg}
          onChange={changeRotation}
        />
      )}

      {/* Paired: two three-digit numbers do not each need 400px, and the
          pairs are the ones people set together. */}
      <Stack direction="row" spacing={2}>
        <NumberField
          label="Altitude"
          title="The altitude the turn starts at."
          value={toDisplay(params.altitudeFt)}
          unit={altitudeLabel}
          step={altitudeLabel === 'ft' ? 50 : 15}
          limits={lengthLimits(LIMITS.manoeuvreAltitudeFt)}
          fullWidth
          onChange={value => change('altitudeFt', parseAltitude(value))}
        />
        <NumberField
          label="Duration"
          title="The time from the start of the turn to touchdown."
          value={params.duration}
          unit="s"
          step={0.5}
          limits={LIMITS.manoeuvreDurationS}
          fullWidth
          onChange={value => change('duration', value)}
        />
      </Stack>

      {/* Depth and offset are one position expressed as two numbers, so they
          share a row; each keeps its own note about the bound it is against. */}
      <Stack direction="row" spacing={2} alignItems="flex-start">
        <NumberField
          label="Depth"
          title="How far back you start from the landing point, along your final heading. Positive is away from the target."
          value={toDisplay(params.depthFt)}
          unit={altitudeLabel}
          step={altitudeLabel === 'ft' ? 50 : 15}
          limits={lengthLimits(bounds.depthFt)}
          helperText={boundNote(bounds.depthFt, LIMITS.manoeuvreDepthFt)}
          fullWidth
          onChange={value => change('depthFt', parseAltitude(value))}
        />
        <NumberField
          label="Offset"
          title="How far to the side you start, across your final heading, measured on the side you turn from. Negative starts you across the final approach line, which needs more than a quarter turn to fly."
          value={toDisplay(params.offsetFt)}
          unit={altitudeLabel}
          step={altitudeLabel === 'ft' ? 50 : 15}
          limits={lengthLimits(bounds.offsetFt)}
          helperText={boundNote(bounds.offsetFt, LIMITS.manoeuvreOffsetFt)}
          fullWidth
          onChange={value => change('offsetFt', parseAltitude(value))}
        />
      </Stack>

      {!reaches && (
        <Alert severity="warning" variant="outlined">
          No turn of {params.rotationDeg}° can start there. A quarter turn
          only ever takes you sideways and forwards, so it cannot begin past
          the target or across your final approach line — turn further, or
          move the start.
        </Alert>
      )}

      {/* The numbers fix where the turn starts and how far it goes; they do
          not describe its shape, and a real canopy turn is not a circle.
          Saying so here is the difference between a drawing and a claim. */}
      <Typography variant="caption" color="text.secondary">
        The turn drawn on the map is an illustration. Depth and offset place
        the point where you start it; the curve between there and the target
        is drawn at a nominal radius, not the path your canopy will fly.
      </Typography>
    </Stack>
  );
}
