import { render, screen, fireEvent, within } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import App from "./App";

const renderApp = () =>
    render(
        <MemoryRouter>
            <Routes>
                <Route path="/" element={<App />}>
                    <Route index element={<h1>Home page</h1>} />
                </Route>
            </Routes>
        </MemoryRouter>,
    );

describe("App", () => {
    const { matchMedia, scrollTo } = window;

    beforeEach(() => {
        // jsdom implements neither
        window.matchMedia = vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
        window.scrollTo = vi.fn();
    });

    afterEach(() => {
        window.matchMedia = matchMedia;
        window.scrollTo = scrollTo;
    });

    it("renders the page inside the header layout", () => {
        renderApp();

        expect(screen.getByRole("heading", { name: "Home page" })).toBeInTheDocument();
        expect(screen.getByRole("link", { name: "Feedback" })).toHaveAttribute("href", "/feedback");
    });

    it("opens a site menu from the title that only links to all the sites", () => {
        renderApp();

        // The title opens the site menu instead of linking home.
        fireEvent.click(screen.getByRole("button", { name: "Dokimosaic" }));
        const menu = screen.getByRole("navigation", { name: "Sites" });

        const links = within(menu).getAllByRole("link");
        expect(links).toHaveLength(1);
        expect(links[0]).toHaveAccessibleName("All my sites");
        expect(links[0]).toHaveAttribute("href", "https://www.duck-automata.com/");
        expect(menu.querySelector("img")).toBeNull();
    });
});
