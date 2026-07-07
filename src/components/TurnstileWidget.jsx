import { useEffect, useRef } from "react";
import { isMockMode } from "../config";
import { LOG_ERROR } from "../utils/debug";

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js";
const MOCK_TOKEN_PREFIX = "mock-token-";

let scriptPromise = null;

const loadTurnstileScript = () => {
    if (typeof window === "undefined") return Promise.reject(new Error("No window"));
    if (window.turnstile) return Promise.resolve(window.turnstile);
    if (scriptPromise) return scriptPromise;

    scriptPromise = new Promise((resolve, reject) => {
        const existing = document.querySelector(`script[src^="${SCRIPT_SRC}"]`);
        const waitForGlobal = () => {
            const start = Date.now();
            const tick = () => {
                if (window.turnstile) {
                    resolve(window.turnstile);
                } else if (Date.now() - start > 10000) {
                    reject(new Error("Turnstile script took too long to load"));
                } else {
                    setTimeout(tick, 50);
                }
            };
            tick();
        };

        if (existing) {
            waitForGlobal();
            return;
        }
        const script = document.createElement("script");
        script.src = SCRIPT_SRC;
        script.async = true;
        script.defer = true;
        script.onload = waitForGlobal;
        script.onerror = () => {
            scriptPromise = null;
            reject(new Error("Failed to load Turnstile script"));
        };
        document.head.appendChild(script);
    });
    return scriptPromise;
};

const generateMockToken = () => `${MOCK_TOKEN_PREFIX}${Math.random().toString(36).slice(2, 10)}`;

function MockTurnstileWidget({ onToken, resetRef }) {
    const onTokenRef = useRef(onToken);

    useEffect(() => {
        onTokenRef.current = onToken;
    }, [onToken]);

    useEffect(() => {
        const issue = () => onTokenRef.current?.(generateMockToken());
        issue();
        if (resetRef) {
            resetRef.current = () => {
                onTokenRef.current?.(null);
                issue();
            };
        }
        return () => {
            if (resetRef) resetRef.current = null;
        };
    }, [resetRef]);

    return (
        <div className="turnstile-widget turnstile-widget-mock">
            <span>Mock Turnstile · auto-passed</span>
        </div>
    );
}

function RealTurnstileWidget({ siteKey, onToken, resetRef }) {
    const containerRef = useRef(null);
    const widgetIdRef = useRef(null);
    const onTokenRef = useRef(onToken);

    useEffect(() => {
        onTokenRef.current = onToken;
    }, [onToken]);

    useEffect(() => {
        if (!siteKey || !containerRef.current) return undefined;

        let cancelled = false;
        loadTurnstileScript()
            .then((turnstile) => {
                if (cancelled || !containerRef.current) return;
                widgetIdRef.current = turnstile.render(containerRef.current, {
                    sitekey: siteKey,
                    callback: (token) => onTokenRef.current?.(token),
                    "expired-callback": () => onTokenRef.current?.(null),
                    "error-callback": () => onTokenRef.current?.(null),
                });
                if (resetRef) {
                    resetRef.current = () => {
                        onTokenRef.current?.(null);
                        if (window.turnstile && widgetIdRef.current) {
                            window.turnstile.reset(widgetIdRef.current);
                        }
                    };
                }
            })
            .catch((err) => {
                LOG_ERROR("Turnstile failed to initialize:", err);
            });

        return () => {
            cancelled = true;
            if (window.turnstile && widgetIdRef.current) {
                try {
                    window.turnstile.remove(widgetIdRef.current);
                } catch (err) {
                    LOG_ERROR("Turnstile remove failed:", err);
                }
                widgetIdRef.current = null;
            }
            if (resetRef) {
                resetRef.current = null;
            }
        };
    }, [siteKey, resetRef]);

    return <div ref={containerRef} className="turnstile-widget" />;
}

/**
 * Cloudflare Turnstile widget. Each token is single-use: call resetRef.current()
 * after consuming a token to issue a fresh challenge. In mock mode (VITE_MOCK_API),
 * renders a placeholder and auto-issues fake tokens. The decision to *not* render
 * the widget at all (disabled state) lives with each page: it should gate this
 * component on `cfg.turnstile_enabled` from the public config and seed the token
 * state with `""` instead of mounting the widget.
 *
 * @param {Object} props
 * @param {string} props.siteKey - Site key from /api/public/config (ignored in mock mode).
 * @param {(token: string | null) => void} props.onToken - Called with the token on success, null on expire/error/reset.
 * @param {{ current: (() => void) | null }} [props.resetRef] - Mutable ref; populated with a reset() function.
 */
export default function TurnstileWidget(props) {
    return isMockMode ? <MockTurnstileWidget {...props} /> : <RealTurnstileWidget {...props} />;
}
