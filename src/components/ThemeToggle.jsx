import "./ThemeToggle.css";

const SunIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32l1.41-1.41" />
    </svg>
);

const MoonIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
);

const SystemIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <rect x="2" y="4" width="20" height="14" rx="2" />
        <path d="M8 21h8m-4-3v3" />
    </svg>
);

const ORDER = ["light", "system", "dark"];
const LABELS = {
    light: "Light theme (click for system)",
    system: "System theme (click for dark)",
    dark: "Dark theme (click for light)",
};

export default function ThemeToggle({ theme, setTheme }) {
    const next = ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length];

    return (
        <button
            className="theme-toggle"
            onClick={() => setTheme(next)}
            aria-label={LABELS[theme]}
            title={LABELS[theme]}
        >
            {theme === "light" ? <SunIcon /> : theme === "dark" ? <MoonIcon /> : <SystemIcon />}
        </button>
    );
}
