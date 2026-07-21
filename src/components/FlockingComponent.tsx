/**
 * Flocking panel. Results (FWC-format vectors + spot + the miss line) sit
 * on top; the inputs are grouped into collapsible sections: Jump (presets,
 * window, speeds), Canopy flight (direction), Jumprun (direction, offset,
 * target radius) and Display (units, grid, Spot Reference). The canopy
 * flight and the jumprun are fully independent.
 */
import { ExpandMore as ExpandMoreIcon } from '@mui/icons-material';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  FormControlLabel,
  Slider,
  Stack,
  Switch,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography
} from '@mui/material';
import React, { useState } from 'react';

import {
  CANOPY_DEVIATION_WARN_DEG,
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

interface DirectionSelectorProps {
  /** The stored value: cardinal degrees or 'into-wind'. */
  value: number | 'into-wind';
  /** The resolved direction when value is 'into-wind'. */
  resolvedDeg: number;
  label: string;
  title: string;
  /** Remount key for external (quick-set) edits. */
  editKey: string;
  onChange: (value: number | 'into-wind') => void;
  onExternalChange: (value: number | 'into-wind') => void;
}

/** A direction selector: N/E/S/W + Into wind quick-set, and a degrees field. */
function DirectionSelector({
  value, resolvedDeg, label, title, editKey, onChange, onExternalChange
}: DirectionSelectorProps) {
  const intoWind = value === 'into-wind';
  const toggleValue = intoWind
    ? 'into-wind'
    : CARDINALS.find(c => c.deg === value)?.name ?? null;

  return (
    <>
      <Tooltip title={title}>
        <ToggleButtonGroup
          value={toggleValue}
          exclusive
          onChange={(_e, name) => {
            if (name === 'into-wind') {
              onExternalChange('into-wind');
            } else {
              const cardinal = CARDINALS.find(c => c.name === name);

              if (cardinal) {
                onExternalChange(cardinal.deg);
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
          key={`${editKey}-${intoWind ? roundDeg(resolvedDeg) : 'set'}`}
          title={`${title} Editing this overrides the into-wind setting.`}
          label={label}
          initialValue={intoWind ? roundDeg(resolvedDeg) : value as number}
          step={5}
          min={0}
          max={360}
          unit="˚"
          onChange={v => onChange(normalizeDirection(v))}
        />
        {intoWind && (
          <Typography variant="body2" sx={{ color: 'text.secondary', whiteSpace: 'nowrap' }}>
            Into wind · {roundDeg(resolvedDeg)}˚
          </Typography>
        )}
      </Stack>
    </>
  );
}

interface SectionProps {
  title: string;
  defaultExpanded?: boolean;
  children: React.ReactNode;
}

/** A collapsible panel section. */
function Section({ title, defaultExpanded = false, children }: SectionProps) {
  return (
    <Accordion
      defaultExpanded={defaultExpanded}
      disableGutters
      elevation={0}
      sx={{
        '&:before': { display: 'none' },
        border: 1,
        borderColor: 'divider',
        borderRadius: 1
      }}
    >
      <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ minHeight: 40 }}>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>{title}</Typography>
      </AccordionSummary>
      <AccordionDetails>
        <Box display="flex" flexDirection="column" gap={2}>
          {children}
        </Box>
      </AccordionDetails>
    </Accordion>
  );
}

interface FlockingComponentProps {
  params: FlockingParams;
  onParamsChange: (params: FlockingParams) => void;
  /** Resolved jumprun direction. */
  jumprunDeg: number;
  /** Resolved canopy flight direction. */
  canopyDeg: number;
  vectors: FlockingVectors | null;
  spot: SpotDescription | null;
  /** Distance from the flight's end to the target, miles. */
  missMi: number | null;
  /** Whether the end lands inside the target area. */
  onTarget: boolean;
  /** Free mode: canopy deviates from the jumprun by more than the limit. */
  canopyDeviationWarning: boolean;
  /** Whether any non-calm wind rows are loaded. */
  hasWind: boolean;
  /** Current target position (B) — where "Pin spot reference" pins C. */
  target: LatLng;
}

export default function FlockingComponent({
  params,
  onParamsChange,
  jumprunDeg,
  canopyDeg,
  vectors,
  spot,
  missMi,
  onTarget,
  canopyDeviationWarning,
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

  const setJumprun = (patch: Partial<JumprunConfig>, external = false) => {
    set({ jumprun: { ...params.jumprun, ...patch } }, external);
  };

  const activePreset = PRESETS.find(
    p => p.descentRateMph === params.descentRateMph &&
      p.horizontalSpeedMph === params.horizontalSpeedMph
  );

  const offsetDisplay = spot ? milesToDisplay(spot.offsetMi, params.distanceUnit) : 0;
  const unitLabel = DISTANCE_UNIT_LABELS[params.distanceUnit];

  return (
    <Box display="flex" flexDirection="column" gap={1.5}>
      <Tooltip
        title={'Classic: pick the canopy flight, the jumprun follows it — one unique '
          + 'exit solution (as in the Flocking Wind Calculator). Free: set the '
          + 'jumprun, the exit and the canopy flight yourself and see where the '
          + 'jump ends up.'}
      >
        <ToggleButtonGroup
          value={params.mode}
          exclusive
          onChange={(_e, m) => m !== null && set({ mode: m }, true)}
          fullWidth
          size="small"
          color="primary"
        >
          <ToggleButton value="classic">Classic</ToggleButton>
          <ToggleButton value="free">Free</ToggleButton>
        </ToggleButtonGroup>
      </Tooltip>

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
          {missMi !== null && (
            <Typography
              variant="body1"
              sx={{ color: onTarget ? 'success.main' : 'error.main', mt: 0.5 }}
              data-testid="flocking-miss"
            >
              {onTarget
                ? `On target (${milesToDisplay(missMi, params.distanceUnit).toFixed(2)} ${unitLabel} off)`
                : `MISSES TARGET by ${milesToDisplay(missMi, params.distanceUnit).toFixed(2)} ${unitLabel}`}
            </Typography>
          )}
        </Box>
      )}

      <Section title="Jump" defaultExpanded>
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
      </Section>

      <Section title="Canopy flight" defaultExpanded>
        {params.mode === 'classic' ? (
          <DirectionSelector
            value={params.direction}
            resolvedDeg={canopyDeg}
            label="Direction"
            title="Direction flown over ground during the jump (the jumprun follows it)."
            editKey={`canopy-${externalEdit}`}
            onChange={v => set({ direction: v })}
            onExternalChange={v => set({ direction: v }, true)}
          />
        ) : (
          <>
            <Stack direction="row" spacing={1} alignItems="center">
              <Tooltip title="Follow the jumprun direction, or set the canopy flight direction explicitly.">
                <ToggleButtonGroup
                  value={params.canopyDirection === 'follow-jumprun' ? 'follow' : 'custom'}
                  exclusive
                  onChange={(_e, v) => {
                    if (v === 'follow') {
                      set({ canopyDirection: 'follow-jumprun' }, true);
                    } else if (v === 'custom') {
                      set({ canopyDirection: roundDeg(jumprunDeg) }, true);
                    }
                  }}
                  fullWidth
                  size="small"
                  color="primary"
                >
                  <ToggleButton value="follow">Follow jumprun</ToggleButton>
                  <ToggleButton value="custom">Custom</ToggleButton>
                </ToggleButtonGroup>
              </Tooltip>
            </Stack>
            {params.canopyDirection !== 'follow-jumprun' && (
              <Stack direction="row" spacing={2} alignItems="center">
                <NumberInput
                  key={`canopy-free-${externalEdit}`}
                  title="Canopy flight direction over ground (with profiles: the initial direction)."
                  label="Direction"
                  initialValue={params.canopyDirection}
                  step={5}
                  min={0}
                  max={360}
                  unit="˚"
                  onChange={v => set({ canopyDirection: normalizeDirection(v) })}
                />
              </Stack>
            )}
            {params.canopyDirection === 'follow-jumprun' && (
              <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'left' }}>
                Following jumprun · {roundDeg(canopyDeg)}˚
              </Typography>
            )}
            {canopyDeviationWarning && (
              <Typography variant="body2" sx={{ color: 'error.main', textAlign: 'left' }}>
                Canopy flight deviates from the jumprun by more than
                {' '}{CANOPY_DEVIATION_WARN_DEG}˚
              </Typography>
            )}
          </>
        )}
      </Section>

      {params.mode === 'free' && (
        <Section title="Jumprun" defaultExpanded>
          <DirectionSelector
            value={params.jumprun.directionDeg}
            resolvedDeg={jumprunDeg}
            label="Jumprun"
            title="The jumprun the pilots fly — independent of the canopy flight."
            editKey={`jr-${externalEdit}`}
            onChange={v => setJumprun({ directionDeg: v })}
            onExternalChange={v => setJumprun({ directionDeg: v }, true)}
          />
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
          <Box sx={{ px: 1 }}>
            <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'left' }}>
              Exit · {milesToDisplay(params.exitAlongMi, params.distanceUnit).toFixed(2)} {unitLabel} along
            </Typography>
            <Slider
              size="small"
              value={milesToDisplay(params.exitAlongMi, params.distanceUnit)}
              min={-5}
              max={5}
              step={0.05}
              valueLabelDisplay="auto"
              valueLabelFormat={v => `${v.toFixed(2)} ${unitLabel}`}
              onChange={(_e, v) =>
                set({ exitAlongMi: displayToMiles(v as number, params.distanceUnit) })}
            />
          </Box>
        </Section>
      )}

      <Section title="Display">
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
      </Section>
    </Box>
  );
}
