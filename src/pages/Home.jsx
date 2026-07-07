import { useEffect, useRef, useState } from "react";
import ExportBar from "../components/ExportBar";
import ImageInput from "../components/ImageInput";
import MosaicViewer from "../components/MosaicViewer";
import OptionsPanel from "../components/OptionsPanel";
import ProcessingOverlay from "../components/ProcessingOverlay";
import TileFilter from "../components/TileFilter";
import { defaultParams } from "../mosaic/algorithmMeta";
import { loadManifest } from "../mosaic/manifest";
import { useMosaicWorker } from "../mosaic/useMosaicWorker";
import { LOG_ERROR } from "../utils/debug";
import { loadFromBlob, loadFromUrl } from "../utils/imageLoad";
import { loadTileNames, tileKeyId } from "../utils/tileNames";
import "./Home.css";

export default function Home() {
    const [source, setSource] = useState(null); // {bitmap, url, width, height, name}
    const [pasteError, setPasteError] = useState(null);
    const [algorithmId, setAlgorithmId] = useState("grid");
    const [params, setParams] = useState(() => defaultParams("grid"));
    const [tileNames, setTileNames] = useState(null);
    const [tileList, setTileList] = useState([]); // [{key, name}] - full library, for the filter
    const [excludedKeys, setExcludedKeys] = useState(() => new Set());
    const worker = useMosaicWorker();

    useEffect(() => {
        Promise.all([loadTileNames(), loadManifest().catch(() => [])]).then(([names, tiles]) => {
            setTileNames(names);
            setTileList(
                tiles.map((t) => ({ key: t.key, name: names.get(tileKeyId(t.key))?.name || tileKeyId(t.key) })),
            );
        });
    }, []);

    const applySource = (next) => {
        worker.reset();
        setPasteError(null);
        setSource((prev) => {
            if (prev) {
                prev.bitmap.close?.();
                URL.revokeObjectURL(prev.url);
            }
            return next;
        });
    };
    const applySourceRef = useRef(applySource);
    applySourceRef.current = applySource;

    // Paste anywhere: an image from the clipboard becomes the target; a
    // pasted URL (outside a text field) is fetched.
    useEffect(() => {
        const onPaste = (e) => {
            const file = [...(e.clipboardData?.items || [])]
                .filter((item) => item.type.startsWith("image/"))
                .map((item) => item.getAsFile())
                .find(Boolean);
            if (file) {
                e.preventDefault();
                loadFromBlob(file, file.name || "pasted image")
                    .then((source) => applySourceRef.current(source))
                    .catch((err) => setPasteError(err.message));
                return;
            }
            const tag = e.target?.tagName;
            if (tag === "INPUT" || tag === "TEXTAREA") return;
            const text = e.clipboardData?.getData("text/plain")?.trim();
            if (text && /^https?:\/\//i.test(text)) {
                e.preventDefault();
                loadFromUrl(text)
                    .then((source) => applySourceRef.current(source))
                    .catch((err) => setPasteError(err.message));
            }
        };
        window.addEventListener("paste", onPaste);
        return () => window.removeEventListener("paste", onPaste);
    }, []);

    const handleCreate = () => {
        if (!source) return;
        worker.process(source.bitmap, algorithmId, params, excludedKeys);
    };

    const handleOptionsChange = (nextAlgorithm, nextParams) => {
        setAlgorithmId(nextAlgorithm);
        setParams(nextParams);
    };

    if (!source) {
        return (
            <div className="home-page">
                <section className="home-hero">
                    <p className="home-subtitle">
                        Turn any image into a mosaic built from Doki&apos;s emotes. Drop a picture below, pick an
                        algorithm, and zoom into every tile of the result.
                    </p>
                </section>
                <div className="home-input-card glass-panel">
                    <ImageInput onImage={applySource} />
                    {pasteError && <div className="status-box error">{pasteError}</div>}
                </div>
            </div>
        );
    }

    return (
        <div className="home-page">
            <div className="home-workspace">
                <aside className="home-sidebar">
                    <div className="home-source-card glass-panel">
                        <span className="home-card-caption">Target image</span>
                        <div className="home-source-preview">
                            <img src={source.url} alt={source.name} />
                        </div>
                        <div className="home-source-meta">
                            <span className="home-source-name" title={source.name}>
                                {source.name}
                            </span>
                            <span className="home-source-dims">
                                {source.width}×{source.height}
                            </span>
                        </div>
                        <button
                            type="button"
                            className="secondary-btn home-replace-btn"
                            onClick={() => applySource(null)}
                        >
                            Use a different image
                        </button>
                        {pasteError && <div className="status-box error">{pasteError}</div>}
                    </div>

                    <div className="home-options-card glass-panel">
                        <span className="home-card-caption">Mosaic options</span>
                        <OptionsPanel
                            algorithmId={algorithmId}
                            params={params}
                            onChange={handleOptionsChange}
                            onSubmit={handleCreate}
                            disabled={worker.status === "processing"}
                            hasResult={!!worker.result}
                        />
                    </div>

                    {tileList.length > 0 && (
                        <div className="home-options-card glass-panel">
                            <TileFilter
                                tiles={tileList}
                                excluded={excludedKeys}
                                onChange={setExcludedKeys}
                                disabled={worker.status === "processing"}
                            />
                        </div>
                    )}
                </aside>

                <section className="home-result">
                    <div className="home-result-area">
                        {worker.result ? (
                            <MosaicViewer
                                model={worker.result.model}
                                hqBitmap={worker.result.hqBitmap}
                                tileKeys={worker.result.tileKeys}
                                tileNames={tileNames}
                            />
                        ) : (
                            <div className="home-result-placeholder">
                                {worker.status === "error" ? (
                                    <div className="status-box error">Something went wrong: {worker.error}</div>
                                ) : worker.status !== "processing" ? (
                                    <>
                                        <MosaicIcon />
                                        <p>
                                            Pick an algorithm and hit <strong>Create Mosaic</strong>. The result shows
                                            up here.
                                        </p>
                                    </>
                                ) : null}
                            </div>
                        )}
                        {worker.status === "processing" && (
                            <ProcessingOverlay
                                stage={worker.stage}
                                startedAt={worker.startedAt}
                                onCancel={worker.cancel}
                            />
                        )}
                    </div>
                    {worker.result && (
                        <div className="home-export-card glass-panel">
                            <ExportBar
                                exportMosaic={(scale) =>
                                    worker.exportMosaic(scale).catch((err) => {
                                        LOG_ERROR("[dokimosaic] export failed:", err);
                                        throw err;
                                    })
                                }
                                algorithmId={algorithmId}
                                disabled={worker.status === "processing"}
                            />
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
}

const MosaicIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
        <rect x="3" y="3" width="8" height="8" rx="1" />
        <rect x="13" y="3" width="8" height="8" rx="1" />
        <rect x="3" y="13" width="8" height="8" rx="1" />
        <rect x="13" y="13" width="8" height="8" rx="1" />
    </svg>
);
