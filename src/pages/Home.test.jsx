import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const processMock = vi.hoisted(() => vi.fn());

vi.mock("../mosaic/useMosaicWorker", () => ({
    useMosaicWorker: () => ({
        status: "idle",
        stage: "",
        startedAt: 0,
        result: null,
        error: null,
        process: processMock,
        exportMosaic: vi.fn(),
        cancel: vi.fn(),
        reset: vi.fn(),
    }),
}));

const fakeBitmap = { width: 10, height: 10, close: () => {} };
vi.mock("../utils/imageLoad", () => ({
    loadFromBlob: vi.fn(),
    loadFromUrl: () => Promise.resolve({ bitmap: fakeBitmap, url: "blob:target", width: 10, height: 10, name: "x" }),
}));

const TODAY_COPY =
    "Turn any image into a mosaic built from Doki's emotes. Drop a picture below, pick an algorithm, " +
    "and zoom into every tile of the result.";
const FEAT = btoa(String.fromCharCode(...new Array(8 * 8 * 3).fill(100)));
const DOKI_KEYS = ["dokimotes/aaa.png", "dokimotes/bbb.gif"];
const MINT_KEYS = ["mintomotes/ccc.png"];

// Home's manifest and tile name loaders cache at module level, so each test
// renders a fresh copy against its own manifest. Names 404, so tiles fall back
// to their raw ids.
const renderHome = async (keys) => {
    vi.stubGlobal(
        "fetch",
        vi.fn((url) =>
            url.endsWith("/tiles.json")
                ? Promise.resolve({
                      ok: true,
                      json: () =>
                          Promise.resolve({ version: 1, featGrid: 8, tiles: keys.map((key) => ({ key, feat: FEAT })) }),
                  })
                : Promise.resolve({ ok: false, status: 404 }),
        ),
    );
    vi.resetModules();
    const { default: Home } = await import("./Home");
    render(<Home />);
};

const loadTarget = async () => {
    fireEvent.change(screen.getByPlaceholderText(/paste an image URL/i), {
        target: { value: "https://example.com/x.png" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Load" }));
    await screen.findByText("Mosaic options");
};

describe("Home emote palettes", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        localStorage.clear();
        processMock.mockClear();
    });

    it("keeps today's copy and shows no picker for a Doki-only manifest", async () => {
        await renderHome(DOKI_KEYS);
        expect(screen.getByText(/Turn any image/)).toHaveTextContent(TODAY_COPY);

        await loadTarget();
        await screen.findByText("2 / 2 tiles");
        expect(screen.queryByRole("group", { name: "Emotes" })).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "Create Mosaic" }));
        expect(processMock).toHaveBeenCalledWith(fakeBitmap, "grid", expect.any(Object), new Set(), "doki");
    });

    it("defaults to Doki, remembers the choice and keeps the target image", async () => {
        await renderHome([...DOKI_KEYS, ...MINT_KEYS]);
        expect(screen.getByText(/Turn any image/)).toHaveTextContent(TODAY_COPY);

        await loadTarget();
        await screen.findByRole("group", { name: "Emotes" });
        expect(screen.getByRole("button", { name: "Doki" })).toHaveAttribute("aria-pressed", "true");
        expect(screen.getByText("2 / 2 tiles")).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "Mint" }));
        expect(localStorage.getItem("dokimosaic-palette")).toBe("mint");
        expect(screen.getByText("1 / 1 tiles")).toBeInTheDocument();
        expect(screen.getByText("Target image")).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "Create Mosaic" }));
        expect(processMock).toHaveBeenCalledWith(fakeBitmap, "grid", expect.any(Object), new Set(), "mint");
    });

    it("keeps tile filter exclusions across palette switches", async () => {
        await renderHome([...DOKI_KEYS, ...MINT_KEYS]);
        await loadTarget();
        await screen.findByRole("group", { name: "Emotes" });

        fireEvent.click(screen.getByRole("button", { name: /Tile filter/i }));
        fireEvent.click(screen.getByRole("button", { name: "aaa" }));
        expect(screen.getByText("1 / 2 tiles")).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "Mint" }));
        expect(screen.getByText("1 / 1 tiles")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Both" }));
        expect(screen.getByText("2 / 3 tiles")).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "Create Mosaic" }));
        expect(processMock).toHaveBeenCalledWith(
            fakeBitmap,
            "grid",
            expect.any(Object),
            new Set(["dokimotes/aaa.png"]),
            "both",
        );
    });

    it("names both streamers for a remembered Both choice", async () => {
        localStorage.setItem("dokimosaic-palette", "both");
        await renderHome([...DOKI_KEYS, ...MINT_KEYS]);
        expect(screen.getByText(/Turn any image/)).toHaveTextContent(/built from Doki's and Mint's emotes\./);
    });
});
