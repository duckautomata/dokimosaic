import { describe, expect, it, vi } from "vitest";
import { loadTileNames, tileKeyId } from "./tileNames";

describe("tileKeyId", () => {
    it("strips the directory and extension", () => {
        expect(tileKeyId("dokimotes/3YMxyz.png")).toBe("3YMxyz");
        expect(tileKeyId("abc.gif")).toBe("abc");
        expect(tileKeyId("noext")).toBe("noext");
    });
});

describe("loadTileNames", () => {
    it("maps image_id to name and artist", async () => {
        const csv =
            "emote_id,image_id,image_ext,name,variant_of,artist,credit,type,source,tags\n" +
            'dead,GjZh,.png,Dead,,Maerie @maeriette,https://x.com/m,static,official,"rip, dead"\n';
        vi.stubGlobal(
            "fetch",
            vi.fn(() => Promise.resolve({ ok: true, text: () => Promise.resolve(csv) })),
        );

        const map = await loadTileNames();
        expect(map.get("GjZh")).toEqual({ name: "Dead", artist: "Maerie @maeriette" });

        vi.unstubAllGlobals();
    });
});
