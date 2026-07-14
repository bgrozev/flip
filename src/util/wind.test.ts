import { WindRow, Winds } from './wind';

describe('WindRow', () => {
  describe('constructor', () => {
    it('creates a wind row with numeric values', () => {
      const row = new WindRow(1000, 270, 15);

      expect(row.altFt).toBe(1000);
      expect(row.direction).toBe(270);
      expect(row.speedKts).toBe(15);
    });

    it('converts string values to numbers', () => {
      const row = new WindRow('2000' as any, '180' as any, '25' as any);

      expect(row.altFt).toBe(2000);
      expect(row.direction).toBe(180);
      expect(row.speedKts).toBe(25);
    });
  });

  describe('copy', () => {
    it('creates an independent copy', () => {
      const original = new WindRow(1000, 270, 15);
      const copy = original.copy();

      expect(copy.altFt).toBe(1000);
      expect(copy.direction).toBe(270);
      expect(copy.speedKts).toBe(15);

      // Modify original, copy should be unaffected
      original.altFt = 5000;
      expect(copy.altFt).toBe(1000);
    });
  });
});

describe('Winds', () => {
  describe('constructor', () => {
    it('creates winds with default values', () => {
      const winds = new Winds();

      expect(winds.winds).toHaveLength(1);
      expect(winds.winds[0].altFt).toBe(0);
      expect(winds.winds[0].direction).toBe(0);
      expect(winds.winds[0].speedKts).toBe(0);
    });

    it('creates winds with provided values', () => {
      const rows = [
        new WindRow(0, 90, 5),
        new WindRow(1000, 180, 10)
      ];
      const winds = new Winds(rows);

      expect(winds.winds).toHaveLength(2);
    });

    it('stores center location', () => {
      const center = { lat: 33.5, lng: -112.0 };
      const winds = new Winds([], center);

      expect(winds.center).toEqual(center);
    });
  });

  describe('createDefault', () => {
    it('creates a winds instance with default wind row', () => {
      const winds = Winds.createDefault();

      expect(winds.winds).toHaveLength(1);
      expect(winds.winds[0].altFt).toBe(0);
      expect(winds.winds[0].direction).toBe(0);
      expect(winds.winds[0].speedKts).toBe(0);
    });
  });

  describe('copy', () => {
    it('creates an independent copy of winds', () => {
      const original = new Winds([
        new WindRow(0, 90, 5),
        new WindRow(1000, 180, 10)
      ]);
      original.groundSource = 'open-meteo';
      original.aloftSource = 'open-meteo';

      const copy = Winds.copy(original);

      expect(copy.winds).toHaveLength(2);
      expect(copy.groundSource).toBe('open-meteo');
      expect(copy.aloftSource).toBe('open-meteo');

      // Modify original, copy should be unaffected
      original.winds[0].speedKts = 999;
      expect(copy.winds[0].speedKts).toBe(5);
    });
  });

  describe('addRow', () => {
    it('appends a wind row', () => {
      const winds = new Winds([new WindRow(0, 0, 0)]);

      winds.addRow(new WindRow(1000, 180, 15));
      expect(winds.winds).toHaveLength(2);
      expect(winds.winds[1].altFt).toBe(1000);
    });
  });

  describe('setGroundWind', () => {
    it('replaces the first row when winds exist', () => {
      const winds = new Winds([
        new WindRow(0, 90, 5),
        new WindRow(1000, 180, 10)
      ]);

      winds.setGroundWind(new WindRow(0, 270, 8));
      expect(winds.winds[0].direction).toBe(270);
      expect(winds.winds[0].speedKts).toBe(8);
      expect(winds.winds).toHaveLength(2);
    });

    it('adds a row when winds array is empty', () => {
      const winds = new Winds([]);

      winds.setGroundWind(new WindRow(0, 270, 8));
      expect(winds.winds).toHaveLength(1);
      expect(winds.winds[0].direction).toBe(270);
    });
  });

  describe('getWindAt', () => {
    let winds: Winds;

    beforeEach(() => {
      winds = new Winds([
        new WindRow(0, 90, 5),
        new WindRow(1000, 180, 10),
        new WindRow(3000, 270, 20)
      ]);
    });

    it('returns default wind for empty winds array', () => {
      const emptyWinds = new Winds([]);
      const wind = emptyWinds.getWindAt(500, false);

      expect(wind.altFt).toBe(0);
      expect(wind.direction).toBe(0);
      expect(wind.speedKts).toBe(0);
    });

    it('returns exact match without interpolation', () => {
      const wind = winds.getWindAt(1000, false);

      expect(wind.altFt).toBe(1000);
      expect(wind.direction).toBe(180);
      expect(wind.speedKts).toBe(10);
    });

    it('returns lower bracket without interpolation', () => {
      const wind = winds.getWindAt(2000, false);

      expect(wind.altFt).toBe(1000);
      expect(wind.direction).toBe(180);
      expect(wind.speedKts).toBe(10);
    });

    it('returns first wind when altitude is below all rows', () => {
      winds = new Winds([
        new WindRow(500, 90, 5),
        new WindRow(1000, 180, 10)
      ]);
      const wind = winds.getWindAt(100, false);

      expect(wind.altFt).toBe(500);
    });

    it('returns highest wind when altitude is above all rows', () => {
      const wind = winds.getWindAt(5000, false);

      expect(wind.altFt).toBe(3000);
      expect(wind.direction).toBe(270);
    });

    describe('interpolation', () => {
      // Interpolation blends the wind vector (u/v components), not
      // direction/speed independently: between 180°@10 and 270°@20 the
      // vectors sum to u=10, v=5 at the midpoint, giving a direction
      // biased toward the stronger wind and a speed below the linear
      // average (the perpendicular components partially cancel).
      it('interpolates the wind vector at midpoint', () => {
        const wind = winds.getWindAt(2000, true);

        expect(wind.altFt).toBe(2000);
        expect(wind.direction).toBeCloseTo(243.43494882292202, 9);
        expect(wind.speedKts).toBeCloseTo(11.180339887498949, 9); // sqrt(125)
      });

      it('interpolates the wind vector at quarter point', () => {
        const wind = winds.getWindAt(1500, true);

        expect(wind.altFt).toBe(1500);
        expect(wind.direction).toBeCloseTo(213.69006752597977, 9);
        expect(wind.speedKts).toBeCloseTo(9.013878188659973, 9); // sqrt(81.25)
      });

      it('interpolates speed linearly when directions are equal', () => {
        const testWinds = new Winds([
          new WindRow(0, 135, 5),
          new WindRow(1000, 135, 15)
        ]);
        const wind = testWinds.getWindAt(500, true);

        expect(wind.direction).toBeCloseTo(135, 9);
        expect(wind.speedKts).toBeCloseTo(10, 9);
      });

      it('falls back to lower bracket when no higher bracket exists', () => {
        const wind = winds.getWindAt(5000, true);

        expect(wind.altFt).toBe(3000);
        expect(wind.direction).toBe(270);
      });

      it('normalizes direction to 0-360 range', () => {
        const testWinds = new Winds([
          new WindRow(0, 350, 5),
          new WindRow(1000, 10, 10)
        ]);

        // This tests direction handling - should handle wrap-around
        const wind = testWinds.getWindAt(500, true);

        expect(wind.direction).toBeGreaterThanOrEqual(0);
        expect(wind.direction).toBeLessThan(360);
      });

      /** Angular distance between two directions in degrees (0..180). */
      function angularDiff(a: number, b: number): number {
        return Math.abs(((a - b + 540) % 360) - 180);
      }

      it('wraps across north going 350 -> 10', () => {
        const testWinds = new Winds([
          new WindRow(0, 350, 5),
          new WindRow(1000, 10, 10)
        ]);
        const wind = testWinds.getWindAt(500, true);

        // Shortest arc passes through 0, biased toward the stronger row
        expect(angularDiff(wind.direction, 0)).toBeLessThan(10);
        expect(wind.direction).toBeCloseTo(3.36, 1);
        // Slightly below the linear average of the speeds (7.5)
        expect(wind.speedKts).toBeCloseTo(7.4, 1);
        expect(wind.speedKts).toBeLessThan(7.5);
      });

      it('wraps across north going 10 -> 350', () => {
        const testWinds = new Winds([
          new WindRow(0, 10, 10),
          new WindRow(1000, 350, 10)
        ]);
        const wind = testWinds.getWindAt(500, true);

        // Equal speeds: midpoint direction is due north
        expect(angularDiff(wind.direction, 0)).toBeCloseTo(0, 9);
        expect(wind.speedKts).toBeLessThan(10);
        expect(wind.speedKts).toBeGreaterThan(9.8);
      });

      it('partially cancels opposing winds (vector, not linear)', () => {
        const testWinds = new Winds([
          new WindRow(0, 0, 10),
          new WindRow(1000, 180, 20)
        ]);
        const wind = testWinds.getWindAt(500, true);

        // 10 kts from 0 and 20 kts from 180 average to 5 kts from 180 —
        // far below the linear speed average (15). This cancellation is
        // correct and desired.
        expect(wind.direction).toBeCloseTo(180, 9);
        expect(wind.speedKts).toBeCloseTo(5, 9);
      });
    });
  });
});
