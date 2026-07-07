import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import TurnstileWidget from "../components/TurnstileWidget";
import UnsavedChangesGuard from "../components/UnsavedChangesGuard";
import { fetchPublicConfig, submitSuggestion } from "../utils/contentApi";
import { LOG_ERROR } from "../utils/debug";
import "./Feedback.css";

export default function Feedback() {
    const [cfg, setCfg] = useState(null);
    const [cfgError, setCfgError] = useState(null);

    const [subject, setSubject] = useState("");
    const [message, setMessage] = useState("");

    const [turnstileToken, setTurnstileToken] = useState(null);
    const turnstileResetRef = useRef(null);

    const [busy, setBusy] = useState(null);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);

    useEffect(() => {
        fetchPublicConfig()
            .then(setCfg)
            .catch((err) => {
                LOG_ERROR("Failed to fetch public config", err);
                setCfgError(err.message);
            });
    }, []);

    // When the server has Turnstile disabled, skip the widget entirely and
    // satisfy the token gate with an empty string.
    useEffect(() => {
        if (cfg && cfg.turnstile_enabled === false) {
            setTurnstileToken("");
        }
    }, [cfg]);

    const canSubmit = message.trim().length > 0 && turnstileToken !== null && !busy;
    const isDirty = !success && (subject.trim().length > 0 || message.trim().length > 0);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!canSubmit) return;
        setError(null);
        setBusy("submitting");
        try {
            const payload = {
                suggestion_type: "general",
                subject: subject.trim(),
                message: message.trim(),
            };
            const result = await submitSuggestion({
                token: turnstileToken,
                kind: "new",
                payload,
            });
            setSuccess(result);
        } catch (err) {
            LOG_ERROR("Submit failed", err);
            setError(`Submission failed: ${err.message}`);
        } finally {
            setBusy(null);
            turnstileResetRef.current?.();
        }
    };

    if (cfgError) {
        return (
            <div className="feedback-page">
                <Link to="/" className="feedback-back">
                    <span className="back-arrow">←</span> Back to Home
                </Link>
                <div className="feedback-card glass-panel">
                    <div className="status-box error">Failed to load feedback config: {cfgError}</div>
                </div>
            </div>
        );
    }

    if (!cfg) {
        return (
            <div className="feedback-page">
                <div className="feedback-loading">Loading feedback form…</div>
            </div>
        );
    }

    if (success) {
        return (
            <div className="feedback-page">
                <Link to="/" className="feedback-back">
                    <span className="back-arrow">←</span> Back to Home
                </Link>
                <div className="feedback-card glass-panel">
                    <h1 className="feedback-title">Thanks!</h1>
                    <p className="feedback-subtitle">
                        Your feedback has been received. Reference ID: <code>{success.id}</code>
                    </p>
                    <div className="feedback-actions">
                        <Link to="/" className="primary-btn" style={{ textDecoration: "none" }}>
                            Back to Home
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="feedback-page">
            <UnsavedChangesGuard when={isDirty} />
            <Link to="/" className="feedback-back">
                <span className="back-arrow">←</span> Back to Home
            </Link>
            <div className="feedback-card glass-panel">
                <h1 className="feedback-title">Feedback</h1>
                <p className="feedback-subtitle">
                    Have a suggestion to improve Dokimosaic: an algorithm idea, a bug, anything? Send it here.
                </p>

                <form className="feedback-form" onSubmit={handleSubmit}>
                    <div className="feedback-field">
                        <label className="feedback-field-label" htmlFor="feedback-subject">
                            Subject <span className="feedback-field-hint">(optional)</span>
                        </label>
                        <input
                            id="feedback-subject"
                            className="feedback-input"
                            type="text"
                            value={subject}
                            onChange={(e) => setSubject(e.target.value)}
                            maxLength={200}
                        />
                    </div>

                    <div className="feedback-field">
                        <label className="feedback-field-label" htmlFor="feedback-message">
                            Message <span className="feedback-field-required">*</span>
                        </label>
                        <textarea
                            id="feedback-message"
                            className="feedback-textarea"
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            required
                            maxLength={5000}
                        />
                    </div>

                    {cfg.turnstile_enabled !== false && (
                        <div className="feedback-turnstile-block">
                            <span className="feedback-field-hint">Human verification:</span>
                            <TurnstileWidget
                                siteKey={cfg.turnstile_site_key}
                                onToken={setTurnstileToken}
                                resetRef={turnstileResetRef}
                            />
                        </div>
                    )}

                    {error && <div className="status-box error">{error}</div>}

                    <div className="feedback-actions">
                        <button type="submit" className="primary-btn" disabled={!canSubmit}>
                            {busy === "submitting" ? "Submitting…" : "Submit Feedback"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
