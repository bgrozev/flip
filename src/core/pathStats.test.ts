import { describe, expect, it } from 'vitest';

import { calculatePathStats, getPointSegmentStats } from './pathStats';

interface P {
  lat: number;
  lng: number;
  alt?: number;
  time?: number;
  phase?: string;
  pom?: number | boolean;
}

// 0.001° of latitude ≈ 111.195 m ≈ 364.8 ft (turf mean earth radius)
const DEG_001_FT = 364.8;

/**
 * A simple two-leg pattern, landing-first (index 0 = target), no wind:
 * leg 0 goes south to the target, leg 1 goes west into leg 0's start.
 */
function makePattern(): P[] {
  return [
    { lat: 0, lng: 0, alt: 0, time: 0, phase: 'pattern', pom: true },
    { lat: 0.0005, lng: 0, alt: 50, time: 5000, phase: 'pattern', pom: false },
    { lat: 0.001, lng: 0, alt: 100, time: 10000, phase: 'pattern', pom: true },
    { lat: 0.001, lng: 0.001, alt: 200, time: 20000, phase: 'pattern', pom: true }
  ];
}

/** Three manoeuvre points: north then a 90° right turn to east. */
function makeManoeuvre(): P[] {
  return [
    { lat: 0.002, lng: 0, alt: 400, time: 30000, phase: 'manoeuvre', pom: true },
    { lat: 0.0025, lng: 0, alt: 350, time: 32000, phase: 'manoeuvre', pom: false },
    { lat: 0.0025, lng: 0.0005, alt: 300, time: 35000, phase: 'manoeuvre', pom: true }
  ];
}

describe('calculatePathStats', () => {
  it('returns empty stats for paths shorter than 2 points', () => {
    const stats = calculatePathStats([], []);

    expect(stats.legs).toEqual([]);
    expect(stats.manoeuvre).toBeNull();
    expect(stats.pointToSegment.size).toBe(0);

    const one: P[] = [{ lat: 0, lng: 0 }];

    expect(calculatePathStats(one, one).legs).toEqual([]);
  });

  it('computes per-leg stats for a pattern without wind', () => {
    const path = makePattern();
    const stats = calculatePathStats(path, path);

    expect(stats.legs).toHaveLength(2);
    expect(stats.manoeuvre).toBeNull();

    const [leg0, leg1] = stats.legs;

    // Leg 0: from the target (0,0,alt 0) up to the first POM (0.001,0,alt 100)
    expect(leg0.legIndex).toBe(0);
    expect(leg0.altTop).toBe(100);
    expect(leg0.altBottom).toBe(0);
    expect(leg0.timeSec).toBeCloseTo(10, 5);
    // Direction of travel is end→start: due south
    expect(leg0.heading).toBeCloseTo(180, 1);
    expect(leg0.bearing).toBeCloseTo(180, 1);
    expect(leg0.distance).toBeCloseTo(DEG_001_FT, 0);
    expect(leg0.glideRatio).toBeCloseTo(DEG_001_FT / 100, 2);
    expect(leg0.windDriftDist).toBe(0);
    expect(leg0.windDriftDir).toBe(0);

    // Leg 1: from (0.001,0,alt 100) to (0.001,0.001,alt 200), travel due west
    expect(leg1.legIndex).toBe(1);
    expect(leg1.altTop).toBe(200);
    expect(leg1.altBottom).toBe(100);
    expect(leg1.timeSec).toBeCloseTo(10, 5);
    expect(leg1.heading).toBeCloseTo(270, 1);
    expect(leg1.bearing).toBeCloseTo(270, 1);
    expect(leg1.distance).toBeCloseTo(DEG_001_FT, 0);
  });

  it('maps pattern points to their legs and manoeuvre points to -1', () => {
    const path = [...makePattern(), ...makeManoeuvre()];
    const stats = calculatePathStats(path, path);

    // Pattern points: leg boundaries are POMs; the boundary POM closes the leg
    expect(stats.pointToSegment.get(0)).toBe(0);
    expect(stats.pointToSegment.get(1)).toBe(0);
    expect(stats.pointToSegment.get(2)).toBe(0);
    expect(stats.pointToSegment.get(3)).toBe(1);

    // Manoeuvre points map to -1
    expect(stats.pointToSegment.get(4)).toBe(-1);
    expect(stats.pointToSegment.get(5)).toBe(-1);
    expect(stats.pointToSegment.get(6)).toBe(-1);
  });

  it('computes wind drift from the pre/post-wind position shift', () => {
    const preWind = makePattern();
    // Shift the leg-0 end (and everything above) east by 0.0005°; target fixed
    const postWind = makePattern().map((p, i) =>
      i >= 2 ? { ...p, lng: p.lng + 0.0005 } : p
    );

    const stats = calculatePathStats(preWind, postWind);

    expect(stats.legs).toHaveLength(2);
    const [leg0, leg1] = stats.legs;

    // Leg 0: end shifted 0.0005° east relative to start → drift due east
    expect(leg0.windDriftDir).toBeCloseTo(90, 1);
    expect(leg0.windDriftDist).toBeCloseTo(DEG_001_FT / 2, 0);

    // Leg 1: both ends shifted equally → no per-leg drift
    expect(leg1.windDriftDist).toBe(0);

    // heading comes from the pre-wind path, bearing from the post-wind path
    expect(leg0.heading).toBeCloseTo(180, 1);
    expect(leg0.bearing).not.toBeCloseTo(180, 1);
  });

  it('computes manoeuvre stats (time, bearings, depth/offset distances)', () => {
    const path = [...makePattern(), ...makeManoeuvre()];
    const stats = calculatePathStats(path, path);

    expect(stats.manoeuvre).not.toBeNull();
    const m = stats.manoeuvre!;

    expect(m.timeSec).toBeCloseTo(5, 5);
    expect(m.initialBearing).toBeCloseTo(0, 1);
    expect(m.finalBearing).toBeCloseTo(90, 1);

    // First→last is 45° off the final bearing → equal X/Y projections
    expect(m.distanceX).toBeCloseTo(DEG_001_FT / 2, 0);
    expect(m.distanceY).toBeCloseTo(DEG_001_FT / 2, 0);

    expect(m.windDriftDist).toBe(0);
  });

  it('requires at least 2 manoeuvre points for manoeuvre stats', () => {
    const path = [...makePattern(), makeManoeuvre()[0]];
    const stats = calculatePathStats(path, path);

    expect(stats.manoeuvre).toBeNull();
  });
});

describe('getPointSegmentStats', () => {
  const path = [...makePattern(), ...makeManoeuvre()];
  const stats = calculatePathStats(path, path);

  it('returns leg stats for pattern points', () => {
    const result = getPointSegmentStats(0, stats);

    expect(result?.type).toBe('leg');
    if (result?.type === 'leg') {
      expect(result.stats.legIndex).toBe(0);
    }
  });

  it('returns manoeuvre stats for manoeuvre points', () => {
    const result = getPointSegmentStats(4, stats);

    expect(result?.type).toBe('manoeuvre');
  });

  it('returns null for unknown point indices', () => {
    expect(getPointSegmentStats(99, stats)).toBeNull();
  });
});
