import { describe, expect, it } from "vitest";
import { decodeManifest } from "./manifest";

const encodeFeat = (bytes) => btoa(String.fromCharCode(...bytes));

describe("decodeManifest", () => {
    it("decodes features and computes the mean color", () => {
        // 2x2 grid, RGB interleaved: all pixels (10, 20, 30)
        const bytes = [];
        for (let i = 0; i < 4; i++) bytes.push(10, 20, 30);
        const tiles = decodeManifest({
            version: 1,
            featGrid: 2,
            tiles: [{ key: "dokimotes/abc.png", feat: encodeFeat(bytes) }],
        });

        expect(tiles).toHaveLength(1);
        expect(tiles[0].key).toBe("dokimotes/abc.png");
        expect(tiles[0].F).toBe(2);
        expect(tiles[0].feat).toHaveLength(12);
        expect(tiles[0].mean).toEqual([10, 20, 30]);
    });

    it("averages mixed pixels", () => {
        const bytes = [0, 0, 0, 100, 200, 50];
        const [t] = decodeManifest({
            version: 1,
            featGrid: 1, // not used for length; feat length drives everything
            tiles: [{ key: "x.png", feat: encodeFeat(bytes) }],
        });
        expect(t.mean).toEqual([50, 100, 25]);
    });
});
