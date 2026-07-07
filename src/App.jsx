import { useLayoutEffect } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import EnvironmentBadge from "./components/EnvironmentBadge";
import MockApiBadge from "./components/MockApiBadge";
import ThemeToggle from "./components/ThemeToggle";
import UpdateAlert from "./components/UpdateAlert";
import { useTheme } from "./utils/useTheme";
import "./App.css";

export default function App() {
    const location = useLocation();
    // The hook must stay mounted even with the toggle hidden — it applies
    // data-theme to <html> (system preference tracking included).
    // oxlint-disable-next-line no-unused-vars
    const { theme, setTheme } = useTheme();

    useLayoutEffect(() => {
        document.documentElement.style.scrollBehavior = "auto";

        window.scrollTo({
            top: 0,
            left: 0,
            behavior: "instant",
        });

        setTimeout(() => {
            document.documentElement.style.scrollBehavior = "";
        }, 20);
    }, [location.pathname]);

    return (
        <>
            <UpdateAlert />
            <header className="top-nav">
                <div className="brand-group">
                    <Link to="/" className="nav-brand">
                        Dokimosaic
                    </Link>
                    <EnvironmentBadge />
                    <MockApiBadge />
                </div>
                <nav className="nav-links">
                    <div className="nav-main-links">
                        <NavLink to="/" className="nav-link nav-home">
                            Home
                        </NavLink>
                        <NavLink to="/feedback" className="nav-link">
                            Feedback
                        </NavLink>
                        <EnvironmentBadge className="mobile-only" />
                        <MockApiBadge className="mobile-only" />
                    </div>
                    {/* <ThemeToggle theme={theme} setTheme={setTheme} /> */}
                </nav>
            </header>
            <main className="content">
                <Outlet />
            </main>
        </>
    );
}
