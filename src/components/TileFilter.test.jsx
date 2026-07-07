import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import TileFilter from "./TileFilter";

const TILES = [
    { key: "dokimotes/aaa.png", name: "Dead" },
    { key: "dokimotes/bbb.png", name: "Map" },
    { key: "dokimotes/ccc.png", name: "Run" },
];

const setup = (overrides = {}) => {
    const props = {
        tiles: TILES,
        excluded: new Set(),
        onChange: vi.fn(),
        disabled: false,
        ...overrides,
    };
    render(<TileFilter {...props} />);
    return props;
};

const expand = () => fireEvent.click(screen.getByRole("button", { name: /Tile filter/i }));

describe("TileFilter", () => {
    it("shows the full count and starts collapsed", () => {
        setup();
        expect(screen.getByText("3 / 3 tiles")).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Dead" })).not.toBeInTheDocument();
    });

    it("excludes a tile on click", () => {
        const props = setup();
        expand();
        fireEvent.click(screen.getByRole("button", { name: "Dead" }));
        expect(props.onChange).toHaveBeenCalledWith(new Set(["dokimotes/aaa.png"]));
    });

    it("re-includes an excluded tile on click", () => {
        const props = setup({ excluded: new Set(["dokimotes/aaa.png"]) });
        expand();
        expect(screen.getByText("2 / 3 tiles")).toBeInTheDocument();
        const tile = screen.getByRole("button", { name: "Dead" });
        expect(tile).toHaveAttribute("aria-pressed", "false");
        expect(tile).toHaveAttribute("title", "Dead (excluded)");
        fireEvent.click(tile);
        expect(props.onChange).toHaveBeenCalledWith(new Set());
    });

    it("resets the filter back to all tiles", () => {
        const props = setup({ excluded: new Set(["dokimotes/aaa.png", "dokimotes/bbb.png"]) });
        expand();
        fireEvent.click(screen.getByRole("button", { name: "Reset" }));
        expect(props.onChange).toHaveBeenCalledWith(new Set());
    });

    it("disables reset when nothing is filtered", () => {
        setup();
        expand();
        expect(screen.getByRole("button", { name: "Reset" })).toBeDisabled();
    });

    it("disables all tiles at once for whitelisting", () => {
        const props = setup();
        expand();
        fireEvent.click(screen.getByRole("button", { name: "Disable all" }));
        expect(props.onChange).toHaveBeenCalledWith(new Set(TILES.map((t) => t.key)));
    });

    it("re-enables all tiles when everything is excluded", () => {
        const props = setup({ excluded: new Set(TILES.map((t) => t.key)) });
        expand();
        fireEvent.click(screen.getByRole("button", { name: "Enable all" }));
        expect(props.onChange).toHaveBeenCalledWith(new Set());
    });

    it("still offers Disable all when partially filtered", () => {
        const props = setup({ excluded: new Set(["dokimotes/aaa.png"]) });
        expand();
        fireEvent.click(screen.getByRole("button", { name: "Disable all" }));
        expect(props.onChange).toHaveBeenCalledWith(new Set(TILES.map((t) => t.key)));
    });

    it("filters the grid by search", () => {
        setup();
        expand();
        fireEvent.change(screen.getByLabelText("Search tiles"), { target: { value: "ma" } });
        expect(screen.getByRole("button", { name: "Map" })).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Dead" })).not.toBeInTheDocument();
    });

    it("warns when every tile is excluded", () => {
        setup({ excluded: new Set(TILES.map((t) => t.key)) });
        expand();
        expect(screen.getByText(/Every tile is excluded/i)).toBeInTheDocument();
    });
});
