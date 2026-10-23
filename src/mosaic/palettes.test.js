import { afterEach, describe, expect, it, vi } from "vitest";
import {
    ALL_PALETTES,
    effectiveExclusion,
    inPalette,
    paletteLabels,
    paletteOptions,
    presentPalettes,
    readStoredPalette,
    replaceListedExclusions,
    resolvePalette,
    showPalettePicker,
    storePalette,
    tilePalette,
} from "./palettes";

const DOKI = ["dokimotes/aaa.png", "dokimotes/bbb.gif"];
const MINT = ["mintomotes/ccc.png", "mintomotes/ddd.gif"];
const OTHER = ["legacy/eee.png"];

describe("tilePalette", () => {
    it("derives the palette from the key prefix", () => {
        expect(tilePalette("dokimotes/aaa.png")).toBe("doki");
        expect(tilePalette("mintomotes/ccc.gif")).toBe("mint");
    });

    it("returns null for keys outside every palette", () => {
        expect(tilePalette("legacy/eee.png")).toBeNull();
        expect(tilePalette("dokimotesx/aaa.png")).toBeNull();
        expect(tilePalette("aaa.png")).toBeNull();
    });
});

describe("presentPalettes", () => {
    it("lists palettes with tiles in a stable order", () => {
        expect(presentPalettes([...MINT, ...OTHER, ...DOKI])).toEqual(["doki", "mint"]);
        expect(presentPalettes([...DOKI, ...OTHER])).toEqual(["doki"]);
        expect(presentPalettes([])).toEqual([]);
    });
});

describe("picker visibility", () => {
    it("stays hidden until two palettes have tiles", () => {
        expect(showPalettePicker(presentPalettes(DOKI))).toBe(false);
        expect(showPalettePicker(presentPalettes([...DOKI, ...OTHER]))).toBe(false);
        expect(showPalettePicker(presentPalettes([...DOKI, ...MINT]))).toBe(true);
    });

    it("offers no options while hidden, each palette plus Both once shown", () => {
        expect(paletteOptions(["doki"])).toEqual([]);
        expect(paletteOptions(["doki", "mint"])).toEqual([
            { id: "doki", label: "Doki" },
            { id: "mint", label: "Mint" },
            { id: ALL_PALETTES, label: "Both" },
        ]);
    });
});

describe("resolvePalette", () => {
    it("keeps a choice that has tiles", () => {
        expect(resolvePalette("mint", ["doki", "mint"])).toBe("mint");
        expect(resolvePalette(ALL_PALETTES, ["doki", "mint"])).toBe(ALL_PALETTES);
    });

    it("falls back to Doki for a choice without tiles", () => {
        expect(resolvePalette("nope", ["doki", "mint"])).toBe("doki");
        expect(resolvePalette(undefined, ["doki", "mint"])).toBe("doki");
    });

    it("filters nothing by palette while the picker is hidden", () => {
        expect(resolvePalette("mint", ["doki"])).toBe(ALL_PALETTES);
        expect(resolvePalette("doki", [])).toBe(ALL_PALETTES);
    });
});

describe("inPalette", () => {
    it("matches the selected palette and always keeps unknown prefixes", () => {
        expect(inPalette("dokimotes/aaa.png", "doki")).toBe(true);
        expect(inPalette("mintomotes/ccc.png", "doki")).toBe(false);
        expect(inPalette("legacy/eee.png", "mint")).toBe(true);
        expect(inPalette("mintomotes/ccc.png", ALL_PALETTES)).toBe(true);
    });
});

describe("effectiveExclusion", () => {
    const keys = [...DOKI, ...MINT, ...OTHER];

    it("excludes unselected palettes on top of the tile filter", () => {
        expect(effectiveExclusion(keys, "doki", ["dokimotes/aaa.png"])).toEqual(
            new Set(["dokimotes/aaa.png", ...MINT]),
        );
        expect(effectiveExclusion(keys, "mint", [])).toEqual(new Set(DOKI));
    });

    it("only applies the tile filter for Both", () => {
        expect(effectiveExclusion(keys, ALL_PALETTES, ["mintomotes/ccc.png"])).toEqual(new Set(["mintomotes/ccc.png"]));
    });

    it("leaves a single-palette manifest untouched whatever the choice", () => {
        expect(effectiveExclusion([...DOKI, ...OTHER], "mint", [])).toEqual(new Set());
    });
});

describe("replaceListedExclusions", () => {
    it("replaces exclusions for listed tiles and keeps the rest", () => {
        const excluded = new Set(["dokimotes/aaa.png", "mintomotes/ccc.png"]);
        expect(replaceListedExclusions(excluded, DOKI, new Set(["dokimotes/bbb.gif"]))).toEqual(
            new Set(["mintomotes/ccc.png", "dokimotes/bbb.gif"]),
        );
        expect(replaceListedExclusions(excluded, DOKI, new Set())).toEqual(new Set(["mintomotes/ccc.png"]));
    });
});

describe("paletteLabels", () => {
    it("follows the choice before the manifest loads", () => {
        expect(paletteLabels("doki", [])).toEqual(["Doki"]);
        expect(paletteLabels("mint", [])).toEqual(["Mint"]);
        expect(paletteLabels(ALL_PALETTES, [])).toEqual(["Doki", "Mint"]);
    });

    it("names only palettes the manifest has", () => {
        expect(paletteLabels("mint", ["doki"])).toEqual(["Doki"]);
        expect(paletteLabels(ALL_PALETTES, ["doki"])).toEqual(["Doki"]);
        expect(paletteLabels(ALL_PALETTES, ["doki", "mint"])).toEqual(["Doki", "Mint"]);
    });
});

describe("stored palette", () => {
    afterEach(() => {
        localStorage.clear();
        vi.restoreAllMocks();
    });

    it("defaults to Doki for first-time visitors", () => {
        expect(readStoredPalette()).toBe("doki");
    });

    it("round-trips a choice", () => {
        storePalette("mint");
        expect(localStorage.getItem("dokimosaic-palette")).toBe("mint");
        expect(readStoredPalette()).toBe("mint");
        storePalette(ALL_PALETTES);
        expect(readStoredPalette()).toBe(ALL_PALETTES);
    });

    it("ignores unknown stored values", () => {
        localStorage.setItem("dokimosaic-palette", "nope");
        expect(readStoredPalette()).toBe("doki");
    });

    it("survives blocked storage", () => {
        vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
            throw new Error("blocked");
        });
        vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
            throw new Error("blocked");
        });
        expect(readStoredPalette()).toBe("doki");
        expect(() => storePalette("mint")).not.toThrow();
    });
});
