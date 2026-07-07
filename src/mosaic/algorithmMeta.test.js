import { describe, expect, it } from "vitest";
import { ALGORITHM_MAP, ALGORITHMS, COMMON_PARAMS, defaultParams } from "./algorithmMeta";

describe("algorithmMeta", () => {
    it("defines all nine algorithms", () => {
        expect(ALGORITHMS.map((a) => a.id)).toEqual([
            "grid",
            "blend",
            "dither",
            "quadtree",
            "voronoi",
            "superpixel",
            "hex",
            "scatter",
            "fractal",
        ]);
    });

    it("gives every param complete metadata", () => {
        for (const algo of ALGORITHMS) {
            expect(algo.name).toBeTruthy();
            expect(algo.description).toBeTruthy();
            for (const p of algo.params) {
                expect(p.key, `${algo.id}.${p.key}`).toBeTruthy();
                expect(p.label).toBeTruthy();
                expect(["range", "int"]).toContain(p.kind);
                expect(p.default).toBeGreaterThanOrEqual(p.min);
                expect(p.default).toBeLessThanOrEqual(p.max);
            }
        }
    });

    it("builds default params per algorithm", () => {
        expect(defaultParams("grid")).toMatchObject({ cells: 50, variety: 3, seed: 0 });
        expect(defaultParams("blend").blendStrength).toBe(0.55);
        expect(defaultParams("nope")).toEqual({});
    });

    it("includes common options in every algorithm's defaults", () => {
        expect(COMMON_PARAMS.map((p) => p.key)).toContain("preserveTransparency");
        for (const algo of ALGORITHMS) {
            expect(defaultParams(algo.id).preserveTransparency).toBe(true);
        }
    });

    it("indexes algorithms by id", () => {
        expect(ALGORITHM_MAP.get("voronoi").name).toBe("Voronoi");
    });
});
