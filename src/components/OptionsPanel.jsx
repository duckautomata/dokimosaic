import { ALGORITHM_MAP, ALGORITHMS, COMMON_PARAMS, defaultParams } from "../mosaic/algorithmMeta";
import "./OptionsPanel.css";

/**
 * Algorithm picker + per-algorithm parameter controls, rendered generically
 * from the metadata in src/mosaic/algorithmMeta.js. Common options (shared
 * by every algorithm) render after the per-algorithm ones and keep their
 * values when the algorithm changes.
 *
 * @param {Object} props
 * @param {string} props.algorithmId
 * @param {Object} props.params
 * @param {(algorithmId: string, params: Object) => void} props.onChange
 * @param {() => void} props.onSubmit
 * @param {boolean} props.disabled - true while a mosaic is processing
 * @param {boolean} props.hasResult - switches the submit label
 */
export default function OptionsPanel({ algorithmId, params, onChange, onSubmit, disabled, hasResult }) {
    const algo = ALGORITHM_MAP.get(algorithmId);

    const setParam = (key, value) => {
        onChange(algorithmId, { ...params, [key]: value });
    };

    const switchAlgorithm = (nextId) => {
        // Fresh defaults for the new algorithm, but common options persist.
        const next = defaultParams(nextId);
        for (const p of COMMON_PARAMS) {
            if (params[p.key] !== undefined) next[p.key] = params[p.key];
        }
        onChange(nextId, next);
    };

    return (
        <form
            className="options-panel"
            onSubmit={(e) => {
                e.preventDefault();
                if (!disabled) onSubmit();
            }}
        >
            <div className="options-field">
                <label className="options-label" htmlFor="options-algorithm">
                    Algorithm
                </label>
                <select
                    id="options-algorithm"
                    className="options-select"
                    value={algorithmId}
                    disabled={disabled}
                    onChange={(e) => switchAlgorithm(e.target.value)}
                >
                    {ALGORITHMS.map((a) => (
                        <option key={a.id} value={a.id}>
                            {a.name} - {a.tagline}
                        </option>
                    ))}
                </select>
                <p className="options-description">{algo.description}</p>
            </div>

            {[...algo.params, ...COMMON_PARAMS].map((p) =>
                p.kind === "bool" ? (
                    <div className="options-field" key={p.key}>
                        <label className="options-checkbox-label" htmlFor={`options-${p.key}`}>
                            <input
                                id={`options-${p.key}`}
                                className="options-checkbox"
                                type="checkbox"
                                checked={!!params[p.key]}
                                disabled={disabled}
                                onChange={(e) => setParam(p.key, e.target.checked)}
                            />
                            <span>{p.label}</span>
                        </label>
                        <span className="options-hint">{p.hint}</span>
                    </div>
                ) : (
                    <div className="options-field" key={p.key}>
                        <label className="options-label options-param-label" htmlFor={`options-${p.key}`}>
                            <span>{p.label}</span>
                            <span className="options-param-value">{params[p.key]}</span>
                        </label>
                        {p.kind === "range" ? (
                            <input
                                id={`options-${p.key}`}
                                className="options-range"
                                type="range"
                                min={p.min}
                                max={p.max}
                                step={p.step}
                                value={params[p.key]}
                                disabled={disabled}
                                onChange={(e) => setParam(p.key, Number(e.target.value))}
                            />
                        ) : (
                            <input
                                id={`options-${p.key}`}
                                className="options-number"
                                type="number"
                                min={p.min}
                                max={p.max}
                                value={params[p.key]}
                                disabled={disabled}
                                onChange={(e) =>
                                    setParam(p.key, Math.max(p.min, Math.min(p.max, Number(e.target.value) || 0)))
                                }
                            />
                        )}
                        <span className="options-hint">{p.hint}</span>
                    </div>
                ),
            )}

            <div className="options-actions">
                <button
                    type="button"
                    className="secondary-btn options-reset"
                    disabled={disabled}
                    onClick={() => onChange(algorithmId, defaultParams(algorithmId))}
                >
                    Reset
                </button>
                <button type="submit" className="primary-btn" disabled={disabled}>
                    {hasResult ? "Update Mosaic" : "Create Mosaic"}
                </button>
            </div>
        </form>
    );
}
