import { describe, expect, it } from "vitest";
import { centerSquare, FEAT_GRID, featurePatch } from "./tileFeatures.mjs";

/** Build side*side RGBA bytes from a fill function (x, y) -> [r,g,b,a]. */
const makeImage = (side, fill) => {
    const data = new Uint8Array(side * side * 4);
    for (let y = 0; y < side; y++)
        for (let x = 0; x < side; x++) {
            data.set(fill(x, y), (y * side + x) * 4);
        }
    return data;
};

describe("centerSquare", () => {
    it("crops the largest centered square", () => {
        expect(centerSquare(96, 96)).toEqual([0, 0, 96]);
        expect(centerSquare(100, 60)).toEqual([20, 0, 60]);
        expect(centerSquare(60, 100)).toEqual([0, 20, 60]);
        expect(centerSquare(101, 60)).toEqual([20, 0, 60]);
    });
});

describe("featurePatch", () => {
    it("returns the flat color for a solid opaque image", () => {
        const patch = featurePatch(
            makeImage(16, () => [10, 200, 30, 255]),
            16,
        );
        expect(patch).toHaveLength(FEAT_GRID * FEAT_GRID * 3);
        for (let i = 0; i < patch.length; i += 3) {
            expect([patch[i], patch[i + 1], patch[i + 2]]).toEqual([10, 200, 30]);
        }
    });

    it("returns null for a fully transparent image", () => {
        expect(
            featurePatch(
                makeImage(8, () => [255, 0, 0, 0]),
                8,
            ),
        ).toBeNull();
    });

    it("composites transparent pixels over the alpha-weighted mean", () => {
        // Left half solid red, right half fully transparent: the mean is
        // red, so transparent cells composite to red too.
        const patch = featurePatch(
            makeImage(16, (x) => (x < 8 ? [200, 0, 0, 255] : [0, 0, 255, 0])),
            16,
        );
        for (let i = 0; i < patch.length; i += 3) {
            expect([patch[i], patch[i + 1], patch[i + 2]]).toEqual([200, 0, 0]);
        }
    });

    it("box-averages each cell independently", () => {
        // 16x16 with left half black, right half white -> left patch
        // columns 0, right patch columns 255.
        const patch = featurePatch(
            makeImage(16, (x) => (x < 8 ? [0, 0, 0, 255] : [255, 255, 255, 255])),
            16,
        );
        for (let cy = 0; cy < FEAT_GRID; cy++)
            for (let cx = 0; cx < FEAT_GRID; cx++) {
                const i = (cy * FEAT_GRID + cx) * 3;
                expect(patch[i]).toBe(cx < 4 ? 0 : 255);
            }
    });

    it("handles sides that do not divide evenly by the grid", () => {
        // 10x10 solid gray: fractional cell edges must still average to gray.
        const patch = featurePatch(
            makeImage(10, () => [128, 128, 128, 255]),
            10,
        );
        for (let i = 0; i < patch.length; i++) expect(patch[i]).toBe(128);
    });

    it("weights the mean color by alpha", () => {
        // Half-transparent white over solid black: mean is weighted toward
        // the more opaque black pixels.
        const patch = featurePatch(
            makeImage(16, (x) => (x < 8 ? [0, 0, 0, 255] : [255, 255, 255, 51])),
            16,
        );
        // mean = 255 * 51*128 / (255*128 + 51*128) = 255 * 51/306 = 42.5
        // right cells: (255*51 + 42.5*(255-51)) / 255 = 85
        const i = (0 * FEAT_GRID + 7) * 3;
        expect(patch[i]).toBeGreaterThan(80);
        expect(patch[i]).toBeLessThan(90);
        expect(patch[0]).toBeLessThan(45); // left cells pull toward black+mean
    });
});
