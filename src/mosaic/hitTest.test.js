import { describe, expect, it } from "vitest";
import { hitTest } from "./hitTest";

describe("hitTest", () => {
    it("returns null outside the model", () => {
        const model = { type: "grid", width: 100, height: 100, cols: 2, rows: 2, cell: 50, idx: new Int32Array(4) };
        expect(hitTest(model, -1, 10)).toBeNull();
        expect(hitTest(model, 10, 100)).toBeNull();
    });

    it("maps grid cells", () => {
        const model = {
            type: "grid",
            width: 100,
            height: 100,
            cols: 2,
            rows: 2,
            cell: 50,
            idx: new Int32Array([1, 2, 3, 4]),
        };
        expect(hitTest(model, 10, 10)).toMatchObject({ tileIdx: 1, shape: { kind: "rect", x: 0, y: 0 } });
        expect(hitTest(model, 60, 10).tileIdx).toBe(2);
        expect(hitTest(model, 10, 60).tileIdx).toBe(3);
        expect(hitTest(model, 99, 99).tileIdx).toBe(4);
    });

    it("returns null for transparent (skipped) cells", () => {
        const grid = {
            type: "grid",
            width: 100,
            height: 100,
            cols: 2,
            rows: 2,
            cell: 50,
            idx: new Int32Array([-1, 2, 3, 4]),
        };
        expect(hitTest(grid, 10, 10)).toBeNull();
        expect(hitTest(grid, 60, 10).tileIdx).toBe(2);

        const quad = {
            type: "quadtree",
            width: 100,
            height: 100,
            rects: new Int32Array([0, 0, 100, 100]),
            idx: new Int32Array([-1]),
        };
        expect(hitTest(quad, 50, 50)).toBeNull();
    });

    it("finds quadtree leaves", () => {
        const model = {
            type: "quadtree",
            width: 100,
            height: 100,
            rects: new Int32Array([0, 0, 50, 50, 50, 0, 50, 100]),
            idx: new Int32Array([7, 9]),
        };
        expect(hitTest(model, 25, 25).tileIdx).toBe(7);
        expect(hitTest(model, 75, 80)).toMatchObject({ tileIdx: 9, shape: { x: 50, y: 0, w: 50, h: 100 } });
    });

    it("hit-tests hexagons at their centers", () => {
        // One hex whose bounding box starts at (0, 0).
        const model = {
            type: "hex",
            width: 100,
            height: 100,
            hexW: 20,
            hexH: 23,
            stepY: 17,
            pos: new Float32Array([0, 0]),
            idx: new Int32Array([5]),
        };
        expect(hitTest(model, 10, 11).tileIdx).toBe(5); // center
        expect(hitTest(model, 0.5, 0.5)).toBeNull(); // corner outside the hex
    });

    it("hit-tests stickers with rotation and z-order", () => {
        const model = {
            type: "scatter",
            width: 100,
            height: 100,
            // two stickers overlapping at (50, 50); the later one is on top
            data: new Float32Array([50, 50, 20, 0, 50, 50, 10, Math.PI / 4]),
            idx: new Int32Array([1, 2]),
        };
        expect(hitTest(model, 50, 50).tileIdx).toBe(2);
        expect(hitTest(model, 42, 42).tileIdx).toBe(1); // outside the small rotated one
        expect(hitTest(model, 90, 90)).toBeNull();
    });

    it("looks up label cells", () => {
        // 2x2 label map covering a 4x4 model space
        const model = {
            type: "voronoi",
            width: 4,
            height: 4,
            lw: 2,
            lh: 2,
            labels: new Int32Array([0, 0, 1, 1]),
            box: new Int32Array([0, 0, 1, 0, 0, 1, 1, 1]),
            idx: new Int32Array([3, 8]),
        };
        expect(hitTest(model, 1, 1).tileIdx).toBe(3);
        expect(hitTest(model, 1, 3)).toMatchObject({ tileIdx: 8, shape: { kind: "label", cell: 1 } });
    });
});
