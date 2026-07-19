/**
 * Flocking panel: altitude window, speeds (with FWC's presets), jumprun
 * direction and the FWC-format results block (drift vectors + spot).
 */
import {
  Box,
  Button,
  Divider,
  FormControlLabel,
  Stack,
  Switch,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography
} from '@mui/material';
import React, { useState } from 'react';

import {
  CanopySolution,
  DISTANCE_UNITS,
  DISTANCE_UNIT_LABELS,
  DistanceUnit,
  DriftVector,
  FlockingParams,
  FlockingVectors,
  JumprunConfig,
  SpotDescription,
  displayToMiles,
  milesToDisplay
} from '../core/flocking';
import { LIMITS, normalizeDirection } from '../core/validation';
import { LatLng } from '../types';
import { useUnits } from '../hooks';

import NumberInput from './NumberInput';

// FWC's presets (Input.kt): descent / horizontal, mph
const PRESETS = [
  { name: 'Flow', descentRateMph: 21, horizontalSpeedMph: 50 },
  { name: 'Float', descentRateMph: 17, horizontalSpeedMph: 40 },
  { name: 'XRW', descentRateMph: 40, horizontalSpeedMph: 70 },
  { name: 'CRW', descentRateMph: 15, horizontalSpeedMph: 27 }
] as const;

const CARDINALS = [
  { name: 'N', deg: 0 },
  { name: 'E', deg: 90 },
  { name: 'S', deg: 180 },
  { name: 'W', deg: 270 }
] as const;

/** Round a direction for display without showing 360 (359.7 -> 0). */
function roundDeg(deg: number): number {
  return Math.round(deg) % 360;
}

/** FWC's vector line: "1.66 mi at 180˚". */
function vectorText(v: DriftVector, unit: DistanceUnit): string {
  return `${milesToDisplay(v.lengthMi, unit).toFixed(2)} ${DISTANCE_UNIT_LABELS[unit]}` +
    ` at ${roundDeg(v.directionDeg)}˚`;
}

interface FlockingComponentProps {
  params: FlockingParams;
  onParamsChange: (params: FlockingParams) => void;
  /** Resolved jumprun direction (into-wind resolved from the winds). */
  jumprunDeg: number;
  /** Current into-wind direction (for the pinned quick-set button). */
  intoWindDeg: number;
  vectors: FlockingVectors | null;
  spot: SpotDescription | null;
  /** Solved canopy flight for the pinned exit (pinned mode only). */
  canopy: CanopySolution | null;
  /** Whether any non-calm wind rows are loaded. */
  hasWind: boolean;
  /** Current target position (B) — where "Pin spot reference" pins C. */
  target: LatLng;
}

