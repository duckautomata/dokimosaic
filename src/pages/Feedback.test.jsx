import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import Feedback from "./Feedback";

const mockConfig = vi.fn();

vi.mock("../utils/contentApi", () => ({
    fetchPublicConfig: () => mockConfig(),
    submitSuggestion: vi.fn(),
}));

vi.mock("../components/TurnstileWidget", () => ({
    default: () => <div data-testid="turnstile" />,
}));

// useBlocker requires a data router, so wrap the page in one.
const renderPage = () => {
    const router = createMemoryRouter([{ path: "/", element: <Feedback /> }]);
    render(<RouterProvider router={router} />);
};

describe("Feedback", () => {
    it("renders the form once config is loaded", async () => {
        mockConfig.mockResolvedValue({ turnstile_site_key: "test-key", turnstile_enabled: true });
        renderPage();

        expect(screen.getByText(/loading feedback form/i)).toBeInTheDocument();
        await waitFor(() => expect(screen.getByRole("heading", { name: "Feedback" })).toBeInTheDocument());

        expect(screen.getByLabelText(/Message/i)).toBeInTheDocument();
        expect(screen.getByTestId("turnstile")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /Submit Feedback/i })).toBeDisabled();
    });

    it("hides the turnstile widget when the server disables it", async () => {
        mockConfig.mockResolvedValue({ turnstile_site_key: "", turnstile_enabled: false });
        renderPage();

        await waitFor(() => expect(screen.getByRole("heading", { name: "Feedback" })).toBeInTheDocument());
        expect(screen.queryByTestId("turnstile")).not.toBeInTheDocument();
    });

    it("shows an error when config fails to load", async () => {
        mockConfig.mockRejectedValue(new Error("boom"));
        renderPage();

        await waitFor(() => expect(screen.getByText(/Failed to load feedback config: boom/i)).toBeInTheDocument());
    });
});
