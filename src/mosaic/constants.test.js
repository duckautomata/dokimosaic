import { describe, expect, it } from "vitest";
import {
    clampCanvasSize,
    MAX_CANVAS_AREA,
    MAX_CANVAS_SIDE,
    tileOriginalUrl,
    tilePreviewUrl,
    tileThumbUrl,
} from "./constants";

describe("clampCanvasSize", () => {
    it("keeps small sizes untouched", () => {
        expect(clampCanvasSize(800, 600)).toEqual({ width: 800, height: 600, clamped: false });
    });

    it("clamps the longest side", () => {
        const r = clampCanvasSize(MAX_CANVAS_SIDE * 2, 100);
        expect(r.clamped).toBe(true);
        expect(r.width).toBeLessThanOrEqual(MAX_CANVAS_SIDE);
        expect(r.width / r.height).toBeCloseTo((MAX_CANVAS_SIDE * 2) / 100, 0);
    });

    it("clamps total area preserving aspect ratio", () => {
        const r = clampCanvasSize(12000, 12000);
        expect(r.clamped).toBe(true);
        expect(r.width * r.height).toBeLessThanOrEqual(MAX_CANVAS_AREA * 1.01);
        expect(r.width).toBe(r.height);
    });
});

describe("tile URL variants", () => {
    it("swaps the extension for the preview/thumb suffix", () => {
        expect(tilePreviewUrl("dokimotes/abc.png")).toBe("https://content.duck-automata.com/dokimotes/abc_p.webp");
        expect(tileThumbUrl("dokimotes/abc.gif")).toBe("https://content.duck-automata.com/dokimotes/abc_t.webp");
        expect(tileOriginalUrl("dokimotes/abc.png")).toBe("https://content.duck-automata.com/dokimotes/abc.png");
    });

    it("handles keys without an extension or with dotted directories", () => {
        expect(tilePreviewUrl("dokimotes/noext")).toBe("https://content.duck-automata.com/dokimotes/noext_p.webp");
        expect(tilePreviewUrl("v1.2/abc.png")).toBe("https://content.duck-automata.com/v1.2/abc_p.webp");
        expect(tilePreviewUrl("v1.2/noext")).toBe("https://content.duck-automata.com/v1.2/noext_p.webp");
    });
});
