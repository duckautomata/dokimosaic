import { useState } from "react";
import { LOG_ERROR, LOG_MSG } from "../utils/debug";
import "./ExportBar.css";

const SCALES = [1, 2, 4];

/**
 * Export controls: render the mosaic at the target image's resolution (or
 * 2x/4x) and download it or copy it to the clipboard, always as PNG.
 *
 * @param {Object} props
 * @param {(scale: number) => Promise<{blob: Blob, width: number, height: number}>} props.exportMosaic
 * @param {string} props.algorithmId - used in the download filename
 * @param {boolean} props.disabled
 */
export default function ExportBar({ exportMosaic, algorithmId, disabled }) {
    const [scale, setScale] = useState(1);
    const [busy, setBusy] = useState(null); // "download" | "copy" | null
    const [notice, setNotice] = useState(null); // {kind: "success"|"error", text}

    const flash = (kind, text) => {
        setNotice({ kind, text });
        setTimeout(() => setNotice(null), kind === "error" ? 6000 : 2500);
    };

    const handleDownload = async () => {
        setBusy("download");
        setNotice(null);
        const t0 = performance.now();
        try {
            const { blob, width, height } = await exportMosaic(scale);
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `dokimosaic-${algorithmId}-${scale}x.png`;
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 10000);
            LOG_MSG(`[dokimosaic] download (${width}x${height}) took ${(performance.now() - t0).toFixed(0)}ms`);
            flash("success", "Downloaded!");
        } catch (err) {
            LOG_ERROR("[dokimosaic] download failed:", err);
            flash("error", `Download failed: ${err.message}`);
        } finally {
            setBusy(null);
        }
    };

    const handleCopy = async () => {
        setBusy("copy");
        setNotice(null);
        const t0 = performance.now();
        try {
            if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
                throw new Error("this browser doesn't support copying images");
            }
            const blobPromise = exportMosaic(scale).then((r) => r.blob);
            try {
                // Promise-based ClipboardItem keeps the user-gesture context
                // alive during the async render (required by Safari).
                await navigator.clipboard.write([new ClipboardItem({ "image/png": blobPromise })]);
            } catch (err) {
                if (err?.name === "NotAllowedError") throw err;
                // Some browsers reject promise payloads. Retry with the blob.
                await navigator.clipboard.write([new ClipboardItem({ "image/png": await blobPromise })]);
            }
            LOG_MSG(`[dokimosaic] copy to clipboard took ${(performance.now() - t0).toFixed(0)}ms`);
            flash("success", "Copied!");
        } catch (err) {
            LOG_ERROR("[dokimosaic] copy failed:", err);
            flash("error", `Copy failed: ${err.message}`);
        } finally {
            setBusy(null);
        }
    };

    return (
        <div className="export-bar">
            <div className="export-scale-group" role="radiogroup" aria-label="Export size">
                <span className="export-scale-label">Export size</span>
                {SCALES.map((s) => (
                    <button
                        key={s}
                        type="button"
                        role="radio"
                        aria-checked={scale === s}
                        className={`export-scale-pill ${scale === s ? "active" : ""}`.trim()}
                        onClick={() => setScale(s)}
                        disabled={disabled || !!busy}
                        title={s === 1 ? "Same resolution as the target image" : `${s}x the target resolution`}
                    >
                        {s}x
                    </button>
                ))}
            </div>
            <div className="export-actions">
                <button
                    type="button"
                    className="secondary-btn export-btn"
                    onClick={handleCopy}
                    disabled={disabled || !!busy}
                >
                    {busy === "copy" ? <span className="spinner" /> : <CopyIcon />}
                    Copy
                </button>
                <button
                    type="button"
                    className="primary-btn export-btn"
                    onClick={handleDownload}
                    disabled={disabled || !!busy}
                >
                    {busy === "download" ? <span className="spinner" /> : <DownloadIcon />}
                    Download PNG
                </button>
            </div>
            {notice && <div className={`status-box export-notice ${notice.kind}`}>{notice.text}</div>}
        </div>
    );
}

const DownloadIcon = () => (
    <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
    >
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <path d="M7 10l5 5 5-5" />
        <path d="M12 15V3" />
    </svg>
);

const CopyIcon = () => (
    <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
    >
        <rect x="9" y="9" width="13" height="13" rx="2" />
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
);
