import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { defaultParams } from "../mosaic/algorithmMeta";
import OptionsPanel from "./OptionsPanel";

describe("OptionsPanel", () => {
    const setup = (overrides = {}) => {
        const props = {
            algorithmId: "grid",
            params: defaultParams("grid"),
            onChange: vi.fn(),
            onSubmit: vi.fn(),
            disabled: false,
            hasResult: false,
            ...overrides,
        };
        render(<OptionsPanel {...props} />);
        return props;
    };

    it("renders the selected algorithm's parameters", () => {
        setup();
        expect(screen.getByLabelText(/Algorithm/i)).toHaveValue("grid");
        expect(screen.getByLabelText(/Cells across/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/Variety/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/Seed/i)).toBeInTheDocument();
    });

    it("switches algorithms with fresh defaults", () => {
        const props = setup();
        fireEvent.change(screen.getByLabelText(/Algorithm/i), { target: { value: "voronoi" } });
        expect(props.onChange).toHaveBeenCalledWith("voronoi", defaultParams("voronoi"));
    });

    it("carries common options across algorithm switches", () => {
        const props = setup({ params: { ...defaultParams("grid"), preserveTransparency: false } });
        fireEvent.change(screen.getByLabelText(/Algorithm/i), { target: { value: "hex" } });
        expect(props.onChange).toHaveBeenCalledWith("hex", { ...defaultParams("hex"), preserveTransparency: false });
    });

    it("renders and toggles the preserve-transparency checkbox", () => {
        const props = setup();
        const checkbox = screen.getByLabelText(/Preserve transparency/i);
        expect(checkbox).toBeChecked();
        fireEvent.click(checkbox);
        expect(props.onChange).toHaveBeenCalledWith("grid", {
            ...defaultParams("grid"),
            preserveTransparency: false,
        });
    });

    it("updates a parameter value", () => {
        const props = setup();
        fireEvent.change(screen.getByLabelText(/Cells across/i), { target: { value: "80" } });
        expect(props.onChange).toHaveBeenCalledWith("grid", { ...defaultParams("grid"), cells: 80 });
    });

    it("submits and resets", () => {
        const props = setup({ hasResult: true });
        fireEvent.click(screen.getByRole("button", { name: "Update Mosaic" }));
        expect(props.onSubmit).toHaveBeenCalled();
        fireEvent.click(screen.getByRole("button", { name: "Reset" }));
        expect(props.onChange).toHaveBeenCalledWith("grid", defaultParams("grid"));
    });

    it("disables controls while processing", () => {
        setup({ disabled: true });
        expect(screen.getByRole("button", { name: "Create Mosaic" })).toBeDisabled();
        expect(screen.getByLabelText(/Algorithm/i)).toBeDisabled();
    });
});
