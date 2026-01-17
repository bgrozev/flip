import { WindRow, Winds } from './wind.js';

describe('WindRow', () => {
    describe('constructor', () => {
        it('creates a wind row with numeric values', () => {
            const row = new WindRow(1000, 270, 15);

            expect(row.altFt).toBe(1000);
            expect(row.direction).toBe(270);
            expect(row.speedKts).toBe(15);
        });

        it('converts string values to numbers', () => {
            const row = new WindRow('2000', '180', '25');

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

    describe('addRow', () => {
        it('appends a wind row', () => {
            const winds = new Winds([ new WindRow(0, 0, 0) ]);

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
        let winds;

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
            it('interpolates direction and speed at midpoint', () => {
                const wind = winds.getWindAt(2000, true);

                expect(wind.altFt).toBe(2000);
                expect(wind.direction).toBe(225); // midpoint of 180 and 270
                expect(wind.speedKts).toBe(15); // midpoint of 10 and 20
            });

            it('interpolates at quarter point', () => {
                const wind = winds.getWindAt(1500, true);

                expect(wind.altFt).toBe(1500);
                expect(wind.direction).toBeCloseTo(202.5); // 180 + 0.25*(270-180)
                expect(wind.speedKts).toBeCloseTo(12.5); // 10 + 0.25*(20-10)
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
        });
    });
});
