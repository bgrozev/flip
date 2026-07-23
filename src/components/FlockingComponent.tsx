/**
 * Flocking panel. Results (FWC-format vectors + spot + the miss line) sit
 * on top; the inputs are grouped into collapsible sections: Jump (presets,
 * window, speeds), Canopy flight (direction), Jumprun (direction, offset,
 * target radius) and Display (units, grid, Spot Reference). The canopy
 * flight and the jumprun are fully independent.
 */
import {
  ExpandLess as ExpandLessIcon,
  ExpandMore as ExpandMoreIcon
} from '@mui/icons-material';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Checkbox,
  Collapse,
  FormControlLabel,
  IconButton,
  Slider,
  Stack,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography
} from '@mui/material';
import React, { useState } from 'react';

import { SolveResult, SolveSolution, SolveTier } from '../core/flockingSolve';
import {
  CANOPY_DEVIATION_WARN_DEG,
  DISTANCE_UNIT_LABELS,
  DistanceUnit,
  DriftVector,
  FlockingParams,
  FlockingVectors,
  JumprunConfig,
  SolveCorridorParams,
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

/** Panel colour per miss tier. */
const TIER_COLOR: Record<SolveTier, string> = {
  green: 'success.main',
  yellow: 'warning.main',
  red: 'error.main'
};

/**
 * A distance in the display unit, rounded for the input fields: 0.1 by
 * default, finer where the field steps in smaller increments (the ring
 * radii step by 0.05, so 0.25 nm must not read as 0.3).
 */
function roundDist(miles: number, unit: DistanceUnit, decimals = 1): number {
  const factor = 10 ** decimals;

  return Math.round(milesToDisplay(miles, unit) * factor) / factor;
}

/** A small arrow pointing toward a cardinal bearing (0˚ = up/north). */
function BearingArrow({ deg }: { deg: number }) {
  return (
    <span
      style={{ display: 'inline-block', transform: `rotate(${deg}deg)`, fontSize: '0.9em' }}
      aria-hidden
    >
      ↑
    </span>
  );
}

/** One compact vector row: "Wind drift  3.32 mi  190˚ ↑". */
function VectorRow({ label, v, unit }: { label: string; v: DriftVector; unit: DistanceUnit }) {
  return (
    <Stack direction="row" alignItems="baseline" justifyContent="space-between" spacing={1}>
      <Typography variant="body2" color="text.secondary">{label}</Typography>
      <Typography variant="body2" sx={{ whiteSpace: 'nowrap' }}>
        {milesToDisplay(v.lengthMi, unit).toFixed(2)} {DISTANCE_UNIT_LABELS[unit]}
        {' · '}{roundDeg(v.directionDeg)}˚ <BearingArrow deg={v.directionDeg} />
      </Typography>
    </Stack>
  );
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
          wrap={360}
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
  /** Which ring the miss falls in; null in classic (no miss). */
  tier: SolveTier | null;
  /** Angle between the canopy flight and the jumprun, degrees. */
  canopyDeviationDeg: number;
  /** Whether that deviation exceeds CANOPY_DEVIATION_WARN_DEG. */
  canopyDeviationWarning: boolean;
  /** Solve mode: solver result (best carries the corridor index). */
  solve: SolveResult | null;
  /** Solve mode: each corridor's solution, aligned to params.solveCorridors. */
  corridorSolutions: (SolveSolution | null)[];
  /** Ground distance unit (from general Settings). */
  distanceUnit: DistanceUnit;
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
  tier,
  canopyDeviationDeg,
  canopyDeviationWarning,
  solve,
  corridorSolutions,
  distanceUnit,
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

  const setCorridor = (i: number, patch: Partial<SolveCorridorParams>) => {
    set({
      solveCorridors: params.solveCorridors.map(
        (c, j) => j === i ? { ...c, ...patch } : c
      )
    });
  };

  const addCorridor = () => {
    set({
      solveCorridors: [
        ...params.solveCorridors,
        {
          name: '',
          enabled: true,
          directionDeg: 0,
          offsetMinMi: -1,
          offsetMaxMi: 1,
          alongMinMi: -5,
          alongMaxMi: 3,
          canopyToleranceDeg: 15
        }
      ]
    }, true);
  };

  // Per-corridor collapse (details hidden; the checkbox/name/verdict stay
  // visible so a corridor can be toggled on/off without expanding it).
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  const toggleCollapsed = (i: number) =>
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  const removeCorridor = (i: number) => {
    set({ solveCorridors: params.solveCorridors.filter((_c, j) => j !== i) }, true);
    // Keep collapse flags aligned to the shifted indices.
    setCollapsed(prev => {
      const next = new Set<number>();
      prev.forEach(idx => {
        if (idx < i) next.add(idx);
        else if (idx > i) next.add(idx - 1);
      });
      return next;
    });
  };

  const activePreset = PRESETS.find(
    p => p.descentRateMph === params.descentRateMph &&
      p.horizontalSpeedMph === params.horizontalSpeedMph
  );

  const offsetDisplay = spot ? milesToDisplay(spot.offsetMi, distanceUnit) : 0;
  const unitLabel = DISTANCE_UNIT_LABELS[distanceUnit];

  return (
    <Box display="flex" flexDirection="column" gap={1.5}>
      <Tooltip
        title={'Classic: pick the canopy flight, the jumprun follows it — one unique '
          + 'exit solution (as in the Flocking Wind Calculator). Free: set the '
          + 'jumprun, the exit and the canopy flight yourself and see where the '
          + 'jump ends up. Solve: describe the allowed jumprun corridors and let '
          + 'the app find the best exit.'}
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
          <ToggleButton value="solve">Solve</ToggleButton>
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
          <VectorRow label="Wind drift" v={vectors.windDrift} unit={distanceUnit} />
          <VectorRow label="Canopy flight" v={vectors.canopyFlight} unit={distanceUnit} />
          <VectorRow label="Combined" v={vectors.combined} unit={distanceUnit} />
        </Box>
      )}

      {spot && (
        <Box sx={{ textAlign: 'left' }} data-testid="flocking-spot">
          <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
            Spot
          </Typography>
          <Typography variant="body1">Jumprun {roundDeg(spot.jumprunDeg)}˚</Typography>
          {canopyDeviationDeg >= 0.5 && (
            <Typography
              variant="body1"
              sx={{ color: canopyDeviationWarning ? 'error.main' : 'success.main' }}
              data-testid="flocking-deviation"
            >
              Canopy {Math.round(canopyDeviationDeg)}˚ off jumprun
            </Typography>
          )}
          <Typography variant="body1">
            {milesToDisplay(spot.alongMi, distanceUnit).toFixed(2)} {unitLabel}{' '}
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
              sx={{ color: TIER_COLOR[tier ?? 'green'], mt: 0.5 }}
              data-testid="flocking-miss"
            >
              {tier === 'green' &&
                `On target (${milesToDisplay(missMi, distanceUnit).toFixed(2)} ${unitLabel} off)`}
              {tier === 'yellow' &&
                `Close: ${milesToDisplay(missMi, distanceUnit).toFixed(2)} ${unitLabel} off`}
              {tier === 'red' &&
                `MISSES TARGET by ${milesToDisplay(missMi, distanceUnit).toFixed(2)} ${unitLabel}`}
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

      {params.mode !== 'solve' && (
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
                    wrap={360}
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
      )}

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
              initialValue={roundDist(params.jumprun.offsetMi, distanceUnit)}
              step={0.1}
              min={milesToDisplay(LIMITS.flockingJumprunOffsetMi.min, distanceUnit)}
              max={milesToDisplay(LIMITS.flockingJumprunOffsetMi.max, distanceUnit)}
              unit={unitLabel}
              onChange={value => setJumprun({ offsetMi: displayToMiles(value, distanceUnit) })}
            />

          </Stack>
          <Box sx={{ px: 1 }}>
            <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'left' }}>
              Exit · {milesToDisplay(params.exitAlongMi, distanceUnit).toFixed(2)} {unitLabel} along
            </Typography>
            <Slider
              size="small"
              value={milesToDisplay(params.exitAlongMi, distanceUnit)}
              min={-5}
              max={5}
              step={0.05}
              valueLabelDisplay="auto"
              valueLabelFormat={v => `${v.toFixed(2)} ${unitLabel}`}
              onChange={(_e, v) =>
                set({ exitAlongMi: displayToMiles(v as number, distanceUnit) })}
            />
          </Box>
        </Section>
      )}

      {params.mode === 'solve' && (
        <Section title="Corridors" defaultExpanded>
          {params.solveCorridors.length === 0 && (
            <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'left' }}>
              No corridors — add one to describe an allowed jumprun.
            </Typography>
          )}
          {params.solveCorridors.length > 0 &&
            params.solveCorridors.every(c => !c.enabled) && (
            <Typography variant="body2" sx={{ color: 'warning.main', textAlign: 'left' }}>
              Every corridor is switched off — tick one to solve.
            </Typography>
          )}
          {params.solveCorridors.map((c, i) => {
            const result = corridorSolutions[i];
            const isBest = solve?.best?.corridorIndex === i;
            const isCollapsed = collapsed.has(i);

            return (
              <Box
                key={i}
                sx={{
                  border: 1,
                  borderColor: isBest ? 'success.main' : 'divider',
                  borderRadius: 1,
                  p: 1,
                  opacity: c.enabled ? 1 : 0.55
                }}
              >
                <Stack direction="row" alignItems="center" spacing={0.5}>
                  <Tooltip title={isCollapsed ? 'Show corridor settings.' : 'Hide corridor settings.'}>
                    <IconButton
                      size="small"
                      onClick={() => toggleCollapsed(i)}
                      sx={{ p: 0.5 }}
                      aria-label={`${isCollapsed ? 'Expand' : 'Collapse'} corridor ${i + 1}`}
                    >
                      {isCollapsed ? <ExpandMoreIcon fontSize="small" /> : <ExpandLessIcon fontSize="small" />}
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Include this corridor in the solve.">
                    <Checkbox
                      size="small"
                      checked={c.enabled}
                      onChange={e => setCorridor(i, { enabled: e.target.checked })}
                      sx={{ p: 0.5 }}
                      inputProps={{ 'aria-label': `Enable corridor ${i + 1}` }}
                    />
                  </Tooltip>
                  <TextField
                    variant="standard"
                    size="small"
                    placeholder={`Corridor ${i + 1}`}
                    value={c.name}
                    onChange={e => setCorridor(i, { name: e.target.value })}
                    inputProps={{ 'aria-label': `Corridor ${i + 1} name` }}
                    sx={{ flex: 1, minWidth: 0 }}
                  />
                  <Button size="small" color="error" onClick={() => removeCorridor(i)}>
                    Remove
                  </Button>
                </Stack>
                <Typography
                  variant="body2"
                  sx={{ color: isBest ? 'success.main' : 'text.secondary', textAlign: 'left' }}
                >
                  {`${roundDeg(c.directionDeg)}˚`}
                  {!c.enabled && ' · off'}
                  {result && ` · ${result.tier === 'green'
                    ? 'on target'
                    : `${result.tier === 'yellow' ? 'close' : 'misses'} by ${
                      milesToDisplay(result.missMi, distanceUnit).toFixed(2)} ${unitLabel}`}`}
                  {isBest && ' · best'}
                </Typography>
                <Collapse in={!isCollapsed}>
                  <Stack direction="row" spacing={1}>
                    <NumberInput
                      key={`c${i}-dir-${externalEdit}`}
                      title="Jumprun direction for this corridor."
                      label="Direction"
                      initialValue={roundDeg(c.directionDeg)}
                      step={5}
                      wrap={360}
                      unit="˚"
                      onChange={v => setCorridor(i, { directionDeg: normalizeDirection(v) })}
                    />
                    <NumberInput
                      key={`c${i}-tol-${externalEdit}`}
                      title="How far the canopy flight may deviate from the run."
                      label="Canopy ±"
                      initialValue={c.canopyToleranceDeg}
                      step={5}
                      min={LIMITS.flockingCanopyToleranceDeg.min}
                      max={LIMITS.flockingCanopyToleranceDeg.max}
                      unit="˚"
                      onChange={v => setCorridor(i, { canopyToleranceDeg: v })}
                    />
                  </Stack>
                  <Stack direction="row" spacing={1}>
                    <NumberInput
                      key={`c${i}-offmin-${externalEdit}`}
                      title="Left-most allowed lateral offset of the run (negative = left)."
                      label="Offset min"
                      initialValue={roundDist(c.offsetMinMi, distanceUnit)}
                      step={0.25}
                      min={milesToDisplay(LIMITS.flockingJumprunOffsetMi.min, distanceUnit)}
                      max={milesToDisplay(LIMITS.flockingJumprunOffsetMi.max, distanceUnit)}
                      unit={unitLabel}
                      onChange={v => setCorridor(i, { offsetMinMi: displayToMiles(v, distanceUnit) })}
                    />
                    <NumberInput
                      key={`c${i}-offmax-${externalEdit}`}
                      title="Right-most allowed lateral offset of the run."
                      label="Offset max"
                      initialValue={roundDist(c.offsetMaxMi, distanceUnit)}
                      step={0.25}
                      min={milesToDisplay(LIMITS.flockingJumprunOffsetMi.min, distanceUnit)}
                      max={milesToDisplay(LIMITS.flockingJumprunOffsetMi.max, distanceUnit)}
                      unit={unitLabel}
                      onChange={v => setCorridor(i, { offsetMaxMi: displayToMiles(v, distanceUnit) })}
                    />
                  </Stack>
                  <Stack direction="row" spacing={1}>
                    <NumberInput
                      key={`c${i}-alongmin-${externalEdit}`}
                      title="Earliest allowed exit along the run (signed; negative = before the reference)."
                      label="Along min"
                      initialValue={roundDist(c.alongMinMi, distanceUnit)}
                      step={0.5}
                      min={milesToDisplay(LIMITS.flockingExitAlongMi.min, distanceUnit)}
                      max={milesToDisplay(LIMITS.flockingExitAlongMi.max, distanceUnit)}
                      unit={unitLabel}
                      onChange={v => setCorridor(i, { alongMinMi: displayToMiles(v, distanceUnit) })}
                    />
                    <NumberInput
                      key={`c${i}-alongmax-${externalEdit}`}
                      title="Latest allowed exit along the run."
                      label="Along max"
                      initialValue={roundDist(c.alongMaxMi, distanceUnit)}
                      step={0.5}
                      min={milesToDisplay(LIMITS.flockingExitAlongMi.min, distanceUnit)}
                      max={milesToDisplay(LIMITS.flockingExitAlongMi.max, distanceUnit)}
                      unit={unitLabel}
                      onChange={v => setCorridor(i, { alongMaxMi: displayToMiles(v, distanceUnit) })}
                    />
                  </Stack>
                </Collapse>
              </Box>
            );
          })}
          <Button size="small" onClick={addCorridor} sx={{ alignSelf: 'flex-start' }}>
            Add corridor
          </Button>

        </Section>
      )}

      <Section title="Display">
        <Stack direction="row" spacing={2}>
          <NumberInput
            key={`green-radius-${externalEdit}`}
            title={'Green ring: the jump works if it ends anywhere inside. In solve '
              + 'mode, corridors that all reach it are chosen by which run is most '
              + 'into the wind rather than by a hair of miss distance.'}
            label="Green radius"
            initialValue={roundDist(params.targetRadiusMi, distanceUnit, 2)}
            step={0.05}
            min={milesToDisplay(LIMITS.flockingTargetRadiusMi.min, distanceUnit)}
            max={milesToDisplay(LIMITS.flockingTargetRadiusMi.max, distanceUnit)}
            unit={unitLabel}
            onChange={value => set({ targetRadiusMi: displayToMiles(value, distanceUnit) })}
          />
          <NumberInput
            key={`yellow-radius-${externalEdit}`}
            title="Yellow ring: beyond the green one, but still workable."
            label="Yellow radius"
            initialValue={roundDist(params.yellowRadiusMi, distanceUnit, 2)}
            step={0.05}
            min={milesToDisplay(LIMITS.flockingYellowRadiusMi.min, distanceUnit)}
            max={milesToDisplay(LIMITS.flockingYellowRadiusMi.max, distanceUnit)}
            unit={unitLabel}
            onChange={value => set({ yellowRadiusMi: displayToMiles(value, distanceUnit) })}
          />
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
