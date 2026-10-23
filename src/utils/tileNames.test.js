import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { tileKeyId } from "./tileNames";

const HEADER = "emote_id,image_id,image_ext,name,variant_of,artist,credit,type,source,tags\n";
const DOKI_CSV = HEADER + 'dead,GjZh,.png,Dead,,Maerie @maeriette,https://x.com/m,static,official,"rip, dead"\n';
const MINT_CSV = HEADER + "boo,MnTa,.gif,Boo,,Some Artist,,animated,official,boo\n";

// loadTileNames caches per CSV at module level, so each test gets a fresh copy.
const freshLoadTileNames = async () => {
    vi.resetModules();
    return (await import("./tileNames")).loadTileNames;
};

const csvResponse = (text) => Promise.resolve({ ok: true, text: () => Promise.resolve(text) });
const notFound = () => Promise.resolve({ ok: false, status: 404 });

describe("tileKeyId", () => {
    it("strips the directory and extension", () => {
        expect(tileKeyId("dokimotes/3YMxyz.png")).toBe("3YMxyz");
        expect(tileKeyId("abc.gif")).toBe("abc");
        expect(tileKeyId("noext")).toBe("noext");
    });
});

describe("loadTileNames", () => {
    let fetchMock;

    beforeEach(() => {
        fetchMock = vi.fn((url) => {
            if (url.endsWith("/dokimotes/emotes.csv")) return csvResponse(DOKI_CSV);
            if (url.endsWith("/mintomotes/emotes.csv")) return csvResponse(MINT_CSV);
            return notFound();
        });
        vi.stubGlobal("fetch", fetchMock);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("maps image_id to name and artist", async () => {
        const loadTileNames = await freshLoadTileNames();
        const map = await loadTileNames();
        expect(map.get("GjZh")).toEqual({ name: "Dead", artist: "Maerie @maeriette" });
    });

    it("merges every palette's emotes.csv", async () => {
        const loadTileNames = await freshLoadTileNames();
        const map = await loadTileNames();
        expect(fetchMock).toHaveBeenCalledWith("https://content.duck-automata.com/dokimotes/emotes.csv");
        expect(fetchMock).toHaveBeenCalledWith("https://content.duck-automata.com/mintomotes/emotes.csv");
        expect(map.get("GjZh")?.name).toBe("Dead");
        expect(map.get("MnTa")).toEqual({ name: "Boo", artist: "Some Artist" });
    });

    it("keeps the other palettes when one CSV is missing", async () => {
        fetchMock.mockImplementation((url) => (url.includes("/mintomotes/") ? notFound() : csvResponse(DOKI_CSV)));
        const loadTileNames = await freshLoadTileNames();
        const map = await loadTileNames();
        expect(map.get("GjZh")?.name).toBe("Dead");
        expect(map.has("MnTa")).toBe(false);
    });

    it("keeps the other palettes when one fetch rejects, and retries only that one", async () => {
        fetchMock.mockImplementation((url) =>
            url.includes("/mintomotes/") ? Promise.reject(new Error("offline")) : csvResponse(DOKI_CSV),
        );
        const loadTileNames = await freshLoadTileNames();
        expect((await loadTileNames()).get("GjZh")?.name).toBe("Dead");

        fetchMock.mockClear();
        fetchMock.mockImplementation((url) => csvResponse(url.includes("/mintomotes/") ? MINT_CSV : DOKI_CSV));
        const map = await loadTileNames();
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(fetchMock).toHaveBeenCalledWith("https://content.duck-automata.com/mintomotes/emotes.csv");
        expect(map.get("GjZh")?.name).toBe("Dead");
        expect(map.get("MnTa")?.name).toBe("Boo");
    });
});
