import { describe, expect, it } from "vitest";
import { bestByFeat, bestByMean, pickVariety } from "./matching";
import { mulberry32 } from "./rng";

const tile = (mean, featFill = null) => ({
    mean,
    feat: new Float32Array(192).fill(featFill ?? mean[0]),
    F: 8,
});

describe("bestByMean", () => {
    const tiles = [tile([0, 0, 0]), tile([100, 100, 100]), tile([200, 200, 200])];

    it("returns the closest tile first", () => {
        expect(bestByMean(tiles, [90, 90, 90], 1)).toEqual([1]);
        expect(bestByMean(tiles, [10, 10, 10], 1)).toEqual([0]);
    });

    it("returns top-k in order", () => {
        expect(bestByMean(tiles, [140, 140, 140], 3)).toEqual([1, 2, 0]);
    });

    it("caps k at the tile count", () => {
        expect(bestByMean(tiles, [0, 0, 0], 10)).toHaveLength(3);
    });

    it("penalizes overused tiles", () => {
        const usage = new Float32Array([0, 100, 0]);
        // Tile 1 is the natural best match, but its heavy usage lets tile 2 win.
        expect(bestByMean(tiles, [120, 120, 120], 1, usage, 0.3)).toEqual([2]);
    });
});

describe("bestByFeat", () => {
    it("matches on the full patch", () => {
        const tiles = [tile([0, 0, 0], 0), tile([100, 100, 100], 100)];
        const feat = new Float32Array(192).fill(90);
        expect(bestByFeat(tiles, feat, 1)).toEqual([1]);
    });
});

describe("pickVariety", () => {
    it("always picks the only candidate", () => {
        const rng = mulberry32(1);
        expect(pickVariety([7], rng)).toBe(7);
    });

    it("only returns candidates from the list", () => {
        const rng = mulberry32(42);
        for (let i = 0; i < 100; i++) {
            expect([3, 5, 9]).toContain(pickVariety([3, 5, 9], rng));
        }
    });

    it("prefers earlier (better) candidates", () => {
        const rng = mulberry32(7);
        const counts = { 1: 0, 2: 0, 3: 0 };
        for (let i = 0; i < 3000; i++) counts[pickVariety([1, 2, 3], rng)]++;
        expect(counts[1]).toBeGreaterThan(counts[2]);
        expect(counts[2]).toBeGreaterThan(counts[3]);
    });
});

describe("mulberry32", () => {
    it("is deterministic for a given seed", () => {
        const a = mulberry32(123);
        const b = mulberry32(123);
        for (let i = 0; i < 10; i++) expect(a()).toBe(b());
    });

    it("produces values in [0, 1)", () => {
        const rng = mulberry32(0);
        for (let i = 0; i < 1000; i++) {
            const v = rng();
            expect(v).toBeGreaterThanOrEqual(0);
            expect(v).toBeLessThan(1);
        }
    });

    it("differs across seeds", () => {
        expect(mulberry32(1)()).not.toBe(mulberry32(2)());
    });
});