export default function FlockingComponent({
  params,
  onParamsChange,
  jumprunDeg,
  intoWindDeg,
  vectors,
  spot,
  canopy,
  hasWind,
  target
}: FlockingComponentProps) {
  const {
    formatAltitude,
    parseAltitude,
    altitudeLabel,
    formatDescentRate,
    parseDescentRate,
    descentRateLabel
  } = useUnits();

  // NumberInput keeps its own state from initialValue; quick-set actions
  // (presets, N/E/S/W, into-wind) change values from outside, so bump a
  // key to remount the inputs with the new values. Typing never bumps it,
  // so focus is preserved while editing.
  const [externalEdit, setExternalEdit] = useState(0);

  const set = (patch: Partial<FlockingParams>, external = false) => {
    onParamsChange({ ...params, ...patch });
    if (external) {
      setExternalEdit(n => n + 1);
    }
  };

  const pinned = params.jumprun.mode === 'pinned';

  /** Patch the jumprun config (merging into the pinned shape when partial). */
  const setJumprun = (patch: Partial<JumprunConfig> & { mode?: JumprunConfig['mode'] }, external = false) => {
    if (patch.mode === 'auto') {
      set({ jumprun: { mode: 'auto' } }, external);
      return;
    }
    const base = params.jumprun.mode === 'pinned'
      ? params.jumprun
      : { mode: 'pinned' as const, directionDeg: 0, offsetMi: 0, exitAlongMi: null };

    set({ jumprun: { ...base, ...patch, mode: 'pinned' } }, external);
  };

  const activePreset = PRESETS.find(
    p => p.descentRateMph === params.descentRateMph &&
      p.horizontalSpeedMph === params.horizontalSpeedMph
  );

  const intoWind = params.direction === 'into-wind';
  const directionToggle = intoWind
    ? 'into-wind'
    : CARDINALS.find(c => c.deg === params.direction)?.name ?? null;

  const offsetDisplay = spot ? milesToDisplay(spot.offsetMi, params.distanceUnit) : 0;
  const unitLabel = DISTANCE_UNIT_LABELS[params.distanceUnit];

  return (
    <Box display="flex" flexDirection="column" gap={2}>
      <Tooltip title="Quick-set descent rate and horizontal speed for a jump type.">
        <ToggleButtonGroup
          value={activePreset?.name ?? null}
          exclusive
          onChange={(_e, name) => {
            const preset = PRESETS.find(p => p.name === name);

            if (preset) {
              set({
                descentRateMph: preset.descentRateMph,
                horizontalSpeedMph: preset.horizontalSpeedMph
              }, true);
            }
          }}
          fullWidth
          size="small"
          color="primary"
        >
          {PRESETS.map(p => (
            <ToggleButton key={p.name} value={p.name}>{p.name}</ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Tooltip>

      <Stack direction="row" spacing={2}>
        <NumberInput
          key={`top-${externalEdit}`}
          title="Exit altitude — the top of the flown altitude window."
          label="Altitude from"
          initialValue={Math.round(formatAltitude(params.windowTopFt).value)}
          step={altitudeLabel === 'ft' ? 500 : 100}
          min={Math.round(formatAltitude(LIMITS.flockingAltitudeFt.min).value)}
          max={Math.round(formatAltitude(LIMITS.flockingAltitudeFt.max).value)}
          unit={altitudeLabel}
          onChange={value => set({ windowTopFt: parseAltitude(value) })}
        />
        <NumberInput
          key={`bottom-${externalEdit}`}
          title="End of the jump — the bottom of the flown altitude window."
          label="Down to"
          initialValue={Math.round(formatAltitude(params.windowBottomFt).value)}
          step={altitudeLabel === 'ft' ? 500 : 100}
          min={Math.round(formatAltitude(LIMITS.flockingAltitudeFt.min).value)}
          max={Math.round(formatAltitude(LIMITS.flockingAltitudeFt.max).value)}
          unit={altitudeLabel}
          onChange={value => set({ windowBottomFt: parseAltitude(value) })}
        />
      </Stack>

      <Stack direction="row" spacing={2}>
        <NumberInput
          key={`descent-${externalEdit}`}
          title="Vertical speed during the jump."
          label="Descent rate"
          initialValue={formatDescentRate(params.descentRateMph).value}
          step={1}
          min={formatDescentRate(LIMITS.flockingDescentRateMph.min).value}
          max={formatDescentRate(LIMITS.flockingDescentRateMph.max).value}
          unit={descentRateLabel}
          onChange={value => set({ descentRateMph: parseDescentRate(value) })}
        />
        <NumberInput
          key={`horizontal-${externalEdit}`}
          title="Horizontal speed over ground during the jump."
          label="Horizontal speed"
          initialValue={formatDescentRate(params.horizontalSpeedMph).value}
          step={1}
          min={formatDescentRate(LIMITS.flockingHorizontalSpeedMph.min).value}
          max={formatDescentRate(LIMITS.flockingHorizontalSpeedMph.max).value}
          unit={descentRateLabel}
          onChange={value => set({ horizontalSpeedMph: parseDescentRate(value) })}
        />
      </Stack>

      <Divider />
      <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
        <Typography variant="body2" sx={{ textAlign: 'left', color: 'text.secondary' }}>
          Jumprun
        </Typography>
        <Tooltip
          title={'Auto: the jumprun follows the canopy flight direction. Pinned: the '
            + 'jumprun is a fixed line (e.g. dictated by airspace); the canopy '
            + 'flight direction is solved to make the target.'}
        >
          <ToggleButtonGroup
            value={pinned ? 'pinned' : 'auto'}
            exclusive
            onChange={(_e, mode) => {
              if (mode === 'pinned' && !pinned) {
                // Seed the pinned line from the current resolved jumprun
                setJumprun({
                  mode: 'pinned',
                  directionDeg: roundDeg(jumprunDeg),
                  offsetMi: 0,
                  exitAlongMi: null
                });
              } else if (mode === 'auto' && pinned) {
                setJumprun({ mode: 'auto' });
              }
            }}
            size="small"
            color="primary"
          >
            <ToggleButton value="auto">Auto</ToggleButton>
            <ToggleButton value="pinned">Pinned</ToggleButton>
          </ToggleButtonGroup>
        </Tooltip>
      </Stack>

      {!pinned && (
        <>
          <Tooltip title="Direction flown over ground (the jumprun direction).">
            <ToggleButtonGroup
              value={directionToggle}
              exclusive
              onChange={(_e, name) => {
                if (name === 'into-wind') {
                  set({ direction: 'into-wind' }, true);
                } else {
                  const cardinal = CARDINALS.find(c => c.name === name);

                  if (cardinal) {
                    set({ direction: cardinal.deg }, true);
                  }
                }
              }}
              fullWidth
              size="small"
              color="primary"
            >
              {CARDINALS.map(c => (
                <ToggleButton key={c.name} value={c.name}>{c.name}</ToggleButton>
              ))}
              <ToggleButton value="into-wind">Into wind</ToggleButton>
            </ToggleButtonGroup>
          </Tooltip>
          <Stack direction="row" spacing={2} alignItems="center">
            <NumberInput
              key={`dir-${externalEdit}-${intoWind ? roundDeg(jumprunDeg) : 'set'}`}
              title="Flight direction in degrees. Editing this overrides the into-wind setting."
              label="Direction"
              initialValue={intoWind ? roundDeg(jumprunDeg) : params.direction as number}
              step={5}
              min={0}
              max={360}
              unit="˚"
              onChange={value => set({ direction: normalizeDirection(value) })}
            />
            {intoWind && (
              <Typography variant="body2" sx={{ color: 'text.secondary', whiteSpace: 'nowrap' }}>
                Into wind · {roundDeg(jumprunDeg)}˚
              </Typography>
            )}
          </Stack>
        </>
      )}

      {pinned && params.jumprun.mode === 'pinned' && (
        <>
          <Stack direction="row" spacing={1} alignItems="center">
            <NumberInput
              key={`jr-dir-${externalEdit}`}
              title="The pinned jumprun direction (e.g. the run the pilots will fly)."
              label="Jumprun"
              initialValue={roundDeg(params.jumprun.directionDeg)}
              step={5}
              min={0}
              max={360}
              unit="˚"
              onChange={value => setJumprun({ directionDeg: normalizeDirection(value) })}
            />
            <ToggleButtonGroup size="small" exclusive value={null}>
              {CARDINALS.map(c => (
                <ToggleButton
                  key={c.name}
                  value={c.name}
                  onClick={() => setJumprun({ directionDeg: c.deg }, true)}
                >
                  {c.name}
                </ToggleButton>
              ))}
              <ToggleButton
                value="into-wind"
                onClick={() => setJumprun({ directionDeg: roundDeg(intoWindDeg) }, true)}
              >
                Wind
              </ToggleButton>
            </ToggleButtonGroup>
          </Stack>
          <Stack direction="row" spacing={2}>
            <NumberInput
              key={`jr-offset-${externalEdit}`}
              title={'Lateral offset of the jumprun line from the Spot Reference '
                + '(positive = right of the run direction).'}
              label="Offset"
              initialValue={Number(milesToDisplay(params.jumprun.offsetMi, params.distanceUnit).toFixed(2))}
              step={0.1}
              min={milesToDisplay(LIMITS.flockingJumprunOffsetMi.min, params.distanceUnit)}
              max={milesToDisplay(LIMITS.flockingJumprunOffsetMi.max, params.distanceUnit)}
              unit={unitLabel}
              onChange={value => setJumprun({ offsetMi: displayToMiles(value, params.distanceUnit) })}
            />
            <NumberInput
              key={`jr-radius-${externalEdit}`}
              title="Radius of the target area: the jump works if it ends anywhere inside it."
              label="Target radius"
              initialValue={Number(milesToDisplay(params.targetRadiusMi, params.distanceUnit).toFixed(2))}
              step={0.05}
              min={milesToDisplay(LIMITS.flockingTargetRadiusMi.min, params.distanceUnit)}
              max={milesToDisplay(LIMITS.flockingTargetRadiusMi.max, params.distanceUnit)}
              unit={unitLabel}
              onChange={value => set({ targetRadiusMi: displayToMiles(value, params.distanceUnit) })}
            />
          </Stack>
          <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
            <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'left' }}>
              Exit
              {params.jumprun.exitAlongMi === null
                ? ' · best'
                : ` · ${milesToDisplay(params.jumprun.exitAlongMi, params.distanceUnit).toFixed(2)} ${unitLabel} along`}
            </Typography>
            {params.jumprun.exitAlongMi !== null && (
              <Tooltip title="Back to the best exit (lowest required canopy speed). Drag the exit marker on the map to choose manually.">
                <Button size="small" onClick={() => setJumprun({ exitAlongMi: null })}>
                  Best
                </Button>
              </Tooltip>
            )}
          </Stack>
          {canopy && (
            <Box
              sx={{ textAlign: 'left' }}
              data-testid="flocking-canopy-solution"
            >
              <Typography variant="body1" sx={{ color: canopy.reachable ? 'success.main' : 'error.main' }}>
                {canopy.reachable
                  ? `Fly ${roundDeg(canopy.headingDeg)}˚ · needs `
                    + `${formatDescentRate(canopy.requiredSpeedMph).value} of `
                    + `${formatDescentRate(params.horizontalSpeedMph).value} ${descentRateLabel}`
                  : `UNREACHABLE · short ${milesToDisplay(canopy.shortfallMi, params.distanceUnit).toFixed(2)} `
                    + `${unitLabel} (needs ${formatDescentRate(canopy.requiredSpeedMph).value} ${descentRateLabel})`}
              </Typography>
            </Box>
          )}
        </>
      )}

      <Divider />
      <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>Distances</Typography>
        <ToggleButtonGroup
          value={params.distanceUnit}
          exclusive
          onChange={(_e, unit) => unit !== null && set({ distanceUnit: unit })}
          size="small"
          color="primary"
        >
          {DISTANCE_UNITS.map(u => (
            <ToggleButton key={u} value={u}>{DISTANCE_UNIT_LABELS[u]}</ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Stack>

      <Tooltip
        title={'Distance grid on the map, centered on the Spot Reference and aligned '
          + 'with the jumprun, one grid square per distance unit.'}
      >
        <FormControlLabel
          control={
            <Switch
              size="small"
              checked={params.showGrid}
              onChange={e => set({ showGrid: e.target.checked })}
            />
          }
          label={<Typography variant="body2" sx={{ color: 'text.secondary' }}>Jumprun grid</Typography>}
          sx={{ alignSelf: 'flex-start', ml: 0 }}
        />
      </Tooltip>

      <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
        <Tooltip
          title={'The point the spot is described against. Pin it at the current target '
            + 'to keep the spot fixed while you move the target around.'}
        >
          <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'left' }}>
            Spot Reference{' '}
            {params.referencePoint
              ? `${params.referencePoint.lat.toFixed(4)}, ${params.referencePoint.lng.toFixed(4)}`
              : '· target'}
          </Typography>
        </Tooltip>
        {params.referencePoint ? (
          <Button size="small" onClick={() => set({ referencePoint: null })}>
            Unpin
          </Button>
        ) : (
          <Button
            size="small"
            onClick={() => set({ referencePoint: { lat: target.lat, lng: target.lng } })}
          >
            Pin spot reference
          </Button>
        )}
      </Stack>

      {!hasWind && (
        <Typography variant="body2" sx={{ textAlign: 'left', color: 'warning.main' }}>
          No wind data loaded — this is the no-wind spot. Fetch winds in the
          Wind panel for a forecast.
        </Typography>
      )}

      {vectors && (
        <Box sx={{ textAlign: 'left' }} data-testid="flocking-results">
          <Typography variant="body2" color="text.secondary">Wind drift:</Typography>
          <Typography variant="body1">{vectorText(vectors.windDrift, params.distanceUnit)}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>Canopy flight:</Typography>
          <Typography variant="body1">{vectorText(vectors.canopyFlight, params.distanceUnit)}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>Combined:</Typography>
          <Typography variant="body1">{vectorText(vectors.combined, params.distanceUnit)}</Typography>
        </Box>
      )}

      {spot && (
        <>
          <Divider />
          <Box sx={{ textAlign: 'left' }} data-testid="flocking-spot">
            <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
              {hasWind ? 'Forecasted Spot:' : 'No-wind Spot:'}
            </Typography>
            <Typography variant="body1">Jumprun {roundDeg(spot.jumprunDeg)}˚</Typography>
            <Typography variant="body1">
              {milesToDisplay(spot.alongMi, params.distanceUnit).toFixed(2)} {unitLabel}{' '}
              {spot.prior ? 'prior' : <b>PAST</b>}
            </Typography>
            {offsetDisplay > 0.05 && (
              <Typography variant="body1">
                Offset {offsetDisplay.toFixed(2)} {unitLabel} {spot.offsetLeft ? 'left' : 'right'}
              </Typography>
            )}
          </Box>
        </>
      )}
    </Box>
  );
}
