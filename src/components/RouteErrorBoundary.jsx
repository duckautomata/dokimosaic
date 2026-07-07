import { isRouteErrorResponse, Link, useRouteError } from "react-router-dom";
import { LOG_ERROR } from "../utils/debug";
import "../pages/Feedback.css";

/**
 * Catches errors thrown anywhere below it in the route tree (render errors,
 * loader/action errors, etc.) and shows a friendly fallback. Wired in via the
 * `errorElement` field on each route in `src/router.jsx`. In dev mode the raw
 * stack is included to make debugging easier.
 */
export default function RouteErrorBoundary() {
    const error = useRouteError();
    LOG_ERROR("Route error", error);

    let title = "Something went wrong";
    let detail = "An unexpected error occurred. Try heading back home.";

    if (isRouteErrorResponse(error)) {
        title = `${error.status} ${error.statusText || "Error"}`;
        detail = (typeof error.data === "string" && error.data) || error.statusText || detail;
    } else if (error instanceof Error) {
        detail = error.message || detail;
    }

    const showStack = import.meta.env.DEV && error instanceof Error && error.stack;

    return (
        <div className="feedback-page">
            <div className="feedback-card glass-panel">
                <h1 className="feedback-title">{title}</h1>
                <p className="feedback-subtitle">{detail}</p>
                {showStack && <pre className="route-error-stack">{error.stack}</pre>}
                <div className="feedback-actions">
                    <Link to="/" className="primary-btn" style={{ textDecoration: "none" }}>
                        Back to Home
                    </Link>
                </div>
            </div>
        </div>
    );
}
