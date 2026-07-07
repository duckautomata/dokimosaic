import { useEffect, useState } from "react";
import "./ProcessingOverlay.css";

// Processing normally finishes in a few seconds; past this, offer an exit.
const CANCEL_AFTER_MS = 10000;

/**
 * Throbber shown while the worker crunches a mosaic. After 10 seconds a
 * cancel button appears so the user can bail out and try other settings.
 *
 * @param {Object} props
 * @param {string} props.stage - human-readable current stage from the worker
 * @param {number} props.startedAt - Date.now() when processing began
 * @param {() => void} props.onCancel
 */
export default function ProcessingOverlay({ stage, startedAt, onCancel }) {
    const [elapsed, setElapsed] = useState(0);

    useEffect(() => {
        setElapsed(Date.now() - startedAt);
        const interval = setInterval(() => setElapsed(Date.now() - startedAt), 250);
        return () => clearInterval(interval);
    }, [startedAt]);

    const seconds = elapsed / 1000;

    return (
        <div className="processing-overlay" role="status" aria-live="polite">
            <div className="processing-throbber" />
            <div className="processing-text">
                <strong>Creating your mosaic…</strong>
                <span className="processing-stage">
                    {stage}
                    {seconds >= 1 ? ` · ${seconds.toFixed(0)}s` : ""}
                </span>
            </div>
            {elapsed >= CANCEL_AFTER_MS && (
                <div className="processing-cancel">
                    <p>This is taking a while. Large images and high detail settings can be slow.</p>
                    <button type="button" className="secondary-btn" onClick={onCancel}>
                        Cancel and try something else
                    </button>
                </div>
            )}
        </div>
    );
}
