import { useEffect, useState } from "react";

const STORAGE_KEY = "dokimosaic-theme";
const THEMES = ["light", "system", "dark"];

/**
 * Theme preference with localStorage persistence. Applies
 * data-theme="dark|light" to <html>; "system" tracks prefers-color-scheme.
 */
export function useTheme() {
    const [theme, setThemeState] = useState(() => {
        const stored = typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
        return THEMES.includes(stored) ? stored : "system";
    });

    useEffect(() => {
        const applyTheme = (currentTheme) => {
            if (currentTheme === "system") {
                const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
                document.documentElement.setAttribute("data-theme", systemPrefersDark ? "dark" : "light");
            } else {
                document.documentElement.setAttribute("data-theme", currentTheme);
            }
        };

        applyTheme(theme);

        // Listen for system theme changes if set to system
        if (theme === "system") {
            const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
            const handleChange = () => applyTheme("system");
            if (mediaQuery.addEventListener) {
                mediaQuery.addEventListener("change", handleChange);
                return () => mediaQuery.removeEventListener("change", handleChange);
            } else if (mediaQuery.addListener) {
                mediaQuery.addListener(handleChange);
                return () => mediaQuery.removeListener(handleChange);
            }
        }
    }, [theme]);

    const setTheme = (next) => {
        localStorage.setItem(STORAGE_KEY, next);
        setThemeState(next);
    };

    return { theme, setTheme };
}
